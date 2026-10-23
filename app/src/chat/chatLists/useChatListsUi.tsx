import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { diffListChats, listIdOf, type ChatList, type FiltroDeChats } from '@lilachat/shared';
import { useChatLists } from './useChatLists';
import { ChatListEditor, type ListChat } from './ChatListEditor';
import { AddToListSheet } from './AddToListSheet';

/** The editor open: a new list (maybe with chosen chats) or one to edit. */
type Editing = { list: ChatList | null; initialChatIds: string[] } | null;

/**
 * Everything the chat list needs for lists of my own (pending 45), kept out of
 * `ChatListScreen`: the chips' lists, the chats a list chip shows, the editor
 * and «Agregar a lista» for the chosen chats.
 */
export function useChatListsUi(params: {
  jwt: string;
  userId: string;
  chats: readonly ListChat[];
  selectedIds: readonly string[];
  filter: FiltroDeChats;
  onFilter: (filter: FiltroDeChats) => void;
  onSelectionDone: () => void;
}) {
  const { lists, create, update, remove } = useChatLists({ jwt: params.jwt, userId: params.userId });
  const [editing, setEditing] = useState<Editing>(null);
  const [addingTo, setAddingTo] = useState<string[] | null>(null);
  const { filter, onFilter } = params;

  const activeListId = listIdOf(filter);
  const activeChatIds = useMemo(() => {
    const active = lists.find((list) => list.id === activeListId);
    return active ? new Set(active.chatIds) : undefined;
  }, [lists, activeListId]);

  // The list on the chip was deleted (here or on another device): back to «Todos».
  useEffect(() => {
    if (activeListId && lists.length > 0 && !lists.some((list) => list.id === activeListId)) onFilter('todos');
  }, [activeListId, lists, onFilter]);

  const openNew = useCallback((initialChatIds: string[] = []) => setEditing({ list: null, initialChatIds }), []);
  const openEdit = useCallback((listId: string) => {
    const list = lists.find((one) => one.id === listId);
    if (list) setEditing({ list, initialChatIds: [] });
  }, [lists]);

  const save = async (name: string, chatIds: string[]) => {
    if (!editing?.list) return create(name, chatIds);
    const change = diffListChats(editing.list.chatIds, chatIds);
    return update(editing.list.id, { name, ...change });
  };

  const toggleIn = async (list: ChatList, putIn: boolean) => {
    const chatIds = addingTo ?? [];
    const outcome = await update(list.id, putIn ? { add: chatIds } : { remove: chatIds });
    if (!outcome.ok) Alert.alert('No se pudo cambiar la lista', outcome.message);
  };

  const closeAddTo = () => {
    setAddingTo(null);
    params.onSelectionDone();
  };

  const sheets = (
    <>
      <ChatListEditor
        visible={editing !== null}
        list={editing?.list ?? null}
        lists={lists}
        chats={params.chats}
        initialChatIds={editing?.initialChatIds}
        onSave={save}
        onDelete={editing?.list ? () => remove(editing.list!.id) : undefined}
        onClose={() => setEditing(null)}
      />
      <AddToListSheet
        visible={addingTo !== null}
        lists={lists}
        chatIds={addingTo ?? []}
        onToggle={(list, putIn) => void toggleIn(list, putIn)}
        onNewList={() => {
          const chosen = addingTo ?? [];
          closeAddTo();
          openNew(chosen);
        }}
        onClose={closeAddTo}
      />
    </>
  );

  return {
    lists,
    activeChatIds,
    openNew: () => openNew(),
    openEdit,
    openAddTo: () => setAddingTo([...params.selectedIds]),
    sheets,
  };
}
