import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import type { PresenceStatus } from '@lilachat/shared';

/**
 * «Ausente» or «Ocupado» of the people I share chats with (pending 15). It
 * rides on the same presence frames as «online», in its own store so the
 * screens that only draw the green dot do not change.
 */
let statuses: ReadonlyMap<string, PresenceStatus> = new Map();
const listeners = new Set<() => void>();
const publish = (next: ReadonlyMap<string, PresenceStatus>) => {
  statuses = next;
  listeners.forEach((listener) => listener());
};

export function listenPresenceStatus(socket: Socket): void {
  socket.on('presence.snapshot', (frame: { statuses?: Record<string, PresenceStatus> }) => publish(new Map(Object.entries(frame.statuses ?? {}))));
  socket.on('presence', (frame: { userId: string; online: boolean; status?: PresenceStatus }) => {
    const next = new Map(statuses);
    if (frame.online && frame.status) next.set(frame.userId, frame.status);
    else next.delete(frame.userId);
    publish(next);
  });
}

export const usePresenceStatus = (userId: string | null | undefined): PresenceStatus | undefined =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (userId ? statuses.get(userId) : undefined)
  );
