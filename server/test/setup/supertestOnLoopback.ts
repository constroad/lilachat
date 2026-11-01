import { createRequire } from 'node:module';
import { Server as HttpsServer } from 'node:https';
import type { AddressInfo, Server } from 'node:net';

/**
 * The server supertest makes listens on 127.0.0.1, and the request leaves once
 * it does (01/11). supertest used a bare `listen(0)` (on `::`) and called
 * `127.0.0.1:P`; macOS lets another process hold `127.0.0.1:P` (a test mongod)
 * or `[::1]:P` (the emulator) at the same time, and a random test failed with
 * «Parse Error: Expected HTTP/» or a 20 s timeout. On 127.0.0.1 the system never
 * hands out a taken port, and that address goes to whoever bound it exactly.
 * Binding a host is asynchronous, so the request waits for `listening`.
 */
type SupertestTest = {
  prototype: {
    serverAddress(this: LoopbackTest, app: Server, path: string): string;
    end(this: LoopbackTest, callback?: (error: unknown, response?: unknown) => void): unknown;
  };
};
type LoopbackTest = { url: string; _server?: Server; loopbackApp?: Server; loopbackPath?: string };

const { prototype } = createRequire(import.meta.url)('supertest/lib/test.js') as SupertestTest;
const starting = new WeakMap<Server, Promise<void>>();

function urlOf(app: Server, path: string): string {
  const address = app.address() as AddressInfo | null;
  const host = !address || address.address === '::' || address.address === '0.0.0.0' ? '127.0.0.1' : address.family === 'IPv6' ? `[${address.address}]` : address.address;
  return `${app instanceof HttpsServer ? 'https' : 'http'}://${host}:${address?.port ?? 0}${path}`;
}

prototype.serverAddress = function serverAddress(app, path) {
  this.loopbackApp = app;
  this.loopbackPath = path;
  if (!app.address() && !starting.has(app)) {
    this._server = app.listen(0, '127.0.0.1');
    starting.set(app, new Promise((resolve, reject) => {
      app.once('listening', () => resolve());
      app.once('error', reject);
    }).finally(() => starting.delete(app)));
  }
  return urlOf(app, path);
};

const end = prototype.end;
prototype.end = function endOnceListening(callback) {
  const app = this.loopbackApp;
  // The URL made before `listening` carries port 0: it is made again with the real one.
  const send = () => {
    if (app?.address()) this.url = urlOf(app, this.loopbackPath ?? '');
    return end.call(this, callback);
  };
  const pending = app && starting.get(app);
  if (!pending) return send();
  pending.then(send, (error: unknown) => callback?.(error));
  return this;
};
