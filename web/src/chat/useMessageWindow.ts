import { useCallback, useEffect, useRef, useState } from 'react';
import { extendWindow, nextWindowPage, targetStatus, windowFromPage, type MessageWindow, type WindowSide } from '@lilachat/shared';
import { api } from '../api';
import type { ChatMessage } from './types';

const PAGE = 50;
type Page = { messages: ChatMessage[]; lastSeq: number; hasOlder?: boolean; hasNewer?: boolean };
/** `thread`: the message is a reply that lives only in its thread; `root` opens it. */
export type JumpResult = { status: 'shown' | 'missing' | 'error' } | { status: 'thread'; root: number };

/**
 * An old message opened with its context (pending 44, José 22/10), like
 * WhatsApp Web: a window around it from the server, paged up and down, apart
 * from the live end. It lives in memory only: written to the local base it
 * would show glued to the live end with a hole in the middle. `viewId` changes
 * when the window opens or closes: the list remounts and places itself again.
 */
export function useMessageWindow(jwt: string, chatId: string) {
  const [opened, setOpened] = useState<MessageWindow<ChatMessage> | null>(null);
  const [viewId, setViewId] = useState(0);
  const loading = useRef<WindowSide | 'jump' | null>(null);
  const current = useRef(opened);
  current.current = opened;

  useEffect(() => {
    setOpened(null);
  }, [chatId]);

  const ask = useCallback(async (query: string): Promise<Page | null> => {
    const response = await api<Page>(`/chats/${chatId}/messages?${query}&limit=${PAGE}`, { jwt }).catch(() => null);
    return response?.ok ? response.data : null;
  }, [jwt, chatId]);

  const jumpTo = useCallback(async (seq: number): Promise<JumpResult> => {
    if (loading.current) return { status: 'error' };
    loading.current = 'jump';
    const page = await ask(`around=${seq}`);
    loading.current = null;
    const made = page ? windowFromPage(page, seq) : null;
    if (!made) return { status: page ? 'missing' : 'error' };
    const status = targetStatus(made, seq);
    if (status === 'thread') return { status, root: made.messages.find((message) => message.seq === seq)?.hiloDe ?? seq };
    if (status === 'missing') return { status };
    setOpened(made);
    setViewId((before) => before + 1);
    return { status: 'shown' };
  }, [ask]);

  const load = useCallback(async (side: WindowSide) => {
    const open = current.current;
    const next = open ? nextWindowPage(open, side) : null;
    if (!open || !next || loading.current) return;
    loading.current = side;
    const page = await ask('beforeSeq' in next ? `beforeSeq=${next.beforeSeq}` : `afterSeq=${next.afterSeq}`);
    loading.current = null;
    if (!page) return;
    // `beforeSeq` brings no flags: a short page means the beginning was reached.
    const more = side === 'older' ? page.messages.length >= PAGE : page.hasNewer ?? page.messages.length >= PAGE;
    setOpened((before) => (before ? extendWindow(before, side, { messages: page.messages, more }) : before));
  }, [ask]);

  const close = useCallback(() => {
    if (!current.current) return;
    setOpened(null);
    setViewId((before) => before + 1);
  }, []);

  return { window: opened, viewId, jumpTo, loadOlder: () => load('older'), loadNewer: () => load('newer'), close };
}
