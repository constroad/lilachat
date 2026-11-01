import { createServer } from 'node:http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

/**
 * 01/11: three tests failed now and then with «Parse Error: Expected HTTP/» or
 * a 20 s timeout. supertest listened on `::` and called `127.0.0.1:P`, and
 * macOS let another process (a test mongod, the emulator on `[::1]`) hold that
 * port at the same time. The kernel picks the port, so the collision cannot be
 * forced here: what is checked is that supertest's server is on 127.0.0.1.
 */
describe('supertest reaches the app on 127.0.0.1, not whoever else shares its port', () => {
  it('its server listens on 127.0.0.1 itself, not on every address', async () => {
    // Arrange
    const app = createServer((req, res) => res.end(req.socket.localAddress));
    // Act
    const response = await request(app).get('/');
    // Assert: on `::` the app would see the mapped `::ffff:127.0.0.1`.
    expect(response.text).toBe('127.0.0.1');
  });

  it('a request built before the server listens still goes out, with its body', async () => {
    const app = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => res.end(`${req.headers.host?.startsWith('127.0.0.1:')}:${body}`));
    });
    const response = await request(app).post('/x').send('hola');
    expect(response.text).toBe('true:hola');
  });

  it('sent after an await, once the server already listens, it still finds the port', async () => {
    const app = createServer((_req, res) => res.end('ok'));
    const pending = request(app).get('/');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await pending).text).toBe('ok');
  });
});
