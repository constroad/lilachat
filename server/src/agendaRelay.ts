import { randomUUID } from 'node:crypto';
import type { Server as SocketServer, Socket } from 'socket.io';
import { cleanNamesReply, cleanPhonesRequest, esDispositivoVinculado } from '@lilachat/shared';

/** A request waits this long for the phone; after that the answer has nowhere to go. */
const REQUEST_TTL_MS = 30_000;

type Pending = { socketId: string; userId: string; phones: Set<string> };
const pending = new Map<string, Pending>();

/**
 * Contacts on the web (José, 20/10, option «b»): the linked web asks for names
 * (`agenda.pedir`), the request goes ONLY to that user's phones
 * (`agenda.pedido`), the phone answers (`agenda.respuesta`) and the names reach
 * the web that asked (`agenda.nombres`). Nothing is written anywhere: with the
 * phone offline, the web keeps showing what it already had.
 */
export function registerAgendaRelay(io: SocketServer, socket: Socket & { deviceId?: string }, userId: string, userRoom: string): void {
  const isWeb = Boolean(socket.deviceId && esDispositivoVinculado(socket.deviceId));

  socket.on('agenda.pedir', (payload: { phones?: unknown } | undefined) => {
    if (!isWeb) return;
    const phones = cleanPhonesRequest(payload?.phones);
    if (phones.length === 0) return;
    const requestId = randomUUID();
    pending.set(requestId, { socketId: socket.id, userId, phones: new Set(phones) });
    setTimeout(() => pending.delete(requestId), REQUEST_TTL_MS).unref?.();
    for (const id of io.sockets.adapter.rooms.get(userRoom) ?? []) {
      const phone = io.sockets.sockets.get(id) as (Socket & { deviceId?: string }) | undefined;
      if (phone?.deviceId && !esDispositivoVinculado(phone.deviceId)) phone.emit('agenda.pedido', { requestId, phones });
    }
  });

  socket.on('agenda.respuesta', (payload: { requestId?: unknown; nombres?: unknown } | undefined) => {
    if (isWeb) return;
    const request = pending.get(String(payload?.requestId ?? ''));
    if (!request || request.userId !== userId) return;
    pending.delete(String(payload?.requestId));
    const names = cleanNamesReply(payload?.nombres, request.phones);
    io.to(request.socketId).emit('agenda.nombres', { nombres: names });
  });
}
