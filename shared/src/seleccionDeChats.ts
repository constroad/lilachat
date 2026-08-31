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
};

export type AccionesDeSeleccion = {
  /** `silenciar` si alguno NO está silenciado; `reactivar` si todos lo están. */
  silenciar: 'silenciar' | 'reactivar' | null;
  fijar: 'fijar' | 'desfijar' | null;
  /** Solo si hay algo sin leer en la selección. */
  puedeMarcarLeido: boolean;
  /** «Salir» es de grupos: solo si TODA la selección son grupos. */
  salir: boolean;
};

export function accionesDeSeleccion(chats: readonly ChatSeleccionable[]): AccionesDeSeleccion {
  if (chats.length === 0) {
    return { silenciar: null, fijar: null, puedeMarcarLeido: false, salir: false };
  }
  return {
    // «Reactivar» solo si TODOS están silenciados; si alguno no, la acción del
    // lote es silenciar (lleva a todos al mismo estado).
    silenciar: chats.every((c) => c.muted) ? 'reactivar' : 'silenciar',
    fijar: chats.every((c) => c.pinned) ? 'desfijar' : 'fijar',
    puedeMarcarLeido: chats.some((c) => c.unread > 0),
    salir: chats.every((c) => c.esGrupo),
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
