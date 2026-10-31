import { describe, expect, it, vi } from 'vitest';
import { createMembersCache, typingTargets } from './typingRelay.js';

const CHAT = '64b7f0c2a1b2c3d4e5f60718';

/** «Escribiendo…» (R31/10): only from a member, and without one query per keystroke (FL4). */
describe('typingTargets', () => {
  it('a member\'s typing goes to the other members, never back to them', async () => {
    // Arrange
    const members = vi.fn(async () => ['jose', 'maria', 'pedro']);
    // Act
    const targets = await typingTargets(CHAT, 'jose', members);
    // Assert
    expect(targets).toEqual(['maria', 'pedro']);
  });

  it('someone who is not in the chat reaches nobody, even knowing its id', async () => {
    // Arrange
    const members = vi.fn(async () => ['jose', 'maria']);
    // Act
    const targets = await typingTargets(CHAT, 'intruso', members);
    // Assert
    expect(targets).toEqual([]);
  });

  it('an id that is not a chat id is not even looked up', async () => {
    // Arrange
    const members = vi.fn(async () => ['jose']);
    // Act
    const targets = await Promise.all([typingTargets('no-es-un-id', 'jose', members), typingTargets(undefined, 'jose', members)]);
    // Assert
    expect(targets).toEqual([[], []]);
    expect(members).not.toHaveBeenCalled();
  });
});

describe('createMembersCache', () => {
  it('asks the base once while fresh and again once it is stale', async () => {
    // Arrange
    let now = 0;
    const read = vi.fn(async () => ['jose', 'maria']);
    const members = createMembersCache({ read, now: () => now, ttlMs: 10_000, maxChats: 10 });
    // Act
    await members(CHAT);
    now = 9_999;
    await members(CHAT);
    now = 10_000;
    await members(CHAT);
    // Assert
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps at most maxChats: the oldest chat leaves first', async () => {
    // Arrange
    const read = vi.fn(async (chatId: string) => [chatId]);
    const members = createMembersCache({ read, now: () => 0, ttlMs: 10_000, maxChats: 2 });
    // Act
    await members('a');
    await members('b');
    await members('c');
    await members('a');
    // Assert
    expect(read.mock.calls.map(([chatId]) => chatId)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('a failed read is not kept: the next one asks again', async () => {
    // Arrange
    const read = vi.fn().mockRejectedValueOnce(new Error('mongo')).mockResolvedValueOnce(['jose']);
    const members = createMembersCache({ read, now: () => 0, ttlMs: 10_000, maxChats: 10 });
    // Act
    await expect(members(CHAT)).rejects.toThrow('mongo');
    // Assert
    await expect(members(CHAT)).resolves.toEqual(['jose']);
  });
});
