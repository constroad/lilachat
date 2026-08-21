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
} from './chatService.js';
import { toClientMessage, toClientMessages } from './messageView.js';
import { markOffline, markOnline, onlineAmong } from './presence.js';
import { notifyOffline } from './pushService.js';
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

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    // El cliente es nuestra app y nuestra web; no hay terceros embebiéndonos.
    cors: { origin: false },
    // Un mensaje de texto no pesa; el techo evita que un cliente roto empuje
    // megabytes por el socket.
    maxHttpBufferSize: 1e6,
  });

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
          replyToSeq: typeof payload.replyToSeq === 'number' ? payload.replyToSeq : undefined,
        });

        // A TODOS los miembros (incluido el autor: sus otros dispositivos
        // también tienen que ver el mensaje).
        const members = await chatMemberIds(result.message.chatId);
        for (const member of members) {
          io.to(userRoom(member)).emit('msg.new', toClientMessage(result.message));
        }
        // Push SOLO a quien no tiene socket vivo. Un duplicado no se re-notifica:
        // ya se avisó cuando el mensaje se creó de verdad.
        if (!result.duplicate) {
          void notifyOffline({ message: result.message, members, senderId: me });
        }
        ack?.({ ok: true, seq: result.message.seq, duplicate: result.duplicate });
      } catch (error) {
        const forbidden = error instanceof ForbiddenChatError;
        // 403 es PERMANENTE para la cola del cliente: descarta con motivo en
        // vez de reintentar para siempre (anti-wedge del outbox).
        ack?.({ ok: false, status: forbidden ? 403 : 500, message: forbidden ? error.message : undefined });
      }
    });

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
          });
        }
      } catch {
        // Un acuse que no se pudo guardar no rompe la sesión: el próximo lo
        // arregla, porque es un cursor y no un incremento.
      }
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
