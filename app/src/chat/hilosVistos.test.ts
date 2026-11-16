import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void storage.set(key, value)),
    removeItem: vi.fn(async (key: string) => void storage.delete(key)),
  },
}));

async function freshStore() {
  vi.resetModules();
  return import('./hilosVistos');
}

beforeEach(() => storage.clear());

/** José, 16/11: the thread dot never changed. The chat's cells only redraw when this snapshot changes. */
describe('seenThreadsOf: a new snapshot each time a thread is read', () => {
  it('reading a thread gives the chat a new snapshot with that thread seen', async () => {
    const store = await freshStore();
    await store.marcarHiloVisto('chat-1', 4, 9);
    const before = store.seenThreadsOf('chat-1');

    await store.marcarHiloVisto('chat-1', 4, 12);

    const after = store.seenThreadsOf('chat-1');
    expect(after).not.toBe(before);
    expect(after['4']).toBe(12);
  });

  it('marking what was already seen keeps the same snapshot (no redraw)', async () => {
    const store = await freshStore();
    await store.marcarHiloVisto('chat-1', 4, 9);
    const before = store.seenThreadsOf('chat-1');

    await store.marcarHiloVisto('chat-1', 4, 7);

    expect(store.seenThreadsOf('chat-1')).toBe(before);
  });

  it('another chat being read does not touch this one', async () => {
    const store = await freshStore();
    await store.marcarHiloVisto('chat-1', 4, 9);
    const before = store.seenThreadsOf('chat-1');

    await store.marcarHiloVisto('chat-2', 1, 3);

    expect(store.seenThreadsOf('chat-1')).toBe(before);
  });

  it('a chat with nothing read gives the same empty snapshot every time', async () => {
    const store = await freshStore();

    expect(store.seenThreadsOf('chat-9')).toBe(store.seenThreadsOf('chat-9'));
    expect(store.seenThreadsOf('chat-9')).toEqual({});
  });
});
