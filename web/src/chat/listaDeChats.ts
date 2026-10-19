import { ordenarChats, separarArchivados } from '@lilachat/shared';
import type { ChatSummary } from './types';

/**
 * La lista principal (W1): la base guarda los chats por id, así que el orden
 * se arma acá con el motor compartido — fijados arriba, el resto por recencia —
 * y sin los archivados.
 */
export function ordenarParaLaLista(chats: readonly ChatSummary[]): ChatSummary[] {
  const { principales } = separarArchivados(chats.map((chat) => ({ ...chat, archivado: chat.archived })));
  const conOrden = principales.map((chat) => ({
    chat,
    pinned: Boolean(chat.pinned),
    fechaOrden: chat.lastMessage ? Date.parse(chat.lastMessage.at) || 0 : 0,
  }));
  return ordenarChats(conOrden).map(({ chat }) => {
    const { archivado: _archivado, ...limpio } = chat;
    return limpio;
  });
}
