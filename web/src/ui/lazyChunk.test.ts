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
});
