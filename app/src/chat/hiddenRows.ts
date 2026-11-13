/** The pure part of «Eliminar para mí» (FL9; synced across my devices since 13/11): no React Native here, so it tests in node. */
export function withoutHidden<T extends { seq?: number }>(rows: T[], hidden: ReadonlySet<number>): T[] {
  if (hidden.size === 0) return rows;
  return rows.filter((row) => typeof row.seq !== 'number' || !hidden.has(row.seq));
}

/** `current` plus `incoming`; the SAME set when nothing is new, so React does not render again. */
export function mergeHidden(current: ReadonlySet<number>, incoming: readonly number[]): ReadonlySet<number> {
  if (incoming.every((seq) => current.has(seq))) return current;
  return new Set([...current, ...incoming]);
}
