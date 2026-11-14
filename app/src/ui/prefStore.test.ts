import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

import { createPrefStore } from './prefStore';

/**
 * A cold start asks before AsyncStorage answers (José 13/11: the open space is read after the first
 * request for my spaces, so an incognito space entered from Ajustes was lost on a restart). `ready`
 * is the moment the stored value is known.
 */
describe('createPrefStore().ready', () => {
  beforeEach(() => {
    storage.getItem.mockReset();
    storage.setItem.mockReset().mockResolvedValue(undefined);
  });

  it('resolves with the stored value once it has been read', async () => {
    storage.getItem.mockResolvedValue('g1');
    const store = createPrefStore<string | null>('k.open', (stored) => stored || null, null);

    expect(store.get()).toBeNull();
    await expect(store.ready()).resolves.toBe('g1');
    expect(store.get()).toBe('g1');
  });

  it('reads the storage once, however many ask', async () => {
    storage.getItem.mockResolvedValue('g1');
    const store = createPrefStore<string | null>('k.once', (stored) => stored || null, null);

    await Promise.all([store.ready(), store.ready(), store.ready()]);

    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('resolves with the fallback when the storage fails', async () => {
    storage.getItem.mockRejectedValue(new Error('blocked'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createPrefStore<string | null>('k.fail', (stored) => stored || null, null);

    await expect(store.ready()).resolves.toBeNull();
    warn.mockRestore();
  });

  it('keeps the value set on the device before the read ends', async () => {
    let finishRead: (stored: string | null) => void = () => undefined;
    storage.getItem.mockReturnValue(new Promise<string | null>((resolve) => (finishRead = resolve)));
    const store = createPrefStore<string | null>('k.race', (stored) => stored || null, null);
    const ready = store.ready();

    store.set('w2');
    finishRead(null);

    await expect(ready).resolves.toBe('w2');
  });
});
