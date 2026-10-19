/**
 * Buscar y filtrar la lista de chats. PURO.
 *
 * José, 30/08/2026: «la lista de chats no tiene el buscador ni los filtros de no
 * leído, favoritos, etc.». El ícono de lupa estaba en la cabecera desde el
 * primer día **apagado**, esperando a «F6» — y un ícono inerte se ve igual que
 * uno roto.
 *
 * **No hay chip de «Favoritos» a propósito.** En esta app no existe marcar un
 * chat como favorito ni fijarlo; poner el chip para que no filtre nada sería
 * repetir el error de la lupa apagada. Cuando exista la marca, existe el chip.
 */
/** `borradores` (19/10): los chats contigo mismo, con nombre. */
export type FiltroDeChats = 'todos' | 'no-leidos' | 'grupos' | 'borradores';

export type ChatFiltrable = {
  /** El nombre YA resuelto contra la agenda: el que la persona ve y busca. */
  titulo: string;
  /** Lo último que se dijo, para poder buscar «el chat donde hablamos de X». */
  ultimo?: string;
  esGrupo: boolean;
  /** Un chat contigo mismo (`notas`): va en «Borradores», no en «Grupos». */
  esBorrador?: boolean;
  sinLeer: number;
  /** Marcado a mano como no leído (FL9): cuenta como no leído. */
  marcadoNoLeido?: boolean;
  /** Archivado por mí (FL9): fuera de la lista principal. */
  archivado?: boolean;
};

const estaSinLeer = (chat: ChatFiltrable): boolean => chat.sinLeer > 0 || chat.marcadoNoLeido === true;

/**
 * Sin tildes y en minúsculas.
 *
 * Nadie escribe la tilde en un buscador, y no encontrar a «José» escribiendo
 * «jose» es la clase de detalle que hace sentir rota una app. Misma regla que el
 * buscador de contactos.
 */
const clave = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function filtrarChats<T extends ChatFiltrable>(params: {
  chats: T[];
  filtro: FiltroDeChats;
  texto: string;
}): T[] {
  const aguja = clave(params.texto.trim());

  // La MISMA referencia si no hay nada que filtrar: devolver una copia obliga a
  // la lista a redibujarse entera sin que haya cambiado nada.
  if (!aguja && params.filtro === 'todos') return params.chats;

  return params.chats.filter((chat) => {
    if (params.filtro === 'no-leidos' && !estaSinLeer(chat)) return false;
    if (params.filtro === 'grupos' && !chat.esGrupo) return false;
    if (params.filtro === 'borradores' && !chat.esBorrador) return false;
    if (!aguja) return true;
    return clave(`${chat.titulo} ${chat.ultimo ?? ''}`).includes(aguja);
  });
}

/** Lo que cada chip muestra al lado, como en WhatsApp. */
export function contarChats(chats: readonly ChatFiltrable[]): Record<'no-leidos' | 'grupos' | 'borradores', number> {
  return {
    'no-leidos': chats.filter(estaSinLeer).length,
    grupos: chats.filter((chat) => chat.esGrupo).length,
    borradores: chats.filter((chat) => chat.esBorrador).length,
  };
}

/**
 * La lista principal y «Archivados» (FL9), cada una en el orden de entrada.
 * Como WhatsApp: un mensaje nuevo NO desarchiva el chat; se saca a mano.
 */
export function separarArchivados<T extends { archivado?: boolean }>(chats: readonly T[]): { principales: T[]; archivados: T[] } {
  const principales: T[] = [];
  const archivados: T[] = [];
  for (const chat of chats) (chat.archivado === true ? archivados : principales).push(chat);
  return { principales, archivados };
}
