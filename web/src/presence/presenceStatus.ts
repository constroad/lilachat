import { useSyncExternalStore } from 'react';
import type { PresenceStatus } from '@lilachat/shared';

/**
 * «Ausente» or «Ocupado» of the people I share chats with (pending 15), from
 * the same presence frames as «online» (`useSocket` hands them here).
 */
let statuses: ReadonlyMap<string, PresenceStatus> = new Map();
const listeners = new Set<() => void>();
const publish = (next: ReadonlyMap<string, PresenceStatus>) => {
  statuses = next;
  listeners.forEach((listener) => listener());
};

export function receivePresenceSnapshot(frame: { statuses?: Record<string, PresenceStatus> } | undefined): void {
  publish(new Map(Object.entries(frame?.statuses ?? {})));
}

export function receivePresence(frame: { userId: string; online: boolean; status?: PresenceStatus }): void {
  const next = new Map(statuses);
  if (frame.online && frame.status) next.set(frame.userId, frame.status);
  else next.delete(frame.userId);
  publish(next);
}

export const usePresenceStatus = (userId: string | null | undefined): PresenceStatus | undefined =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (userId ? statuses.get(userId) : undefined)
  );
