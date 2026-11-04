import { useEffect, useRef } from 'react';
import { nextVoiceMessage } from '@lilachat/shared';
import { isPending, type Row } from './rowKinds';
import type { ChatMessage } from './useChat';
import { knownLocal } from './voiceNoteCache';
import { setVoiceNoteQueue, type QueuedVoiceNote } from './voicePlayer';

type QueueSource = { chatId: string; rows: readonly Row[]; names: ReadonlyMap<string, string>; photos: ReadonlyMap<string, string> };

export function noteAfter(finishedId: string, { chatId, rows, names, photos }: QueueSource): QueuedVoiceNote | null {
  const next = nextVoiceMessage(rows.filter((row): row is ChatMessage => !isPending(row)), finishedId, chatId);
  if (!next?.media?.url) return null;
  const { url, durationMs } = next.media;
  return { id: `${chatId}:${next.seq}`, url: knownLocal(url) ?? url, authorName: names.get(next.senderId) ?? 'Nota de voz', authorPhoto: photos.get(next.senderId), durationS: (durationMs ?? 0) / 1000 };
}

/**
 * Voice notes in a row play one after the other (José, 04/11), told by the chat
 * on screen. It is not undone on leaving: a note that goes on outside the chat
 * still finds its next one, and the next chat opened takes over.
 */
export function useVoiceNoteQueue(source: QueueSource): void {
  const latest = useRef(source);
  latest.current = source;
  useEffect(() => {
    setVoiceNoteQueue((finishedId) => noteAfter(finishedId, latest.current));
  }, []);
}
