import { listChats, type ChatSummary } from '../api/client';
import { chatsEnMemoria, leerChatsGuardados } from '../chat/chatsGuardados';
import { findSpaceChat } from '../spaces/spacesApi';

/**
 * Un chat por su id, para abrirlo desde afuera de la lista (un aviso, un
 * destacado): primero lo que hay en memoria o en el teléfono, y si no, el server.
 */
export async function buscarChat(chatId: string, jwt: string): Promise<ChatSummary | null> {
  const enMano = chatsEnMemoria() ?? (await leerChatsGuardados());
  const conocido = enMano?.find((chat) => chat.id === chatId);
  if (conocido) return conocido;
  const respuesta = await listChats(jwt);
  return respuesta.ok ? (respuesta.data.chats.find((chat) => chat.id === chatId) ?? null) : null;
}

/**
 * The chat a notice leads to (agentes 25/10/2026). One of a space is not in the
 * personal list `buscarChat` reads: the space is asked for it.
 */
export async function findNoticeChat(destination: { chatId: string; workspaceId?: string }, jwt: string): Promise<ChatSummary | null> {
  if (!destination.workspaceId) return buscarChat(destination.chatId, jwt);
  const inMemory = chatsEnMemoria()?.find((chat) => chat.id === destination.chatId);
  return inMemory ?? findSpaceChat(jwt, destination.workspaceId, destination.chatId);
}
