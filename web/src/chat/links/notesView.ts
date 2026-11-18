import { useCallback, useEffect, useState } from 'react';
import type { ChatSummary } from '../types';

/**
 * «Chat · Por categoría» of a notes chat with its links sorted (José 18/11).
 * The chosen view is remembered per chat in this browser.
 */
export type NotesView = 'chat' | 'categories';

const STORAGE_PREFIX = 'lilachat.notesView.';
/** `lg` of Tailwind: from here the view has its categories column and the switch sits in the header. */
export const WIDE_SCREEN_QUERY = '(min-width: 1024px)';

export const showsLinkSorting = (chat: Pick<ChatSummary, 'kind' | 'linksSorted'>): boolean => chat.kind === 'notas' && chat.linksSorted === true;

export function readNotesView(chatId: string): NotesView {
  try {
    return localStorage.getItem(STORAGE_PREFIX + chatId) === 'categories' ? 'categories' : 'chat';
  } catch {
    return 'chat';
  }
}

export function saveNotesView(chatId: string, view: NotesView): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + chatId, view);
  } catch {
    // Private mode: the view lasts while the tab is open.
  }
}

/** The view of this chat; a chat without the switch is always «Chat». */
export function useNotesView(chat: Pick<ChatSummary, 'id' | 'kind' | 'linksSorted'>): [NotesView, (view: NotesView) => void] {
  const [view, setView] = useState<NotesView>(() => readNotesView(chat.id));
  useEffect(() => {
    setView(readNotesView(chat.id));
  }, [chat.id]);
  const choose = useCallback(
    (next: NotesView) => {
      setView(next);
      saveNotesView(chat.id, next);
    },
    [chat.id]
  );
  return [showsLinkSorting(chat) ? view : 'chat', choose];
}

/** The «+» of the categories view: back to the chat, writing. The composer mounts on the next frame. */
export function focusComposerSoon(): void {
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-testid="input-mensaje"]')?.focus());
}

const matchesWide = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(WIDE_SCREEN_QUERY).matches;

/** A computer's width (≥ 1024 px): the categories column, the grid and the switch in the header. */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(matchesWide);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(WIDE_SCREEN_QUERY);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return wide;
}
