import { lazy, type ComponentType } from 'react';

const RELOADED_KEY = 'lilachat.chunk-reloaded';
/** A failure this soon after our own reload means the new version fails too: it goes up. */
const JUST_RELOADED_MS = 60_000;

/** When the tab last reloaded for a chunk; anything else (the old «1», nothing) is long ago. */
function reloadedRecently(now: number): boolean {
  const mark = Number(window.sessionStorage.getItem(RELOADED_KEY));
  return Number.isFinite(mark) && mark > 1 && now - mark < JUST_RELOADED_MS;
}

/**
 * A piece loaded on demand that fails because a deploy replaced its file
 * (José 30/10: the emoji panel of a tab opened before the deploy broke the
 * whole web). It reloads the page once, which brings the new version; if it
 * fails again within a minute, the error goes up to the boundary as before.
 */
export async function loadChunkOrReload<T>(load: () => Promise<T>, reload: () => void = () => window.location.reload()): Promise<T> {
  try {
    const module = await load();
    window.sessionStorage.removeItem(RELOADED_KEY);
    return module;
  } catch (error) {
    // E2E 12/11: a mark kept for hours sent the next deploy's stale chunk up as a crash.
    const now = Date.now();
    if (reloadedRecently(now)) throw error;
    window.sessionStorage.setItem(RELOADED_KEY, String(now));
    reload();
    return new Promise<T>(() => undefined);
  }
}

export const lazyChunk = <P extends object>(load: () => Promise<{ default: ComponentType<P> }>) => lazy(() => loadChunkOrReload(load));
