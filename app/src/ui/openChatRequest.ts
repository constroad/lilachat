import type { ChatSummary } from '../api/client';

/**
 * «Open this chat» from anywhere in the session (pending 9: «Enviar mensaje»
 * on a shared contact). The session navigation listens and opens it the way a
 * notification does: replacing the chat on screen, so «back» goes to the list.
 *
 * `known` is the chat when whoever asks already has it. A 1:1 just created in a
 * company space is not in the personal list the lookup reads, and the server's summary
 * says neither its space nor its app (José, 25/10/2026: «Enviar mensaje» did nothing).
 */
type OpenChatListener = (chatId: string, known?: ChatSummary) => void;

const listeners = new Set<OpenChatListener>();

export function requestOpenChat(chatId: string, known?: ChatSummary): void {
  listeners.forEach((listener) => listener(chatId, known));
}

export function subscribeOpenChatRequests(listener: OpenChatListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
