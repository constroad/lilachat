import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { diffListChats, type ChatList } from '@lilachat/shared';
import { useChatLists } from './useChatLists';
import { ChatListEditor, type ListChat } from './ChatListEditor';
import { AddToListSheet } from './AddToListSheet';

/** The editor open: a new list (maybe with chosen chats) or one to edit. */
type Editing = { list: ChatList | null; initialChatIds: string[] } | null;

/**
 * Everything the chat list needs for lists of my own (pending 45), kept out of
 * `ChatListScreen`: the lists (sections since R154, pending 62), the editor
 * and «Mover a sección» for the chosen chats.
 */
export function useChatListsUi(params: {
  jwt: string;
  userId: string;
  chats: readonly ListChat[];
  selectedIds: readonly string[];
  onSelectionDone: () => void;
}) {
  const { lists, create, update, remove } = useChatLists({ jwt: params.jwt, userId: params.userId });
  const [editing, setEditing] = useState<Editing>(null);
  const [addingTo, setAddingTo] = useState<string[] | null>(null);

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
    if (!outcome.ok) Alert.alert('No se pudo cambiar la sección', outcome.message);
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
    openNew: () => openNew(),
    openEdit,
    openAddTo: () => setAddingTo([...params.selectedIds]),
    sheets,
  };
}
