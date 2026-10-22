/**
 * A cache for a session's screens that paints what it already has and
 * refreshes behind it (stale-while-revalidate). José, 22/10: every screen of
 * a company space (directory, mentions, channels, members) showed «cargando»
 * each time it opened, because each kept its data in its own state and threw
 * it away. Pure: the app and the web plug in React and their disk.
 *
 * - A request in flight is joined, never repeated; whoever joins adopts its answer.
 * - The last request wins: an older answer arriving late is dropped.
 * - A failure keeps what was shown and reports `error` apart; the next success clears it.
 * - What comes from disk never overwrites something fresher in memory.
 * - A patch that changes nothing keeps the same snapshot (no re-render).
 */
export type CacheEntry<T> = { value?: T; fetchedAt?: number; error?: string; loading: boolean };

export type SessionCache<T> = {
  get(key: string): CacheEntry<T>;
  subscribe(key: string, listener: () => void): () => void;
  isStale(key: string): boolean;
  revalidate(key: string, fetcher: () => Promise<T>, options?: { force?: boolean }): Promise<CacheEntry<T>>;
  hydrate(key: string, value: T, fetchedAt: number): void;
  patch(key: string, change: (value: T) => T): void;
  drop(prefix: string): void;
  clear(): void;
};

type Options<T> = { maxAgeMs: number; now?: () => number; onSave?: (key: string, value: T, fetchedAt: number) => void };

const EMPTY: CacheEntry<never> = Object.freeze({ loading: false });
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createSessionCache<T>(options: Options<T>): SessionCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry<T>>();
  const listeners = new Map<string, Set<() => void>>();
  const inFlight = new Map<string, { token: number; promise: Promise<CacheEntry<T>> }>();
  let lastToken = 0;

  const get = (key: string): CacheEntry<T> => entries.get(key) ?? (EMPTY as CacheEntry<T>);
  const set = (key: string, entry: CacheEntry<T> | undefined) => {
    if (entry) entries.set(key, entry);
    else entries.delete(key);
    for (const listener of [...(listeners.get(key) ?? [])]) listener();
  };
  const isStale = (key: string) => {
    const fetchedAt = entries.get(key)?.fetchedAt;
    return fetchedAt === undefined || now() - fetchedAt >= options.maxAgeMs;
  };

  async function run(key: string, token: number, fetcher: () => Promise<T>): Promise<CacheEntry<T>> {
    try {
      const value = await fetcher();
      if (inFlight.get(key)?.token !== token) return get(key);
      const fetchedAt = now();
      set(key, { value, fetchedAt, loading: false });
      options.onSave?.(key, value, fetchedAt);
    } catch (error) {
      if (inFlight.get(key)?.token !== token) return get(key);
      set(key, { ...get(key), error: messageOf(error), loading: false });
    }
    inFlight.delete(key);
    return get(key);
  }

  return {
    get,
    isStale,
    subscribe(key, listener) {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => set.delete(listener);
    },
    revalidate(key, fetcher, revalidateOptions) {
      const flying = inFlight.get(key);
      if (flying && !revalidateOptions?.force) return flying.promise;
      if (!flying && !revalidateOptions?.force && !isStale(key)) return Promise.resolve(get(key));
      lastToken += 1;
      const token = lastToken;
      // Registered before the first await: a second caller in the same tick joins this one.
      const slot = { token, promise: Promise.resolve(get(key)) };
      inFlight.set(key, slot);
      if (!get(key).loading) set(key, { ...get(key), loading: true });
      slot.promise = run(key, token, fetcher);
      return slot.promise;
    },
    hydrate(key, value, fetchedAt) {
      const current = entries.get(key);
      if (current?.value !== undefined && (current.fetchedAt ?? 0) >= fetchedAt) return;
      set(key, { ...current, value, fetchedAt, loading: current?.loading ?? false });
    },
    patch(key, change) {
      const current = entries.get(key);
      if (current?.value === undefined) return;
      const value = change(current.value);
      if (value === current.value) return;
      set(key, { ...current, value });
    },
    drop(prefix) {
      for (const key of [...new Set([...entries.keys(), ...inFlight.keys()])]) {
        if (!key.startsWith(prefix)) continue;
        inFlight.delete(key);
        set(key, undefined);
      }
    },
    clear() {
      for (const key of [...new Set([...entries.keys(), ...inFlight.keys()])]) {
        inFlight.delete(key);
        set(key, undefined);
      }
    },
  };
}
