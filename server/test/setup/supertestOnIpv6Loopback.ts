import { createRequire } from 'node:module';
import { Server as HttpsServer } from 'node:https';
import type { AddressInfo, Server } from 'node:net';

/**
 * supertest calls the app on `[::1]` when it listens on `::` (01/11). It used
 * to call `127.0.0.1:P`, and macOS lets another process hold `127.0.0.1:P`
 * while the app holds `[::]:P`: now and then the request reached a test
 * mongod, and a random test failed with «Parse Error: Expected HTTP/» or a
 * 20 s timeout. Nothing of the tests listens on `::1`. The app still reads
 * `Host: 127.0.0.1:P` (it validates the host), and a test can set its own.
 * Where Node binds IPv4 (no IPv6, as some runners), it stays on 127.0.0.1.
 */
type SupertestRequest = { _server?: Server; set(field: string, value: string): unknown };
type SupertestTest = { prototype: { serverAddress(this: SupertestRequest, app: Server, path: string): string } };
const { prototype } = createRequire(import.meta.url)('supertest/lib/test.js') as SupertestTest;
prototype.serverAddress = function serverAddress(app, path) {
  if (!app.address()) this._server = app.listen(0);
  const { port, family } = app.address() as AddressInfo;
  const protocol = app instanceof HttpsServer ? 'https' : 'http';
  if (family !== 'IPv6') return `${protocol}://127.0.0.1:${port}${path}`;
  this.set('Host', `127.0.0.1:${port}`);
  return `${protocol}://[::1]:${port}${path}`;
};
