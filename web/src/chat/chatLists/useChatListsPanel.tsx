import { useCallback, useMemo, useState } from 'react';
import type { ChatList } from '@lilachat/shared';
import type { ChatSummary } from '../types';
import { useChatListsWeb } from './useChatListsWeb';
import { ChatListDialog } from './ChatListDialog';
import { AddToListDialog } from './AddToListDialog';

type Editing = { list: ChatList | null; initialChatIds: string[] } | null;

const titleOf = (chat: ChatSummary) => chat.name ?? chat.phone ?? 'Conversación';

/**
 * Lists of my own in the web's chat panel (pending 45), kept out of
 * `ChatList`: the lists (sections since R154, pending 62), the editor and
 * «Mover a sección» from a chat's menu.
 */
export function useChatListsPanel(params: { jwt: string; chats: readonly ChatSummary[] }) {
  const { lists, create, update, remove } = useChatListsWeb(params.jwt);
  const [editing, setEditing] = useState<Editing>(null);
  const [addingTo, setAddingTo] = useState<ChatSummary | null>(null);

  const openEdit = useCallback((listId: string) => {
    const list = lists.find((one) => one.id === listId);
    if (list) setEditing({ list, initialChatIds: [] });
  }, [lists]);

  const chatsForLists = useMemo(() => params.chats.map((chat) => ({ id: chat.id, title: titleOf(chat) })), [params.chats]);

  const dialogs = (
    <>
      {editing ? (
        <ChatListDialog
          key={editing.list?.id ?? 'new'}
          list={editing.list}
          lists={lists}
          chats={chatsForLists}
          initialChatIds={editing.initialChatIds}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {addingTo ? (
        <AddToListDialog
          chatId={addingTo.id}
          chatTitle={titleOf(addingTo)}
          lists={lists}
          onToggle={(list, putIn) => void update(list.id, putIn ? { add: [addingTo.id] } : { remove: [addingTo.id] })}
          onNewList={() => {
            setEditing({ list: null, initialChatIds: [addingTo.id] });
            setAddingTo(null);
          }}
          onClose={() => setAddingTo(null)}
        />
      ) : null}
    </>
  );

  return {
    lists,
    openNew: () => setEditing({ list: null, initialChatIds: [] }),
    openEdit,
    openAddTo: setAddingTo,
    dialogs,
  };
}
