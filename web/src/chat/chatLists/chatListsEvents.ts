/**
 * «My lists of chats changed» from the socket (another device of mine edited
 * them, pending 45), for whoever shows them. The socket lives in `useSocket`;
 * the lists in the chat list panel.
 */
const listeners = new Set<() => void>();

export function announceChatListsChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeChatListsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
