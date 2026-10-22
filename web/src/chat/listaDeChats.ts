import { contarChats, filtrarChats, ordenarChats, separarArchivados, type FiltroDeChats } from '@lilachat/shared';
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

export type ListaArmada = {
  visibles: ChatSummary[];
  cuentas: ReturnType<typeof contarChats>;
  /** La fila «Archivados»: cuántos hay y cuántos con algo sin leer. */
  archivados: { total: number; sinLeer: number };
};

const filtrable = (chat: ChatSummary) => ({
  chat,
  id: chat.id,
  titulo: chat.name ?? chat.phone ?? '',
  ultimo: chat.lastMessage?.body,
  esGrupo: chat.kind === 'group',
  esBorrador: chat.kind === 'notas',
  sinLeer: chat.unread,
  marcadoNoLeido: chat.markedUnread,
  archivado: chat.archived,
});

/**
 * Lo que muestra la lista (W3a): la principal o «Archivados», filtrada por el
 * chip y el buscador con los motores de la app (`filtrarChats`, `contarChats`).
 * Las cuentas de los chips son de la principal, sin la búsqueda: dicen cuántos
 * hay, no cuántos coinciden.
 */
export function buildChatList(params: { chats: readonly ChatSummary[]; filtro: FiltroDeChats; texto: string; verArchivados: boolean; lista?: ReadonlySet<string> }): ListaArmada {
  const { principales, archivados } = separarArchivados(params.chats.map(filtrable));
  const ordenar = (filas: typeof principales) => {
    const porId = new Map(filas.map((fila) => [fila.chat.id, fila]));
    const orden = params.verArchivados ? ordenarPorRecencia(filas.map((fila) => fila.chat)) : ordenarParaLaLista(filas.map((fila) => fila.chat));
    return orden.map((chat) => porId.get(chat.id)!);
  };
  const fuente = params.verArchivados ? archivados : principales;
  const filtradas = filtrarChats({ chats: ordenar(fuente), filtro: params.verArchivados ? 'todos' : params.filtro, texto: params.texto, lista: params.lista });
  return {
    visibles: filtradas.map((fila) => fila.chat),
    cuentas: contarChats(principales),
    archivados: { total: archivados.length, sinLeer: archivados.filter((fila) => fila.sinLeer > 0 || fila.marcadoNoLeido).length },
  };
}

const ordenarPorRecencia = (chats: ChatSummary[]): ChatSummary[] =>
  [...chats].sort((a, b) => (Date.parse(b.lastMessage?.at ?? '') || 0) - (Date.parse(a.lastMessage?.at ?? '') || 0));
