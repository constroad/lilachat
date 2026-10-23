import { useState, useSyncExternalStore } from 'react';
import { activarVersionNueva } from '../pwa/serviceWorker';
import { useNewWebVersion } from './newVersion';

/**
 * «Hay una versión nueva» in ONE place (pending 61, José 22/10: there were two
 * «Recargar», one in the list and one on top). Two signals feed it: the
 * service worker that installed the new version and waits, and the published
 * `index.html` naming another bundle.
 */
let workerWaiting = false;
const listeners = new Set<() => void>();

/** The service worker installed a new version and waits for «Recargar». */
export function markWorkerWaiting(): void {
  workerWaiting = true;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** For tests: a fresh page. */
export function __resetWebUpdate(): void {
  workerWaiting = false;
}

export function useWebUpdate(): { available: boolean; updating: boolean; update: () => void } {
  const waiting = useSyncExternalStore(subscribe, () => workerWaiting);
  const newBundle = useNewWebVersion();
  const [updating, setUpdating] = useState(false);
  const update = () => {
    if (updating) return;
    setUpdating(true);
    // The waiting worker takes over and reloads; without one, a plain reload brings the new bundle.
    if (waiting) activarVersionNueva();
    else window.location.reload();
  };
  return { available: waiting || newBundle, updating, update };
}
