import { describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';

const server = {} as MongoMemoryServer;

describe('startTestMongo', () => {
  it('tries again when another process took the port', async () => {
    const create = vi.fn<() => Promise<MongoMemoryServer>>().mockRejectedValueOnce(new Error('Port "60747" already in use')).mockResolvedValueOnce(server);
    await expect(startTestMongo(create)).resolves.toBe(server);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('any other error stops at once', async () => {
    const create = vi.fn<() => Promise<MongoMemoryServer>>().mockRejectedValue(new Error('binary not found'));
    await expect(startTestMongo(create)).rejects.toThrow('binary not found');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('gives up after four tries', async () => {
    const create = vi.fn<() => Promise<MongoMemoryServer>>().mockRejectedValue(new Error('Port "1" already in use'));
    await expect(startTestMongo(create)).rejects.toThrow('already in use');
    expect(create).toHaveBeenCalledTimes(4);
  });
});
