import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * E2E 12/11: a service detail waited 48 s in the browser BEFORE leaving (resource timing:
 * fetchStart − startTime), the server answered in 1.2 s. The worker does nothing with the API
 * or the socket, yet every request waited for it to wake up. Static routing sends them straight
 * to the network; a browser without it keeps the old path.
 */
const script = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');
type Handler = (event: Record<string, unknown>) => void;

function workerOf(): Record<string, Handler> {
  const handlers: Record<string, Handler> = {};
  const self = { addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; }, location: { origin: 'https://lilachat.constroad.com' }, registration: {}, clients: {} };
  const caches = { open: async () => ({ put: async () => undefined, addAll: async () => undefined }), keys: async () => [] };
  const fetchShell = vi.fn(async () => new Response('<html></html>'));
  // The worker resolves '/' against its own origin; in the test there is none.
  const RequestOf = class { constructor(readonly url: string) {} };
  new Function('self', 'caches', 'fetch', 'Request', script)(self, caches, fetchShell, RequestOf);
  return handlers;
}

describe('service worker static routes', () => {
  it('on install the API and the socket go to the network without the worker', async () => {
    const addRoutes = vi.fn(async () => undefined);
    const waits: Promise<unknown>[] = [];

    workerOf().install!({ addRoutes, waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);

    expect(addRoutes).toHaveBeenCalledWith([
      { condition: { urlPattern: '/api/*' }, source: 'network' },
      { condition: { urlPattern: '/socket.io/*' }, source: 'network' },
    ]);
  });

  it('a refused route never fails the install (the new version must still arrive)', async () => {
    const waits: Promise<unknown>[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    workerOf().install!({ addRoutes: vi.fn(async () => { throw new TypeError('unsupported'); }), waitUntil: (promise: Promise<unknown>) => waits.push(promise) });

    await expect(Promise.all(waits)).resolves.toBeDefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a browser without static routing installs as before', async () => {
    const waits: Promise<unknown>[] = [];

    workerOf().install!({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });

    await expect(Promise.all(waits)).resolves.toBeDefined();
  });
});
