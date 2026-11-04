import { useEffect, useRef } from 'react';
import { nextVoiceMessage } from '@lilachat/shared';
import { setVoiceNoteQueue, type QueuedVoiceNote } from './voicePlayer';
import type { MensajeEnPantalla } from './types';

type QueueSource = { chatId: string; messages: readonly MensajeEnPantalla[]; names: ReadonlyMap<string, string> };

export function noteAfter(finishedId: string, { chatId, messages, names }: QueueSource): QueuedVoiceNote | null {
  const next = nextVoiceMessage(messages, finishedId, chatId);
  if (!next?.media?.url) return null;
  return { id: `${chatId}:${next.seq}`, chatId, url: next.media.url, authorName: names.get(next.senderId) ?? 'Nota de voz', durationS: (next.media.durationMs ?? 0) / 1000 };
}

/**
 * Voice notes in a row play one after the other (José, 04/11), told by the chat
 * on screen. It is not undone on leaving: a note that goes on outside the chat
 * still finds its next one, and the next chat opened takes over.
 */
export function useVoiceNoteQueue(source: QueueSource): void {
  const latest = useRef(source);
  latest.current = source;
  useEffect(() => setVoiceNoteQueue((finishedId) => noteAfter(finishedId, latest.current)), []);
}
