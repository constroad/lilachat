/**
 * Las tarjetas del chat en vivo (José, 19/10). El server avisa `ref.changed`
 * cuando una encuesta, un evento o un recordatorio del grupo cambia (voto,
 * edición, imagen, borrado) y cada tarjeta montada con ese id se vuelve a
 * pedir. Al reconectar se refrescan todas: lo que pasó con el socket pausado
 * (app en el fondo) no se pierde.
 */
export type CardType = 'encuesta' | 'evento' | 'recordatorio' | 'checklist';

const CARD_TYPES: ReadonlySet<string> = new Set<CardType>(['encuesta', 'evento', 'recordatorio', 'checklist']);
const oyentes = new Map<string, Set<() => void>>();
const cardKey = (tipo: CardType, id: string) => `${tipo}:${id}`;

export function suscribirTarjeta(tipo: CardType, id: string, refrescar: () => void): () => void {
  const llave = cardKey(tipo, id);
  const conjunto = oyentes.get(llave) ?? new Set();
  conjunto.add(refrescar);
  oyentes.set(llave, conjunto);
  return () => {
    conjunto.delete(refrescar);
    if (conjunto.size === 0) oyentes.delete(llave);
  };
}

/** El aviso del server, tal como llega por el socket. */
export function avisarTarjeta(frame: unknown): void {
  const { tipo, id } = (frame ?? {}) as { tipo?: unknown; id?: unknown };
  if (typeof tipo !== 'string' || !CARD_TYPES.has(tipo) || typeof id !== 'string') return;
  for (const refrescar of oyentes.get(cardKey(tipo as CardType, id)) ?? []) refrescar();
}

export function refrescarTodas(): void {
  for (const conjunto of oyentes.values()) for (const refrescar of conjunto) refrescar();
}
