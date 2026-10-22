/**
 * «Open this chat» from anywhere in the session (pending 9: «Enviar mensaje»
 * on a shared contact). The session navigation listens and opens it the way a
 * notification does: replacing the chat on screen, so «back» goes to the list.
 */
const listeners = new Set<(chatId: string) => void>();

export function requestOpenChat(chatId: string): void {
  listeners.forEach((listener) => listener(chatId));
}

export function subscribeOpenChatRequests(listener: (chatId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
