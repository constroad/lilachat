import { describe, expect, it } from 'vitest';
import { welcomeGate } from './welcome.js';

/** Pending 5 (design e-01): the welcome only for a new account, once. */
describe('welcomeGate', () => {
  it('a new account with no chats and no spaces sees it', () => {
    expect(welcomeGate({ seen: null, spaces: [], personalChats: 0 })).toBe('show');
  });

  it('waits while the phone, the spaces or the chats are still loading', () => {
    expect(welcomeGate({ seen: undefined, spaces: [], personalChats: 0 })).toBe('wait');
    expect(welcomeGate({ seen: null, spaces: null, personalChats: 0 })).toBe('wait');
    expect(welcomeGate({ seen: null, spaces: [], personalChats: null })).toBe('wait');
  });

  it('someone already using the app skips it: chats, a space, or seen before', () => {
    expect(welcomeGate({ seen: null, spaces: [], personalChats: 3 })).toBe('skip');
    expect(welcomeGate({ seen: null, spaces: [{ id: 's1' }], personalChats: 0 })).toBe('skip');
    expect(welcomeGate({ seen: true, spaces: null, personalChats: null })).toBe('skip');
  });
});
