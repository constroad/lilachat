import type { Server as HttpServer } from 'node:http';
import { Types } from 'mongoose';
import { Server as SocketServer, type Socket } from 'socket.io';
import { ChatModel, type Message } from './chatModels.js';
import { crearColaSerial } from '@lilachat/shared';
import {
  ForbiddenChatError,
  chatMemberIds,
  marcarLeidoDetallado,
  pullSince,
  sendMessage,
  deleteMessage,
  editMessage,
  markDelivered,
} from './chatService.js';
import { toClientMessages } from './messageView.js';
import { isOnline, markOffline, markOnline, onlineAmong } from './presence.js';
import { guardarUltimaVez, ultimaVezDeContacto } from './ultimaVez.js';
import { autoResponderA } from './autoReply.js';
import { avisarFinDeLlamada, avisarLlamada, avisarReaccion, notifyOffline } from './pushService.js';
import { reaccionar } from './reacciones.js';
import { candidatosDeLaOferta, frameConAutor, guardarCandidato, hayOfertasPendientes, ofertasVigentes } from './llamadas.js';
import { alContestar, alOfrecer, alTerminar, configurarCiclo } from './cicloDeLlamada.js';
import { configurarEntrega } from './entregaPorAviso.js';
import { configurarAvisoDeTarjeta } from './avisoDeTarjeta.js';
import { maybeAnswerMention } from './assistantReply.js';
import { verifySession } from './sessions.js';
import { esDispositivoVinculado } from '@lilachat/shared';
import { vinculadoVigente } from './dispositivosVinculados.js';
import { HiloInvalidoError } from './hilos.js';
import { registerAgendaRelay } from './agendaRelay.js';
import { avisarCambioDeChat, avisarEntregadoAlConectar, avisarMensajeNuevo, fijarServidorDelReparto, leerLoPropio, publicarAviso, publicarMensaje } from './reparto.js';

export { avisarCambioDeChat, avisarCambioDeVinculos, avisarMensajeNuevo, desconectarDispositivo, notifyThread, publicarAviso, publicarMensaje } from './reparto.js';

/**
 * El tiempo real (spec §6.1). Socket.IO sobre WS: a esta escala el protocolo
 * binario de WhatsApp/Telegram existe por miles de millones de usuarios, no por
 * necesidad nuestra — y acks, salas y reconexión ya vienen resueltos.
 *
 * Tres decisiones:
 *
 * 1. **La identidad sale del JWT**, nunca del handshake. Un `userId` que manda
 *    el cliente es una sugerencia, no una credencial.
 * 2. **Una sala por USUARIO** (`user:<id>`), no por chat. Cada persona puede
 *    tener varios dispositivos, y un mensaje nuevo tiene que llegarles a todos
 *    sin recalcular a qué salas de chat está unido cada socket.
 * 3. **El envío pasa por `chatService`**, el mismo que usa REST: las reglas de
 *    membresía e idempotencia viven en UN lugar.
 */

type AuthedSocket = Socket & { userId?: Types.ObjectId; deviceId?: string };

const userRoom = (userId: string) => `user:${userId}`;
/** Sala por dispositivo: revocar una web vinculada corta SOLO su socket (W5). */
const deviceRoom = (deviceId: string) => `device:${deviceId}`;

/**
 * Con quién comparto chats. Es a quién le importa mi presencia — y el único
 * conjunto al que se le puede contar, porque un desconocido no tiene por qué
 * saber si estoy en línea.
 */
async function contactIdsOf(userId: Types.ObjectId): Promise<string[]> {
  const chats = await ChatModel.find({ 'members.userId': userId })
    .select('members.userId')
    .lean();
  const ids = new Set<string>();
  for (const chat of chats) {
    for (const member of chat.members) {
      const id = String(member.userId);
      if (id !== String(userId)) ids.add(id);
    }
  }
  return [...ids];
}

const PING_INTERVALO_MS = 15_000;
const PING_ESPERA_MS = 10_000;

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    // El cliente es nuestra app y nuestra web; no hay terceros embebiéndonos.
    cors: { origin: false },
    // Un mensaje de texto no pesa; el techo evita que un cliente roto empuje
    // megabytes por el socket.
    maxHttpBufferSize: 1e6,
    // Un teléfono que pierde la señal se da por caído en ~25 s y no en 45 (los
    // valores por defecto, 25 + 20): en esa ventana no se le mandaba push, sus
    // `msg.new` se perdían y el server lo marcaba entregado sin estarlo (FL4).
    // No se baja más: con «Conexión permanente» el ping corre con la app atrás
    // y cada latido es batería.
    pingInterval: PING_INTERVALO_MS,
    pingTimeout: PING_ESPERA_MS,
  });

  // Se publica para que el camino HTTP (`/api/media`) pueda emitir `msg.new`.
  fijarServidorDelReparto(io);
  configurarEntrega((userId, frame) => void io.to(userRoom(userId)).emit('receipt', frame));
  configurarAvisoDeTarjeta((userId, cambio) => void io.to(userRoom(userId)).emit('ref.changed', cambio));
  configurarCiclo({
    emitirA: (userId, evento, frame) => void io.to(userRoom(userId)).emit(evento, frame),
    publicar: (mensaje, members) => publicarMensaje(mensaje, members, { soloSiAlDia: true }),
    avisarSinPush: (mensaje, members) => publicarAviso(mensaje, members),
    avisarFin: avisarFinDeLlamada,
    avisarLlamada,
  });

  io.use((socket: AuthedSocket, next) => {
    const token = String(socket.handshake.auth?.token ?? '');
    const claims = token ? verifySession(token) : null;
    if (!claims) return next(new Error('unauthorized'));
    socket.userId = new Types.ObjectId(claims.userId);
    socket.deviceId = claims.deviceId;
    if (!esDispositivoVinculado(claims.deviceId)) return next();
    // Una web vinculada y revocada no vuelve a entrar con su JWT viejo (W5).
    vinculadoVigente(claims.deviceId).then(
      (vigente) => next(vigente ? undefined : new Error('unauthorized')),
      () => next(new Error('unauthorized'))
    );
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId;
    if (!userId) return socket.disconnect(true);
    const me = String(userId);
    void socket.join(userRoom(me));
    if (socket.deviceId) void socket.join(deviceRoom(socket.deviceId));
    registerAgendaRelay(io, socket, me, userRoom(me));

    // Presencia: el alta es SINCRÓNICA, antes de cualquier `await`. Si se
    // contaba después de leer los contactos, un corte inmediato (salir rápido
    // de la app) corría `markOffline` primero y el contador quedaba en 1 para
    // siempre: «en línea» sin socket, y nunca más un push (FL8.1, 17/10/2026).
    const { becameOnline } = markOnline(me);
    // Se avisa SOLO a quien comparte un chat conmigo. Emitirlo a todos
    // convertiría cada conexión en un broadcast global.
    void (async () => {
      const contacts = await contactIdsOf(userId);
      // Si ya se cortó, el «se fue» lo avisa la desconexión: no se pisa con un
      // «se conectó» que llega tarde.
      if (becameOnline && socket.connected) {
        for (const contact of contacts) {
          io.to(userRoom(contact)).emit('presence', { userId: me, online: true });
        }
      }
      // Y a mí me interesa quién YA estaba en línea: sin esto, los puntos
      // verdes solo aparecerían cuando alguien se conecta después que yo.
      socket.emit('presence.snapshot', { online: onlineAmong(contacts) });

      // Lo que me llegó desconectado, entregado ahora (auditoría 19/10).
      await avisarEntregadoAlConectar(userId, me);

      // Una llamada que sigue sonando en uno de mis chats (FL8): conecté
      // tarde —abrí la app desde el push «Llamada de…»— y todavía se contesta.
      if (hayOfertasPendientes()) {
        const misChats = await ChatModel.find({ 'members.userId': userId }).select('_id').lean();
        for (const oferta of ofertasVigentes(misChats.map((chat) => String(chat._id)), me)) {
          socket.emit('call.offer', oferta);
          // Y sus candidatos, DESPUÉS de la oferta (FL11): sin ellos el audio
          // no cruzaba y la llamada quedaba en «Conectando…».
          for (const candidato of candidatosDeLaOferta(String((oferta as { chatId: string }).chatId))) {
            socket.emit('call.ice', candidato);
          }
        }
      }
    })();

    socket.on('disconnect', () => {
      // La baja también SINCRÓNICA, en el mismo orden que el alta.
      if (!markOffline(me).becameOffline) return;
      // «últ. vez» (FL10): se guarda y se avisa con la hora en que se fue.
      const lastSeenAt = new Date();
      void (async () => {
        const [contactos] = await Promise.all([
          contactIdsOf(userId),
          guardarUltimaVez(me, lastSeenAt).catch((error) => console.error('[presencia] últ. vez:', error?.message ?? error)),
        ]);
        for (const contact of contactos) {
          io.to(userRoom(contact)).emit('presence', { userId: me, online: false, lastSeenAt: lastSeenAt.toISOString() });
        }
      })();
    });

    socket.on('msg.send', async (frame: unknown, ack?: (response: unknown) => void) => {
      const payload = (frame ?? {}) as Record<string, unknown>;
      try {
        const result = await sendMessage({
          chatId: String(payload.chatId ?? ''),
          senderId: userId,
          clientKey: String(payload.clientKey ?? ''),
          kind: payload.kind as never,
          body: typeof payload.body === 'string' ? payload.body : undefined,
          envelope:
            payload.envelope && typeof payload.envelope === 'object'
              ? (payload.envelope as { v: number; nonce: string; ciphertext: string })
              : undefined,
          replyToSeq: typeof payload.replyToSeq === 'number' ? payload.replyToSeq : undefined,
          menciones: payload.menciones,
          ...(typeof payload.hiloDe === 'number' ? { hiloDe: payload.hiloDe, enElChat: payload.enElChat === true } : {}),
        });

        // Lo propio, leído antes de que nadie vea el mensaje (`leerLoPropio`).
        if (!result.duplicate) await leerLoPropio(result.message, result.members);
        // A TODOS los miembros (incluido el autor: sus otros dispositivos
        // también tienen que ver el mensaje).
        const members = await avisarMensajeNuevo(result.message, result.members);
        // E3: el chip de la raíz al día en todos («4 respuestas · última 10:42»).
        if (result.hilo) for (const miembro of members) io.to(userRoom(miembro)).emit('msg.hilo', { chatId: String(result.message.chatId), raiz: result.message.hiloDe, hilo: result.hilo });
        // Push SOLO a quien no tiene socket vivo. Un duplicado no se re-notifica:
        // ya se avisó cuando el mensaje se creó de verdad.
        if (!result.duplicate) {
          // `.catch` y no `void` a secas: `void` NO engancha un manejador, así
          // que si esto falla —o si la base se cierra con la consulta en
          // vuelo— queda como rechazo sin dueño. En los tests eso hace salir a
          // vitest con 1 aunque los 161 pasen, y en producción despierta la red
          // de seguridad del proceso por algo que no es un error real.
          void notifyOffline({ message: result.message, members, senderId: me }).catch(
            (error) => console.error('[push] no se pudo avisar:', error?.message ?? error)
          );
          // Auto-respuesta de ausente (F11): a los que NO tienen socket. Las
          // reglas anti-loop / anti-spam viven en `autoResponderA`.
          void autoResponderA({
            message: result.message,
            ausentes: members.filter((member) => member !== me && !isOnline(member)),
          }).catch((error) => console.error('[auto-reply] falló:', error?.message ?? error));
        }
        ack?.({ ok: true, seq: result.message.seq, duplicate: result.duplicate });

        // `@lila`, DESPUÉS del ack: el mensaje de quien escribió ya está
        // guardado y repartido, así que si el modelo tarda o falla la
        // conversación siguió igual. Un duplicado no la vuelve a invocar.
        if (!result.duplicate) {
          void maybeAnswerMention({
            chatId: result.message.chatId,
            askedBy: userId,
            body: result.message.body,
            // Por el MISMO camino que todo mensaje (auditoría 19/10): socket,
            // entregado a los conectados y push a los demás.
            onReply: async (reply) => void (await publicarMensaje(reply)),
          }).catch((error) => console.error('[lila] mención falló:', error?.message ?? error));
        }
      } catch (error) {
        // Una raíz de hilo inválida también es permanente (E3): la cola la descarta con su motivo.
        if (error instanceof HiloInvalidoError) return ack?.({ ok: false, status: 400, message: error.message, motivo: error.message });
        const forbidden = error instanceof ForbiddenChatError;
        // 403 es PERMANENTE para la cola del cliente: descarta con motivo en
        // vez de reintentar para siempre (anti-wedge del outbox).
        ack?.({ ok: false, status: forbidden ? 403 : 500, message: forbidden ? error.message : undefined });
      }
    });

    /**
     * SEÑALIZACIÓN DE LLAMADAS (F10).
     *
     * El server es un CARTERO: reenvía ofertas, respuestas y candidatos ICE
     * entre los miembros del chat. El audio y el video **no pasan por acá** —
     * van directo entre los dos, o por el TURN si el NAT no deja.
     *
     * La membresía del chat es el permiso, igual que todo lo demás: sin eso,
     * cualquiera con sesión podría hacer sonar el teléfono de un desconocido.
     */
    // EN ORDEN de llegada (FL11): la oferta consulta la base y un candidato
    // no, así que sin cola el candidato le ganaba a su oferta y el otro lo
    // descartaba (todavía no sabía de qué llamada era).
    const señalesEnOrden = crearColaSerial();
    const reenviarSeñal = (evento: string) =>
      socket.on(evento, (frame: unknown) => void señalesEnOrden(async () => {
        const payload = (frame ?? {}) as { chatId?: string; [k: string]: unknown };
        if (!payload.chatId || !Types.ObjectId.isValid(payload.chatId)) return;

        try {
          const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
          if (!members.includes(String(userId))) return;

          const frame = await frameConAutor(evento, payload, String(userId));
          for (const member of members) {
            // A MÍ NO: recibir mi propia oferta haría que el teléfono se llame
            // a sí mismo. A mis otros dispositivos tampoco — el que contesta es
            // el que tiene la llamada, y duplicarla haría sonar dos.
            if (member === String(userId)) continue;
            io.to(userRoom(member)).emit(evento, frame);
          }
          // FL8/FL8.1: la oferta queda «sonando» para quien conecte en ese
          // tiempo, a los desconectados les llega un push, y al terminar queda
          // la línea en el chat (`cicloDeLlamada`).
          if (evento === 'call.offer') {
            alOfrecer({ chatId: payload.chatId, from: String(userId), members, video: payload.video === true, frame });
          } else if (evento === 'call.answer') {
            // Mis OTROS teléfonos dejan de sonar: contesté en este.
            socket.to(userRoom(String(userId))).emit('call.end', { chatId: payload.chatId, motivo: 'contestada-en-otro' });
            await alContestar(payload.chatId);
          } else if (evento === 'call.ice') {
            guardarCandidato(payload.chatId, frame, String(userId));
          } else {
            await alTerminar(payload.chatId);
          }
        } catch {
          // Un chat inválido no tira la conexión: la señalización es best-effort
          // y el que llama ya tiene su propio tiempo de espera.
        }
      }));

    for (const evento of ['call.offer', 'call.answer', 'call.ice', 'call.end', 'call.reject']) {
      reenviarSeñal(evento);
    }

    socket.on('sync.pull', async (frame: unknown, ack?: (response: unknown) => void) => {
      const cursors = ((frame ?? {}) as { cursors?: Record<string, number> }).cursors ?? {};
      try {
        const batches = await pullSince({ userId, cursors });
        ack?.({
          ok: true,
          batches: batches.map((batch) => ({
            chatId: batch.chatId,
            messages: toClientMessages(batch.messages),
          })),
        });
      } catch {
        ack?.({ ok: false });
      }
    });

    /**
     * Borrar un mensaje para todos.
     *
     * Va por socket y no por HTTP para que el aviso a los demás salga por el
     * mismo camino que el mensaje: quien tenga el chat abierto ve la lápida
     * aparecer sin recargar.
     */
    socket.on('msg.delete', async (frame: unknown, ack?: (r: unknown) => void) => {
      const payload = (frame ?? {}) as Record<string, unknown>;
      try {
        const resultado = await deleteMessage({
          chatId: String(payload.chatId ?? ''),
          seq: Number(payload.seq ?? 0),
          userId: new Types.ObjectId(userId),
        });

        if (!resultado.ok) {
          // El motivo viaja: un «no» mudo se lee como que la app se colgó.
          ack?.({ ok: false, motivo: resultado.motivo });
          return;
        }

        // A TODOS, incluido quien borró: sus otros dispositivos también tienen
        // que reemplazar la burbuja por la lápida.
        const members = await chatMemberIds(resultado.message.chatId);
        for (const member of members) {
          io.to(userRoom(member)).emit('msg.deleted', {
            chatId: String(resultado.message.chatId),
            seq: resultado.message.seq,
          });
          if (resultado.hilo) io.to(userRoom(member)).emit('msg.hilo', { chatId: String(resultado.message.chatId), raiz: resultado.message.hiloDe, hilo: resultado.hilo });
        }
        ack?.({ ok: true });
      } catch (error) {
        console.error('[chat] no se pudo eliminar:', (error as Error).message);
        ack?.({ ok: false, motivo: 'No se pudo eliminar.' });
      }
    });

    /**
     * EDITAR (José, 17/10/2026). El server decide (`editMessage`) y avisa a
     * TODOS, incluido quien editó: sus otros teléfonos también cambian el texto.
     * Sin push: corregir una letra no amerita sonar en el bolsillo de nadie.
     */
    socket.on('msg.edit', async (frame: unknown, ack?: (r: unknown) => void) => {
      const payload = (frame ?? {}) as Record<string, unknown>;
      try {
        const resultado = await editMessage({
          chatId: String(payload.chatId ?? ''),
          seq: Number(payload.seq ?? 0),
          userId: new Types.ObjectId(userId),
          body: typeof payload.body === 'string' ? payload.body : '',
        });
        if (!resultado.ok) {
          ack?.({ ok: false, motivo: resultado.motivo });
          return;
        }
        const editado = {
          chatId: String(resultado.message.chatId),
          seq: resultado.message.seq,
          body: resultado.message.body,
          editedAt: resultado.message.editedAt,
        };
        for (const member of await chatMemberIds(resultado.message.chatId)) {
          io.to(userRoom(member)).emit('msg.edited', editado);
        }
        ack?.({ ok: true, editedAt: editado.editedAt });
      } catch (error) {
        console.error('[chat] no se pudo editar:', (error as Error).message);
        ack?.({ ok: false, motivo: 'No se pudo editar.' });
      }
    });

    /**
     * REACCIONAR (20/10). El server decide (`reaccionar`) y manda la lista
     * entera a TODOS —incluidos mis otros equipos—: con la lista no hay orden
     * de llegada que reconciliar. Le suena solo al autor del mensaje.
     */
    socket.on('msg.react', async (frame: unknown, ack?: (r: unknown) => void) => {
      const payload = (frame ?? {}) as Record<string, unknown>;
      try {
        const resultado = await reaccionar({
          chatId: String(payload.chatId ?? ''),
          seq: Number(payload.seq ?? 0),
          userId: String(userId),
          emoji: typeof payload.emoji === 'string' ? payload.emoji : null,
        });
        if (!resultado.ok) {
          ack?.({ ok: false, status: resultado.status, motivo: resultado.motivo });
          return;
        }
        const aviso = { chatId: resultado.chatId, seq: resultado.seq, reacciones: resultado.reacciones };
        for (const member of await chatMemberIds(new Types.ObjectId(resultado.chatId))) io.to(userRoom(member)).emit('msg.reacciones', aviso);
        ack?.({ ok: true, reacciones: resultado.reacciones });
        if (typeof payload.emoji === 'string') void avisarReaccion({ chatId: resultado.chatId, seq: resultado.seq, autor: resultado.autor, quien: String(userId), emoji: payload.emoji, cuerpo: resultado.cuerpo });
      } catch (error) {
        console.error('[chat] no se pudo reaccionar:', (error as Error).message);
        ack?.({ ok: false, motivo: 'No se pudo reaccionar.' });
      }
    });

    socket.on('read.set', async (frame: unknown) => {
      const payload = (frame ?? {}) as { chatId?: string; seq?: number };
      if (!payload.chatId || typeof payload.seq !== 'number') return;
      try {
        // Sin avance no hay nada que avisar: cada `receipt` es un re-render en
        // cada teléfono del chat (FL12, §49 #3).
        // Se difunde el seq que QUEDÓ (el server lo recorta al último mensaje), no el del cliente.
        const { leido, desmarcado } = await marcarLeidoDetallado({ chatId: payload.chatId, userId, seq: payload.seq });
        // Sin avance pero con la marca de «no leído» quitada: mis otros equipos releen.
        if (!leido) return void (desmarcado && avisarCambioDeChat(me, payload.chatId));
        const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
        for (const member of members) {
          io.to(userRoom(member)).emit('receipt', {
            chatId: payload.chatId,
            userId: String(userId),
            readSeq: leido,
            // Leer implica entregado: sin esto el doble check gris nunca se
            // pondria azul si el otro ya lo tenia como entregado.
            deliveredSeq: leido,
          });
        }
      } catch {
        // Un acuse que no se pudo guardar no rompe la sesión: el próximo lo
        // arregla, porque es un cursor y no un incremento.
      }
    });

    /**
     * «Me llego» —entregado, no leido—. Lo emite el cliente cuando RECIBE un
     * mensaje ajeno, y es lo que hace aparecer el doble check gris de WhatsApp
     * antes de que el otro abra el chat.
     */
    socket.on('deliver.set', async (frame: unknown) => {
      const payload = (frame ?? {}) as { chatId?: string; seq?: number };
      if (!payload.chatId || typeof payload.seq !== 'number') return;
      try {
        const entregado = await markDelivered({ chatId: payload.chatId, userId, seq: payload.seq });
        if (!entregado) return;
        const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
        for (const member of members) {
          io.to(userRoom(member)).emit('receipt', {
            chatId: payload.chatId,
            userId: String(userId),
            deliveredSeq: entregado,
          });
        }
      } catch {
        // Igual que el acuse de lectura: si no se pudo guardar, el proximo lo
        // arregla porque es un cursor, no un incremento.
      }
    });

    /**
     * «¿Quién está en línea?» — a pedido.
     *
     * El snapshot se manda una sola vez al conectar, y lo consume la lista de
     * chats. Cuando se ABRE un chat, esa pantalla (`useChat`) llega tarde: el
     * snapshot ya pasó. Este pedido le deja tener el estado actual sin
     * reconectar, y por eso el header podía no mostrar «en línea».
     */
    socket.on('presence.request', async () => {
      const contacts = await contactIdsOf(userId);
      socket.emit('presence.snapshot', { online: onlineAmong(contacts) });
    });

    /** La «últ. vez» del otro de un 1:1, al abrirlo (FL10). */
    socket.on('presence.ultimaVez', async (frame: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      ack({ lastSeenAt: await ultimaVezDeContacto(me, (frame as { userId?: unknown } | null)?.userId) });
    });

    socket.on('typing', async (frame: unknown) => {
      const payload = (frame ?? {}) as { chatId?: string; on?: boolean };
      if (!payload.chatId) return;
      try {
        const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
        for (const member of members) {
          if (member === String(userId)) continue; // a mí mismo, no
          io.to(userRoom(member)).emit('typing', {
            chatId: payload.chatId,
            userId: String(userId),
            on: payload.on !== false,
          });
        }
      } catch {
        // «Está escribiendo» es decorativo: jamás rompe nada.
      }
    });
  });

  return io;
}
