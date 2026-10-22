import { useEffect, useState } from 'react';
import { currentSocket } from '../useSocket';

/** How long to wait for the server's answer (ms): without it, the line stays empty. */
const LAST_SEEN_WAIT_MS = 8000;

/**
 * The other person's «últ. vez» in a 1:1, like the app (José, 21/10: the web
 * did not show it). Asked when the chat opens and on each reconnection; live,
 * the server's `presence` brings it when the other leaves.
 */
export function useLastSeen(otherId: string | null): string | undefined {
  const [lastSeen, setLastSeen] = useState<string>();
  useEffect(() => {
    setLastSeen(undefined);
    const socket = currentSocket();
    if (!otherId || !socket) return;
    let alive = true;
    const ask = async () => {
      if (!socket.connected) return;
      const answer = (await socket.timeout(LAST_SEEN_WAIT_MS).emitWithAck('presence.ultimaVez', { userId: otherId }).catch(() => null)) as { lastSeenAt?: string | null } | null;
      if (alive && answer?.lastSeenAt) setLastSeen(answer.lastSeenAt);
    };
    const onPresence = (frame: { userId: string; online: boolean; lastSeenAt?: string }) => {
      if (frame.userId === otherId && !frame.online && frame.lastSeenAt) setLastSeen(frame.lastSeenAt);
    };
    socket.on('presence', onPresence);
    socket.on('connect', ask);
    void ask();
    return () => {
      alive = false;
      socket.off('presence', onPresence);
      socket.off('connect', ask);
    };
  }, [otherId]);
  return lastSeen;
}
