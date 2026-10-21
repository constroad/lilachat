import { listChats, type ChatSummary } from '../api/client';
import { chatsEnMemoria, leerChatsGuardados } from '../chat/chatsGuardados';

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
