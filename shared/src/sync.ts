/**
 * Sincronización por CURSOR. Motor PURO, compartido por app y web.
 *
 * El modelo es el de Telegram (`getDifference`), no el de WhatsApp: el server
 * es la fuente de verdad y el cliente lleva, por chat, **hasta qué `seq` ya
 * tiene**. Al reconectar pide el delta en vez de que el server le re-entregue
 * una cola.
 *
 * Por qué importa: un teléfono que estuvo tres días sin red pide exactamente lo
 * que le falta, y el mismo mecanismo sirve para multi-device y para la web —
 * cosas que una cola que se borra al entregar no permite.
 */

export type Cursors = Record<string, number>;

export type SyncBatch = {
  chatId: string;
  /** Mensajes con `seq` MAYOR al cursor que mandó el cliente, en orden. */
  messages: { seq: number }[];
};

/**
 * Avanza los cursores con lo recibido. **Nunca retrocede**: un lote viejo que
 * llega tarde (reintento, dos sockets) no puede hacer que se vuelvan a pedir
 * mensajes que ya se tienen — así el barrido termina.
 */
export function advanceCursors(cursors: Cursors, batches: SyncBatch[]): Cursors {
  const next: Cursors = { ...cursors };
  for (const batch of batches) {
    const highest = batch.messages.reduce((max, message) => Math.max(max, message.seq), 0);
    const current = next[batch.chatId] ?? 0;
    if (highest > current) next[batch.chatId] = highest;
  }
  return next;
}

/**
 * Inserta mensajes nuevos en la lista de un chat, ordenada por `seq`.
 *
 * Deduplica por `seq` porque el MISMO mensaje llega por dos caminos a la vez:
 * el evento en vivo del socket y el lote de sincronización al reconectar. Sin
 * esto, cada reconexión duplica visualmente lo último.
 */
export function mergeBySeq<T extends { seq: number }>(existing: T[], incoming: T[]): T[] {
  const bySeq = new Map<number, T>();
  for (const message of existing) bySeq.set(message.seq, message);
  // El entrante gana: puede traer correcciones (editado, borrado).
  for (const message of incoming) bySeq.set(message.seq, message);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Cuántos sin leer tiene un chat: lo que hay por encima del cursor de lectura.
 * Se calcula con NÚMEROS, no contando documentos — es la razón de que los
 * acuses vivan como cursor y no como una fila por mensaje.
 */
export function unreadCount(params: { lastSeq: number; readSeq: number }): number {
  return Math.max(0, params.lastSeq - params.readSeq);
}
