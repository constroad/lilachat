/**
 * Selección múltiple de chats (mantener presionado, como WhatsApp). PURO.
 *
 * José, 30/08/2026: «no puedo seleccionar chats como en WhatsApp para silenciar
 * u otras acciones». Acá viven las dos decisiones puras: qué acciones ofrece un
 * conjunto seleccionado, y cómo se ordena la lista con los fijados arriba.
 */
export type ChatSeleccionable = {
  id: string;
  esGrupo: boolean;
  muted: boolean;
  pinned: boolean;
  unread: number;
  /** Con qué comparar la recencia (ms o seq): mayor = más nuevo. */
  fechaOrden: number;
  /** Archivado por MÍ (FL9): vive en «Archivados», fuera de la lista principal. */
  archived?: boolean;
  /** Marcado a mano como no leído (FL9): el punto sin número de WhatsApp. */
  marcadoNoLeido?: boolean;
};

export type AccionesDeSeleccion = {
  /** `silenciar` si alguno NO está silenciado; `reactivar` si todos lo están. */
  silenciar: 'silenciar' | 'reactivar' | null;
  /** `null` con un archivado en la selección: fijar es de la lista principal. */
  fijar: 'fijar' | 'desfijar' | null;
  /** `leido` si algo está sin leer (o marcado a mano); si no, `no-leido`. */
  lectura: 'leido' | 'no-leido' | null;
  /** `desarchivar` si TODOS están archivados; si alguno no, `archivar`. */
  archivar: 'archivar' | 'desarchivar' | null;
  /** «Salir» es de grupos: solo si TODA la selección son grupos. */
  salir: boolean;
  /** «Eliminar chat» (FL9d) es de los 1:1: solo si NINGUNO es grupo. */
  eliminar: boolean;
};

export function accionesDeSeleccion(chats: readonly ChatSeleccionable[]): AccionesDeSeleccion {
  if (chats.length === 0) {
    return { silenciar: null, fijar: null, lectura: null, archivar: null, salir: false, eliminar: false };
  }
  const hayArchivado = chats.some((c) => c.archived === true);
  return {
    // «Reactivar» solo si TODOS están silenciados; si alguno no, la acción del
    // lote es silenciar (lleva a todos al mismo estado).
    silenciar: chats.every((c) => c.muted) ? 'reactivar' : 'silenciar',
    fijar: hayArchivado ? null : chats.every((c) => c.pinned) ? 'desfijar' : 'fijar',
    lectura: chats.some((c) => c.unread > 0 || c.marcadoNoLeido === true) ? 'leido' : 'no-leido',
    archivar: chats.every((c) => c.archived === true) ? 'desarchivar' : 'archivar',
    salir: chats.every((c) => c.esGrupo),
    eliminar: chats.every((c) => !c.esGrupo),
  };
}

/**
 * Los fijados arriba, cada grupo por recencia. Es el orden de WhatsApp: fijar
 * saca el chat del flujo del tiempo y lo clava arriba.
 */
export function ordenarChats<T extends { pinned: boolean; fechaOrden: number }>(chats: T[]): T[] {
  return [...chats].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.fechaOrden - a.fechaOrden;
  });
}
