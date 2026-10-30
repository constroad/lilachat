import { lazy, type ComponentType } from 'react';

const RELOADED_KEY = 'lilachat.chunk-reloaded';

/**
 * A piece loaded on demand that fails because a deploy replaced its file
 * (José 30/10: the emoji panel of a tab opened before the deploy broke the
 * whole web). It reloads the page once, which brings the new version; if it
 * fails again, the error goes up to the boundary as before.
 */
export async function loadChunkOrReload<T>(load: () => Promise<T>, reload: () => void = () => window.location.reload()): Promise<T> {
  try {
    const module = await load();
    window.sessionStorage.removeItem(RELOADED_KEY);
    return module;
  } catch (error) {
    if (window.sessionStorage.getItem(RELOADED_KEY)) throw error;
    window.sessionStorage.setItem(RELOADED_KEY, '1');
    reload();
    return new Promise<T>(() => undefined);
  }
}

export const lazyChunk = <P extends object>(load: () => Promise<{ default: ComponentType<P> }>) => lazy(() => loadChunkOrReload(load));
