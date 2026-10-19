/**
 * Las tarjetas del chat en vivo (José, 19/10). El server avisa `ref.changed`
 * cuando una encuesta, un evento o un recordatorio del grupo cambia (voto,
 * edición, imagen, borrado) y cada tarjeta montada con ese id se vuelve a
 * pedir. Al reconectar se refrescan todas: lo que pasó con el socket pausado
 * (app en el fondo) no se pierde.
 */
export type TipoDeTarjeta = 'encuesta' | 'evento' | 'recordatorio';

const TIPOS: ReadonlySet<string> = new Set<TipoDeTarjeta>(['encuesta', 'evento', 'recordatorio']);
const oyentes = new Map<string, Set<() => void>>();
const clave = (tipo: TipoDeTarjeta, id: string) => `${tipo}:${id}`;

export function suscribirTarjeta(tipo: TipoDeTarjeta, id: string, refrescar: () => void): () => void {
  const llave = clave(tipo, id);
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
  if (typeof tipo !== 'string' || !TIPOS.has(tipo) || typeof id !== 'string') return;
  for (const refrescar of oyentes.get(clave(tipo as TipoDeTarjeta, id)) ?? []) refrescar();
}

export function refrescarTodas(): void {
  for (const conjunto of oyentes.values()) for (const refrescar of conjunto) refrescar();
}
