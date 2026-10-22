import { visibleEnElChat, type MessageWindow } from '@lilachat/shared';
import { isPending, type Row } from './rowKinds';
import type { ChatMessage } from './useChat';

/**
 * The rows on screen while a window around an old message is open (pending
 * 44): the window, without thread replies that live only in their thread. Once
 * it reached the end (`hasNewer` false), the live rows after it continue below
 * — what arrives and what I am sending keep showing.
 */
export function windowRows(opened: MessageWindow<ChatMessage>, liveRows: readonly Row[]): Row[] {
  const shown: Row[] = opened.messages.filter(visibleEnElChat);
  if (opened.hasNewer) return shown;
  const lastSeq = opened.messages[opened.messages.length - 1]?.seq ?? 0;
  return [...shown, ...liveRows.filter((row) => isPending(row) || row.seq > lastSeq)];
}
