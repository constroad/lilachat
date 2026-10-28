import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void storage.set(key, value)),
  },
}));

/** A fresh module is a fresh app start: only what was saved survives. */
async function startApp() {
  vi.resetModules();
  const module = await import('./funSeen');
  await module.loadFunLedger();
  return module;
}

beforeEach(() => {
  storage.clear();
  vi.useRealTimers();
});

describe('what this phone already played survives a restart (pending 107, José 28/10)', () => {
  it('a nudge played in «Lokillos» does not play again after closing and reopening the app', async () => {
    // Arrange
    vi.useFakeTimers();
    const before = await startApp();
    before.rememberFunSeen('lokillos', 52);
    await vi.runAllTimersAsync();
    // Act
    const after = await startApp();
    // Assert: the group's read cursor lags at 35 (pending 108), the ledger says 52.
    expect(after.funSeenFloor('lokillos', 35)).toBe(52);
  });

  it('a chat never opened here starts from its read cursor; a newer cursor wins', async () => {
    // Arrange
    const app = await startApp();
    app.rememberFunSeen('web', 10);
    // Act
    const fresh = app.funSeenFloor('nuevo', 7);
    const newerCursor = app.funSeenFloor('web', 14);
    // Assert
    expect([fresh, newerCursor]).toEqual([7, 14]);
  });

  it('never goes back', async () => {
    const app = await startApp();
    app.rememberFunSeen('back', 30);
    app.rememberFunSeen('back', 12);
    expect(app.funSeenFloor('back', 0)).toBe(30);
  });

  it('a row that already shook for a nudge does not shake again when the list reloads', async () => {
    // Arrange
    const app = await startApp();
    // Act
    app.rememberRowPlayed('lokillos', 52);
    // Assert
    expect(app.rowPlayedSeq('lokillos')).toBe(52);
    expect(app.rowPlayedSeq('otro')).toBe(0);
  });

  it('what the open chat played also counts for the row', async () => {
    const app = await startApp();
    app.rememberFunSeen('lokillos', 52);
    expect(app.rowPlayedSeq('lokillos')).toBe(52);
  });

  it('it is ready only once storage answered, even if storage fails', async () => {
    // Arrange
    vi.resetModules();
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    const app = await import('./funSeen');
    // Act
    const before = app.funLedgerReady();
    await app.loadFunLedger();
    // Assert
    expect([before, app.funLedgerReady()]).toEqual([false, true]);
  });
});
