import { describe, expect, it, vi } from 'vitest';
import { createSessionCache } from './sessionCache.js';

/**
 * José, 22/10: in the company spaces every screen showed «cargando» each time
 * it opened. The cache paints what it already has and refreshes behind it.
 */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe('session cache', () => {
  it('a fresh value is reused without asking; a stale one is shown while it refreshes', async () => {
    let now = 1_000;
    const cache = createSessionCache<string[]>({ maxAgeMs: 30_000, now: () => now });
    const fetcher = vi.fn().mockResolvedValue(['Ana']);
    await cache.revalidate('w1:members', fetcher);
    await cache.revalidate('w1:members', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 31_000;
    const second = deferred<string[]>();
    const refreshing = cache.revalidate('w1:members', () => second.promise);
    expect(cache.get('w1:members')).toMatchObject({ value: ['Ana'], loading: true });
    second.resolve(['Ana', 'Beto']);
    await refreshing;
    expect(cache.get('w1:members')).toMatchObject({ value: ['Ana', 'Beto'], loading: false });
  });

  it('whoever joins a request in flight adopts its answer (one request, not two)', async () => {
    const cache = createSessionCache<number>({ maxAgeMs: 30_000 });
    const answer = deferred<number>();
    const fetcher = vi.fn(() => answer.promise);
    const first = cache.revalidate('k', fetcher);
    const second = cache.revalidate('k', fetcher);
    answer.resolve(7);
    expect((await first).value).toBe(7);
    expect((await second).value).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('the last request wins: an older answer arriving late does not overwrite a newer one', async () => {
    const cache = createSessionCache<string>({ maxAgeMs: 30_000 });
    const old = deferred<string>();
    const fresh = deferred<string>();
    const a = cache.revalidate('k', () => old.promise);
    const b = cache.revalidate('k', () => fresh.promise, { force: true });
    fresh.resolve('new');
    await b;
    old.resolve('old');
    await a;
    expect(cache.get('k').value).toBe('new');
  });

  it('a failure keeps what was shown and says so apart; the next success clears the error', async () => {
    let now = 0;
    const cache = createSessionCache<string>({ maxAgeMs: 10, now: () => now });
    await cache.revalidate('k', async () => 'ok');
    now = 100;
    await cache.revalidate('k', async () => {
      throw new Error('sin red');
    });
    expect(cache.get('k')).toMatchObject({ value: 'ok', error: 'sin red', loading: false });
    now = 200;
    await cache.revalidate('k', async () => 'again');
    expect(cache.get('k').value).toBe('again');
    expect(cache.get('k').error).toBeUndefined();
  });

  it('what comes from disk never overwrites something fresher in memory, and fills an empty key', async () => {
    let now = 5_000;
    const cache = createSessionCache<string>({ maxAgeMs: 30_000, now: () => now });
    cache.hydrate('a', 'from disk', 1_000);
    expect(cache.get('a')).toMatchObject({ value: 'from disk', fetchedAt: 1_000 });
    await cache.revalidate('b', async () => 'from server');
    cache.hydrate('b', 'old disk copy', 100);
    expect(cache.get('b').value).toBe('from server');
    now = 1_000_000;
    expect(cache.isStale('a')).toBe(true);
  });

  it('a patch that changes nothing keeps the same snapshot; one that changes notifies', async () => {
    const cache = createSessionCache<{ n: number }>({ maxAgeMs: 30_000 });
    await cache.revalidate('k', async () => ({ n: 1 }));
    const listener = vi.fn();
    cache.subscribe('k', listener);
    const before = cache.get('k');
    cache.patch('k', (value) => value);
    expect(cache.get('k')).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    cache.patch('k', (value) => ({ n: value.n + 1 }));
    expect(cache.get('k').value).toEqual({ n: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dropping a space forgets its keys (losing access must not keep its directory), and a request in flight lands nowhere', async () => {
    const cache = createSessionCache<string>({ maxAgeMs: 30_000 });
    await cache.revalidate('w1:members', async () => 'secret');
    await cache.revalidate('w2:members', async () => 'other');
    const late = deferred<string>();
    const pending = cache.revalidate('w1:channels', () => late.promise);
    cache.drop('w1:');
    late.resolve('too late');
    await pending;
    expect(cache.get('w1:members').value).toBeUndefined();
    expect(cache.get('w1:channels').value).toBeUndefined();
    expect(cache.get('w2:members').value).toBe('other');
  });

  it('an unknown key is an empty, stable snapshot; saving goes out on each new value', async () => {
    const onSave = vi.fn();
    const cache = createSessionCache<string>({ maxAgeMs: 30_000, onSave });
    expect(cache.get('nada')).toBe(cache.get('nada'));
    expect(cache.get('nada').value).toBeUndefined();
    expect(cache.get('nada').loading).toBe(false);
    await cache.revalidate('k', async () => 'v');
    expect(onSave).toHaveBeenCalledWith('k', 'v', expect.any(Number));
  });
});
