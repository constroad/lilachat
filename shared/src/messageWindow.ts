import { visibleEnElChat } from './hilos.js';
import { mergeBySeq } from './sync.js';

/**
 * A stretch of a conversation around an old message, apart from its live end
 * (pending 44, José 22/10: «Ese mensaje está más arriba: sube para cargarlo»).
 * Like WhatsApp Web and Telegram: it pages up and down, and when its bottom
 * reaches the live end it melts into it. The live list never gets a stretch
 * glued to it with a hole in the middle. Pure: the app and the web keep it in
 * their state and ask the server (`around`, `beforeSeq`, `afterSeq`).
 */
export type MessageWindow<T extends { seq: number }> = { messages: T[]; target: number; hasOlder: boolean; hasNewer: boolean };
export type WindowSide = 'older' | 'newer';

export function windowFromPage<T extends { seq: number }>(page: { messages: T[]; hasOlder?: boolean; hasNewer?: boolean }, target: number): MessageWindow<T> | null {
  if (page.messages.length === 0) return null;
  return { messages: [...page.messages].sort((first, second) => first.seq - second.seq), target, hasOlder: page.hasOlder ?? true, hasNewer: page.hasNewer ?? true };
}

/** Whether the asked message is there, is a thread reply that lives only in its thread, or did not come (deleted, emptied). */
export function targetStatus<T extends { seq: number; hiloDe?: number; enElChat?: boolean }>(window: MessageWindow<T>, target: number): 'shown' | 'thread' | 'missing' {
  const found = window.messages.find((message) => message.seq === target);
  if (!found) return 'missing';
  return visibleEnElChat(found) ? 'shown' : 'thread';
}

/** The next page to ask for on one side, or `null` when that side is over. */
export function nextWindowPage<T extends { seq: number }>(window: MessageWindow<T>, side: WindowSide): { beforeSeq: number } | { afterSeq: number } | null {
  const edge = side === 'older' ? window.messages[0] : window.messages[window.messages.length - 1];
  if (!edge) return null;
  if (side === 'older') return window.hasOlder ? { beforeSeq: edge.seq } : null;
  return window.hasNewer ? { afterSeq: edge.seq } : null;
}

/** A page that came for one side, added to the window; `more` says whether that side has more. */
export function extendWindow<T extends { seq: number }>(window: MessageWindow<T>, side: WindowSide, page: { messages: T[]; more: boolean }): MessageWindow<T> {
  const flags = side === 'older' ? { hasOlder: page.more && page.messages.length > 0 } : { hasNewer: page.more && page.messages.length > 0 };
  return { ...window, messages: page.messages.length ? mergeBySeq(window.messages, page.messages) : window.messages, ...flags };
}

/** The window reaches the live end: it touches or overlaps it, or the server said nothing is newer. */
export function joinsLive<T extends { seq: number }>(window: MessageWindow<T>, liveOldestSeq: number | null): boolean {
  if (!window.hasNewer) return true;
  const last = window.messages[window.messages.length - 1];
  return liveOldestSeq !== null && last !== undefined && last.seq + 1 >= liveOldestSeq;
}

/** The live list now starts where the window started; in the overlap the live copy wins (it is newer). */
export function mergeIntoLive<T extends { seq: number }>(live: T[], window: MessageWindow<T>): T[] {
  return mergeBySeq(window.messages, live);
}

/** How many messages of others arrived live after the window opened: the badge of «Ir al último». */
export function newSinceWindow<T extends { seq: number; senderId: string }>(live: readonly T[], sinceSeq: number, me: string): number {
  // A pending message of mine sorts last with `MAX_SAFE_INTEGER`: it is not «new».
  return live.filter((message) => message.seq > sinceSeq && message.seq < Number.MAX_SAFE_INTEGER && message.senderId !== me).length;
}
