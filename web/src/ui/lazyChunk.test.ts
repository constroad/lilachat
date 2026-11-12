import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadChunkOrReload } from './lazyChunk';

/** José 30/10: after a deploy, opening the emoji panel broke the web («Algo falló al mostrar Lilachat»). */
afterEach(() => window.sessionStorage.clear());

describe('loadChunkOrReload', () => {
  it('a chunk that loads is returned as is', async () => {
    const module = { default: () => null };
    await expect(loadChunkOrReload(async () => module, vi.fn())).resolves.toBe(module);
  });

  it('a chunk of an old version reloads the page once, and the second time the error goes up', async () => {
    // Arrange
    const reload = vi.fn();
    const failing = async () => { throw new TypeError('Failed to fetch dynamically imported module'); };
    // Act
    void loadChunkOrReload(failing, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // Assert
    await expect(loadChunkOrReload(failing, reload)).rejects.toThrow('dynamically imported');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  /**
   * E2E 12/11: the work map crashed the app. A deploy had reloaded the tab hours before, no other
   * piece loaded since, so the mark stayed and the next deploy's stale chunk went up as an error.
   */
  it('a reload long ago does not count: the next deploy reloads again', async () => {
    // Arrange
    const reload = vi.fn();
    const failing = async () => { throw new TypeError('Failed to fetch dynamically imported module'); };
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T09:00:00-05:00') });
    void loadChunkOrReload(failing, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // Act
    vi.setSystemTime(new Date('2026-11-12T10:53:00-05:00'));
    void loadChunkOrReload(failing, reload);
    // Assert
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });

  it('an old mark of the previous version («1») is read as long ago', async () => {
    window.sessionStorage.setItem('lilachat.chunk-reloaded', '1');
    const reload = vi.fn();
    void loadChunkOrReload(async () => { throw new TypeError('Failed to fetch dynamically imported module'); }, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});
