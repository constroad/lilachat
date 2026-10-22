import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatList } from '@lilachat/shared';
import { createChatList, deleteChatList, listChatLists, updateChatList } from '../../api/client';
import { getSocket } from '../socketClient';
import { useAlVolver } from '../../ui/useAlVolver';

export type ListOutcome = { ok: true; list?: ChatList } | { ok: false; message: string };

const cacheKey = (userId: string) => `lilachat.chatLists.${userId}`;
const NETWORK_TEXT = 'Sin conexión: no se guardó. Prueba de nuevo.';

const failure = (response: { status: number | 'network'; message?: string }): ListOutcome => ({
  ok: false,
  message: response.status === 'network' ? NETWORK_TEXT : (response.message ?? 'No se pudo guardar la lista.'),
});

/**
 * My lists of chats (pending 45): painted at once from the copy on the phone,
 * then read from the server, and again when another device of mine changes
 * them (`chatLists.changed`) or the app comes back.
 */
export function useChatLists(params: { jwt: string; userId: string }) {
  const { jwt, userId } = params;
  const [lists, setLists] = useState<ChatList[]>([]);

  const keep = useCallback((next: ChatList[]) => {
    setLists(next);
    void AsyncStorage.setItem(cacheKey(userId), JSON.stringify(next)).catch(() => undefined);
  }, [userId]);

  const reload = useCallback(async () => {
    const response = await listChatLists(jwt);
    // An answer without lists (an older server) leaves none, never a broken list.
    if (response.ok) keep(Array.isArray(response.data?.lists) ? response.data.lists : []);
  }, [jwt, keep]);

  useEffect(() => {
    void AsyncStorage.getItem(cacheKey(userId)).then((saved) => {
      if (saved) setLists((current) => (current.length > 0 ? current : (JSON.parse(saved) as ChatList[])));
    }).catch(() => undefined);
    void reload();
  }, [userId, reload]);

  useEffect(() => {
    const socket = getSocket();
    const onChanged = () => void reload();
    socket?.on('chatLists.changed', onChanged);
    return () => {
      socket?.off('chatLists.changed', onChanged);
    };
  }, [reload]);
  useAlVolver(true, () => void reload());

  const create = useCallback(async (name: string, chatIds: string[]): Promise<ListOutcome> => {
    const response = await createChatList(jwt, name, chatIds);
    if (!response.ok) return failure(response);
    keep([...lists, response.data.list]);
    return { ok: true, list: response.data.list };
  }, [jwt, keep, lists]);

  const update = useCallback(async (listId: string, change: { name?: string; add?: string[]; remove?: string[] }): Promise<ListOutcome> => {
    const response = await updateChatList(jwt, listId, change);
    if (!response.ok) return failure(response);
    keep(lists.map((list) => (list.id === listId ? response.data.list : list)));
    return { ok: true, list: response.data.list };
  }, [jwt, keep, lists]);

  const remove = useCallback(async (listId: string): Promise<ListOutcome> => {
    const response = await deleteChatList(jwt, listId);
    if (!response.ok) return failure(response);
    keep(lists.filter((list) => list.id !== listId));
    return { ok: true };
  }, [jwt, keep, lists]);

  return { lists, create, update, remove };
}
