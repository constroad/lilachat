import { Types } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { valorDeLlamada } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { escribirAviso } from './chatService.js';
import { publicarAviso } from './reparto.js';
import { createGroupCallHub, type GroupCallHub } from './groupCalls.js';

/** The real hub (pending 56): chats from the base, frames by socket, the line in the chat at the end. */
export function buildGroupCallHub(io: Server, userRoom: (userId: string) => string): GroupCallHub {
  return createGroupCallHub({
    access: async (chatId, userId) => {
      if (!Types.ObjectId.isValid(chatId)) return null;
      const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': new Types.ObjectId(userId) })
        .select('kind encrypted members.userId')
        .lean<{ kind?: string; encrypted?: boolean; members: { userId: Types.ObjectId }[] } | null>();
      if (!chat) return null;
      return { members: chat.members.map((member) => String(member.userId)), isGroup: chat.kind === 'group' && chat.encrypted !== true };
    },
    emitToUser: (userId, event, frame) => void io.to(userRoom(userId)).emit(event, frame),
    emitToSocket: (socketId, event, frame) => void io.to(socketId).emit(event, frame),
    nameOf: async (userId) => (await UserModel.findById(userId).select('name').lean<{ name?: string } | null>())?.name ?? null,
    writeEnd: async (chatId, end, members) => {
      const message = await escribirAviso({
        chatId,
        quien: new Types.ObjectId(end.startedBy),
        evento: 'llamada',
        valor: valorDeLlamada({ video: end.video, segundos: end.seconds, personas: end.people }),
        body: `${end.video ? 'Videollamada' : 'Llamada'} grupal · ${end.people} personas`,
      });
      if (message) await publicarAviso(message, members);
    },
  });
}

type Ack = (answer: unknown) => void;
const chatIdOf = (frame: unknown) => String((frame as { chatId?: unknown } | null)?.chatId ?? '');

/** The four events of a group call on one socket, and leaving every room when it goes away. */
export function registerGroupCallEvents(socket: Socket, userId: string, hub: GroupCallHub): void {
  const fail = (ack: Ack | undefined, error: unknown) => {
    console.warn('[llamada grupal]', error instanceof Error ? error.message : error);
    ack?.({ ok: false, motivo: 'No se pudo. Inténtalo de nuevo.' });
  };
  socket.on('groupcall.join', (frame: unknown, ack?: Ack) => {
    const video = (frame as { video?: unknown } | null)?.video === true;
    void hub.join({ socketId: socket.id, userId, chatId: chatIdOf(frame), video }).then((answer) => ack?.(answer), (error) => fail(ack, error));
  });
  socket.on('groupcall.leave', (frame: unknown, ack?: Ack) => {
    void hub.leave({ socketId: socket.id, userId, chatId: chatIdOf(frame) }).then(() => ack?.({ ok: true }), (error) => fail(ack, error));
  });
  socket.on('groupcall.signal', (frame: unknown) => void hub.signal({ userId, frame }));
  socket.on('groupcall.get', (frame: unknown, ack?: Ack) => {
    void hub.roomOf(chatIdOf(frame), userId).then((room) => ack?.({ ok: true, room }), (error) => fail(ack, error));
  });
  socket.on('disconnect', () => void hub.dropSocket(socket.id, userId).catch((error) => console.warn('[llamada grupal] al salir:', error)));
}
