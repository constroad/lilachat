import { useCallback, useEffect, useState } from 'react';
import type { ChatList } from '@lilachat/shared';
import { api } from '../../api';
import { subscribeChatListsChanged } from './chatListsEvents';

export type ListOutcome = { ok: true; list?: ChatList } | { ok: false; message: string };

/** The last answer, per session: reopening the panel paints the chips at once. */
let remembered: { jwt: string; lists: ChatList[] } | null = null;

/**
 * My lists of chats on the web (pending 45): the same ones as the phone, read
 * again when another device of mine changes them.
 */
export function useChatListsWeb(jwt: string) {
  const [lists, setLists] = useState<ChatList[]>(() => (remembered?.jwt === jwt ? remembered.lists : []));

  const keep = useCallback((next: ChatList[]) => {
    remembered = { jwt, lists: next };
    setLists(next);
  }, [jwt]);

  const reload = useCallback(async () => {
    const response = await api<{ lists: ChatList[] }>('/chat-lists', { jwt });
    // An answer without lists (an older server) leaves none, never a broken panel.
    if (response.ok) keep(Array.isArray(response.data?.lists) ? response.data.lists : []);
  }, [jwt, keep]);

  useEffect(() => {
    void reload();
    return subscribeChatListsChanged(() => void reload());
  }, [reload]);

  const create = useCallback(async (name: string, chatIds: string[]): Promise<ListOutcome> => {
    const response = await api<{ list: ChatList }>('/chat-lists', { jwt, body: { name, chatIds } });
    if (!response.ok) return { ok: false, message: response.message };
    keep([...lists, response.data.list]);
    return { ok: true, list: response.data.list };
  }, [jwt, keep, lists]);

  const update = useCallback(async (listId: string, change: { name?: string; add?: string[]; remove?: string[] }): Promise<ListOutcome> => {
    const response = await api<{ list: ChatList }>(`/chat-lists/${listId}`, { jwt, method: 'PATCH', body: change });
    if (!response.ok) return { ok: false, message: response.message };
    keep(lists.map((list) => (list.id === listId ? response.data.list : list)));
    return { ok: true, list: response.data.list };
  }, [jwt, keep, lists]);

  const remove = useCallback(async (listId: string): Promise<ListOutcome> => {
    const response = await api<{ ok: true }>(`/chat-lists/${listId}`, { jwt, method: 'DELETE' });
    if (!response.ok) return { ok: false, message: response.message };
    keep(lists.filter((list) => list.id !== listId));
    return { ok: true };
  }, [jwt, keep, lists]);

  return { lists, create, update, remove };
}
