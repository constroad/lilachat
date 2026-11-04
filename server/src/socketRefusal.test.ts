import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server as SocketServer } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';

const VALID_TOKEN = 'jwt-new';
const EXPIRED_TOKEN = 'jwt-expired';
const WATCH_MS = 1_500;

let io: SocketServer;
let url = '';
let handshakes = 0;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  const http = createServer();
  io = new SocketServer(http);
  io.use((socket, next) => {
    handshakes += 1;
    next(socket.handshake.auth.token === VALID_TOKEN ? undefined : new Error('unauthorized'));
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(() => {
  for (const client of clients) client.disconnect();
  io.close();
});

function refusedClient(): Promise<ClientSocket> {
  const client = connect(url, { auth: { token: EXPIRED_TOKEN }, transports: ['websocket'], reconnectionDelay: 50, reconnectionDelayMax: 100 });
  clients.push(client);
  return new Promise((resolve) => client.once('connect_error', () => resolve(client)));
}

/**
 * What the app's recovery stands on (04/11/2026): a process alive 27 h with its
 * 24 h JWT sat in «Conectando…» against a healthy server, because socket.io does
 * not retry a handshake the server refused.
 */
describe('a handshake refused by the server', () => {
  it('is not retried by socket.io: someone has to renew the token', async () => {
    // Arrange
    handshakes = 0;
    // Act
    const client = await refusedClient();
    await new Promise((resolve) => setTimeout(resolve, WATCH_MS));
    // Assert
    expect(handshakes).toBe(1);
    expect(client.active).toBe(false);
    expect(client.connected).toBe(false);
  });

  it('connects on the same socket, listeners included, with the new token', async () => {
    // Arrange
    const client = await refusedClient();
    const connected = new Promise<void>((resolve) => client.once('connect', () => resolve()));
    // Act
    client.auth = { token: VALID_TOKEN };
    client.connect();
    await connected;
    // Assert
    expect(client.connected).toBe(true);
  });
});
