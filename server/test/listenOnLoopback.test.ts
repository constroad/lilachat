import { createServer } from 'node:http';
import { createServer as createTcpServer, type AddressInfo, type Server } from 'node:net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

/**
 * 01/11: three tests failed now and then with «Parse Error: Expected HTTP/» or
 * a 20 s timeout. supertest called `127.0.0.1:P` while the app listened on
 * `[::]:P`, and macOS let a test mongod hold `127.0.0.1:P` at the same time.
 */
const listening = (server: Server, port: number, host: string) =>
  new Promise<boolean>((resolve) => {
    server.once('error', () => resolve(false));
    server.listen(port, host, () => resolve(true));
  });

describe('supertest reaches the app, not whoever else holds its port', () => {
  it('another process on 127.0.0.1 with the same port does not get the request', async () => {
    // Arrange: the collision, on purpose.
    const intruder = createTcpServer((socket) => socket.end('NOT-HTTP\r\n'));
    await listening(intruder, 0, '127.0.0.1');
    const port = (intruder.address() as AddressInfo).port;
    const app = createServer((_req, res) => res.end('ok'));
    const shared = await listening(app, port, '::');
    try {
      // Linux (and a runner without IPv6) refuses the shared port: there the collision cannot happen.
      if (!shared) return;
      // Act
      const response = await request(app).get('/');
      // Assert
      expect(response.text).toBe('ok');
    } finally {
      app.close();
      intruder.close();
    }
  });
});
