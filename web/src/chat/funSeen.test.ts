import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh module is a reloaded tab: only localStorage survives. */
async function reloadTab() {
  vi.resetModules();
  return import('./funSeen');
}

beforeEach(() => localStorage.clear());

describe('what this browser already played survives a reload (pending 107, José 28/10)', () => {
  it('a nudge played in a group does not play again after reloading, even with a stale read cursor', async () => {
    // Arrange
    const before = await reloadTab();
    before.rememberFunSeen('lokillos', 52);
    // Act
    const after = await reloadTab();
    // Assert
    expect(after.funSeenFloor('lokillos', 35)).toBe(52);
  });

  it('two tabs do not erase each other: each write starts from what is stored', async () => {
    // Arrange
    const tabA = await reloadTab();
    const tabB = await reloadTab();
    // Act
    tabA.rememberFunSeen('a', 5);
    tabB.rememberFunSeen('b', 9);
    // Assert
    const fresh = await reloadTab();
    expect([fresh.funSeenFloor('a', 0), fresh.funSeenFloor('b', 0)]).toEqual([5, 9]);
  });

  it('a row plays once per nudge, and what the chat played counts for it', async () => {
    const tab = await reloadTab();
    tab.rememberRowPlayed('x', 4);
    tab.rememberFunSeen('y', 7);
    expect([tab.rowPlayedSeq('x'), tab.rowPlayedSeq('y'), tab.rowPlayedSeq('z')]).toEqual([4, 7, 0]);
  });

  it('a broken or blocked storage never breaks the chat', async () => {
    // Arrange
    localStorage.setItem('lilachat.funPlayed', '{nope');
    const tab = await reloadTab();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    // Act
    tab.rememberFunSeen('c', 3);
    // Assert
    expect(tab.funSeenFloor('c', 1)).toBe(3);
    vi.restoreAllMocks();
  });
});
