/** The newest nudge from someone else after `seenSeq`, or `null` (backlog 3: it shakes once, on arrival). */
export function nudgeToShake(messages: readonly { seq: number; kind?: string; senderId: string }[], me: string, seenSeq: number): number | null {
  let newest: number | null = null;
  for (const message of messages) {
    if (message.seq > seenSeq && message.kind === 'zumbido' && message.senderId !== me) newest = Math.max(newest ?? 0, message.seq);
  }
  return newest;
}

/** Highest `seq` in the list: what was already there when the chat opened does not shake. */
export const highestSeq = (messages: readonly { seq: number }[]): number => messages.reduce((max, message) => Math.max(max, message.seq), 0);
