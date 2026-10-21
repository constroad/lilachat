import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * Who is online, for the screens outside the chat list (the space directory
 * and profile, e1-08/e1-09). Installed on the socket when it is created, so it
 * catches the snapshot the server sends on connecting.
 */
let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const publish = (next: ReadonlySet<string>) => {
  online = next;
  listeners.forEach((listener) => listener());
};

export function listenPresence(socket: Socket): void {
  socket.on('presence.snapshot', (frame: { online?: string[] }) => publish(new Set(frame.online ?? [])));
  socket.on('presence', (frame: { userId: string; online: boolean }) => {
    const next = new Set(online);
    if (frame.online) next.add(frame.userId);
    else next.delete(frame.userId);
    publish(next);
  });
}

export const useOnlineIds = (): ReadonlySet<string> =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => online
  );
