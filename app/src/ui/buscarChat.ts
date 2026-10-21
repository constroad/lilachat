import { listChats, type ChatSummary } from '../api/client';
import { chatsEnMemoria, leerChatsGuardados } from '../chat/chatsGuardados';
import { spaceChats } from '../spaces/spacesApi';

/**
 * Un chat por su id, para abrirlo desde afuera de la lista (un aviso, un
 * destacado): primero lo que hay en memoria o en el teléfono, y si no, el server.
 */
export async function buscarChat(chatId: string, jwt: string, spaceId?: string | null): Promise<ChatSummary | null> {
  const enMano = chatsEnMemoria() ?? (await leerChatsGuardados());
  const conocido = enMano?.find((chat) => chat.id === chatId);
  if (conocido) return conocido;
  // A chat of a company space is not in the personal list (E1).
  const respuesta = spaceId ? await spaceChats(jwt, spaceId) : await listChats(jwt);
  return respuesta.ok ? (respuesta.data.chats.find((chat) => chat.id === chatId) ?? null) : null;
}
