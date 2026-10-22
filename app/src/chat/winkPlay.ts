/**
 * Which play of a wink the overlay is drawing (José, 22/10: trying several
 * winks quickly, they stopped animating). The panel's previews all use the
 * same seed and «Ver otra vez» reuses the message's seq, so keying the
 * overlay by `seq` kept the old components mounted: their animations, started
 * on mount, never ran again. Each start gets its own `run`, and the key is both.
 */
export function winkPlayKey(play: { seq: number; run: number }): string {
  return `${play.seq}:${play.run}`;
}
