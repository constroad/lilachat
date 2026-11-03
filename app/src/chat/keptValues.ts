import { useRef } from 'react';

/** Same items in the same order (arrays), or the same fields with the same values (plain objects). */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
}

/**
 * The values of `next`, keeping last render's object where nothing changed: a
 * memoized row receives the same album or quote and bails out (F4, 02/11).
 */
export function keepUnchanged<K, V>(previous: ReadonlyMap<K, V> | undefined, next: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  if (!previous) return next;
  let changed = previous.size !== next.size;
  const kept = new Map<K, V>();
  for (const [key, value] of next) {
    const before = previous.get(key);
    const same = previous.has(key) && shallowEqual(before, value);
    if (!same) changed = true;
    kept.set(key, same ? (before as V) : value);
  }
  return changed ? kept : previous;
}

/** `keepUnchanged` across renders. */
export function useKeptValues<K, V>(next: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const last = useRef<ReadonlyMap<K, V> | undefined>(undefined);
  const kept = keepUnchanged(last.current, next);
  last.current = kept;
  return kept;
}
