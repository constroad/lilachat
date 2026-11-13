/** The pure part of «Eliminar para mí» (FL9; synced across my devices since 13/11): no React Native here, so it tests in node. */
export function sinOcultos<T extends { seq?: number }>(filas: T[], ocultos: ReadonlySet<number>): T[] {
  if (ocultos.size === 0) return filas;
  return filas.filter((fila) => typeof fila.seq !== 'number' || !ocultos.has(fila.seq));
}

/** `current` plus `incoming`; the SAME set when nothing is new, so React does not render again. */
export function mergeHidden(current: ReadonlySet<number>, incoming: readonly number[]): ReadonlySet<number> {
  if (incoming.every((seq) => current.has(seq))) return current;
  return new Set([...current, ...incoming]);
}
