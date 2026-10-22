/**
 * The newest nudge or wink each chat already reached in this session (José,
 * 22/10: Lila's bear played on every visit to her chat). The chat opens from
 * the list's read cursor, and that cursor can lag behind what was seen here: a
 * row loaded before the wink, or a list that remounts. This floor keeps a wink
 * from playing on its own twice. «Ver otra vez» does not go through it.
 */
const seenByChat = new Map<string, number>();

export function funSeenFloor(chatId: string, readSeqAtOpen: number): number {
  return Math.max(readSeqAtOpen, seenByChat.get(chatId) ?? 0);
}

export function rememberFunSeen(chatId: string, seq: number): void {
  if (seq > (seenByChat.get(chatId) ?? 0)) seenByChat.set(chatId, seq);
}
