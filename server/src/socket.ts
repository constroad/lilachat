import type { Server as HttpServer } from 'node:http';
import { Types } from 'mongoose';
import { Server as SocketServer, type Socket } from 'socket.io';
import { ChatModel } from './chatModels.js';
import {
  ForbiddenChatError,
  chatMemberIds,
  markRead,
  pullSince,
  sendMessage,
  deleteMessage,
  markDelivered,
} from './chatService.js';
import { toClientMessage, toClientMessages } from './messageView.js';
import { isOnline, markOffline, markOnline, onlineAmong } from './presence.js';
import { notifyOffline } from './pushService.js';
import { maybeAnswerMention } from './assistantReply.js';
import { verifySession } from './sessions.js';

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

type AuthedSocket = Socket & { userId?: Types.ObjectId };

const userRoom = (userId: string) => `user:${userId}`;

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

/**
 * El `io` vivo, para que quien cree un mensaje FUERA del socket pueda avisar.
 *
 * Existe por el 27/08/2026: una foto se sube por HTTP (`/api/media`), ese camino
 * creaba el mensaje correctamente —quedaba en la base— pero **no emitía
 * `msg.new`**, porque el emit vivía solo dentro del handler del socket. El
 * síntoma: la foto no aparecía en el chat hasta reabrirlo. Verificado mirando la
 * base (el mensaje estaba, con su `seq`) y la pantalla (no estaba).
 *
 * `null` mientras no se llamó a `attachSocket` — o sea en los tests que montan
 * la app sin socket. `avisarMensajeNuevo` no hace nada en ese caso.
 */
let ioVivo: SocketServer | null = null;

/**
 * Emite `msg.new` a todos los miembros de un chat. Es la MISMA operación que
 * hace el handler del socket, extraída para que los dos caminos —texto por
 * socket, media por HTTP— avisen igual. Tenerla en un solo lugar es lo que
 * impide que la próxima forma de crear un mensaje vuelva a olvidarse del aviso.
 */
export async function avisarMensajeNuevo(
  message: Parameters<typeof toClientMessage>[0]
): Promise<string[]> {
  const members = await chatMemberIds(message.chatId);
  if (!ioVivo) return members;

  const remitente = String((message as { senderId?: unknown }).senderId ?? '');
  const chatId = String(message.chatId);
  const seq = Number((message as { seq?: unknown }).seq);

  for (const member of members) {
    ioVivo.to(userRoom(member)).emit('msg.new', toClientMessage(message));

    // A un miembro CONECTADO que no sea el autor se le acaba de ENTREGAR: se
    // marca su acuse de entrega y se avisa al remitente. Asi el doble check
    // gris aparece aunque esa persona no tenga el chat abierto — como WhatsApp.
    // El offline lo acusa su propio cliente al reconectar y hacer sync.pull.
    if (
      member !== remitente &&
      Number.isFinite(seq) &&
      seq > 0 &&
      Types.ObjectId.isValid(member) &&
      isOnline(member)
    ) {
      void markDelivered({ chatId, userId: new Types.ObjectId(member), seq })
        .then(() => {
          ioVivo?.to(userRoom(remitente)).emit('receipt', {
            chatId,
            userId: member,
            deliveredSeq: seq,
          });
        })
        .catch(() => {});
    }
  }
  return members;
}

/**
 * Avisa a una persona que un chat suyo cambió de forma (entró o salió alguien).
 *
 * No manda QUÉ cambió: manda que hay que releer. Mandar el diff obligaría a que
 * el cliente sepa aplicar cada tipo de cambio en orden, y una lista de chats que
 * se recarga sola es infinitamente más barata de mantener correcta.
 */
export function avisarCambioDeChat(userId: string, chatId: string): void {
  ioVivo?.to(userRoom(userId)).emit('chat.changed', { chatId });
}

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    // El cliente es nuestra app y nuestra web; no hay terceros embebiéndonos.
    cors: { origin: false },
    // Un mensaje de texto no pesa; el techo evita que un cliente roto empuje
    // megabytes por el socket.
    maxHttpBufferSize: 1e6,
  });

  // Se publica para que el camino HTTP (`/api/media`) pueda emitir `msg.new`.
  ioVivo = io;

  io.use((socket: AuthedSocket, next) => {
    const token = String(socket.handshake.auth?.token ?? '');
    const claims = token ? verifySession(token) : null;
    if (!claims) return next(new Error('unauthorized'));
    socket.userId = new Types.ObjectId(claims.userId);
    next();
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId;
    if (!userId) return socket.disconnect(true);
    const me = String(userId);
    void socket.join(userRoom(me));

    // Presencia: se avisa SOLO a quien comparte un chat conmigo. Emitirlo a
    // todos convertiría cada conexión en un broadcast global.
    void (async () => {
      const contacts = await contactIdsOf(userId);
      if (markOnline(me).becameOnline) {
        for (const contact of contacts) {
          io.to(userRoom(contact)).emit('presence', { userId: me, online: true });
        }
      }
      // Y a mí me interesa quién YA estaba en línea: sin esto, los puntos
      // verdes solo aparecerían cuando alguien se conecta después que yo.
      socket.emit('presence.snapshot', { online: onlineAmong(contacts) });
    })();

    socket.on('disconnect', () => {
      void (async () => {
        if (!markOffline(me).becameOffline) return;
        for (const contact of await contactIdsOf(userId)) {
          io.to(userRoom(contact)).emit('presence', { userId: me, online: false });
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
        });

        // A TODOS los miembros (incluido el autor: sus otros dispositivos
        // también tienen que ver el mensaje).
        const members = await avisarMensajeNuevo(result.message);
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
            onReply: async (reply) => {
              const destinatarios = await chatMemberIds(reply.chatId);
              for (const member of destinatarios) {
                io.to(userRoom(member)).emit('msg.new', toClientMessage(reply));
              }
              void notifyOffline({
                message: reply,
                members: destinatarios,
                senderId: String(reply.senderId),
              }).catch((error) =>
                console.error('[push] no se pudo avisar la respuesta:', error?.message ?? error)
              );
            },
          }).catch((error) => console.error('[lila] mención falló:', error?.message ?? error));
        }
      } catch (error) {
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
    const reenviarSeñal = (evento: string) =>
      socket.on(evento, async (frame: unknown) => {
        const payload = (frame ?? {}) as { chatId?: string; [k: string]: unknown };
        if (!payload.chatId || !Types.ObjectId.isValid(payload.chatId)) return;

        try {
          const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
          if (!members.includes(String(userId))) return;

          for (const member of members) {
            // A MÍ NO: recibir mi propia oferta haría que el teléfono se llame
            // a sí mismo. A mis otros dispositivos tampoco — el que contesta es
            // el que tiene la llamada, y duplicarla haría sonar dos.
            if (member === String(userId)) continue;
            io.to(userRoom(member)).emit(evento, { ...payload, from: String(userId) });
          }
        } catch {
          // Un chat inválido no tira la conexión: la señalización es best-effort
          // y el que llama ya tiene su propio tiempo de espera.
        }
      });

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
        }
        ack?.({ ok: true });
      } catch (error) {
        console.error('[chat] no se pudo eliminar:', (error as Error).message);
        ack?.({ ok: false, motivo: 'No se pudo eliminar.' });
      }
    });

    socket.on('read.set', async (frame: unknown) => {
      const payload = (frame ?? {}) as { chatId?: string; seq?: number };
      if (!payload.chatId || typeof payload.seq !== 'number') return;
      try {
        await markRead({ chatId: payload.chatId, userId, seq: payload.seq });
        const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
        for (const member of members) {
          io.to(userRoom(member)).emit('receipt', {
            chatId: payload.chatId,
            userId: String(userId),
            readSeq: payload.seq,
            // Leer implica entregado: sin esto el doble check gris nunca se
            // pondria azul si el otro ya lo tenia como entregado.
            deliveredSeq: payload.seq,
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
        await markDelivered({ chatId: payload.chatId, userId, seq: payload.seq });
        const members = await chatMemberIds(new Types.ObjectId(payload.chatId));
        for (const member of members) {
          io.to(userRoom(member)).emit('receipt', {
            chatId: payload.chatId,
            userId: String(userId),
            deliveredSeq: payload.seq,
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
