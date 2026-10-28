import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { callBotWebhook } from './botEvents.js';
import { configureBotLoopback, loopbackUrlOf, machineLoopbackOrigins } from './botLoopback.js';

const SECRET = 'whsec_test';
const installation = (webhookUrl: string) => ({ _id: new Types.ObjectId(), workspaceId: new Types.ObjectId(), signingSecret: SECRET, webhookUrl });
const servers: Server[] = [];

/** A stand-in for agentes: answers 200 with who it is, and keeps what it got. */
async function fakeApp(name: string): Promise<{ origin: string; hits: IncomingMessage[] }> {
  const hits: IncomingMessage[] = [];
  const server = createServer((req, res) => {
    hits.push(req);
    req.resume();
    req.on('end', () => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ text: name })));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits };
}

/** A port nobody listens on: the local app is down. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

afterEach(async () => {
  configureBotLoopback(null);
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('apps on the same machine are called by loopback (agentes, 28/10: the public hop costs 0.6–0.96 s, loopback 0.002 s)', () => {
  it('only in production, and only agentes on the port Torre gives it; the same path and query', () => {
    // Arrange
    const env = process.env.NODE_ENV;
    // Act
    const inTests = machineLoopbackOrigins();
    process.env.NODE_ENV = 'production';
    const inProduction = machineLoopbackOrigins();
    process.env.NODE_ENV = env;
    // Assert
    expect(inTests.size).toBe(0);
    expect(loopbackUrlOf('https://agentes.constroad.com/lilachat/events?v=2', inProduction)).toBe('http://127.0.0.1:3012/lilachat/events?v=2');
    expect(loopbackUrlOf('https://otra-app.example/hooks', inProduction)).toBeNull();
    expect(loopbackUrlOf('no es una url', inProduction)).toBeNull();
  });

  it('a command goes to the local app, signed the same; the public address is not touched', async () => {
    // Arrange
    const local = await fakeApp('local');
    configureBotLoopback(new Map([['agentes.test', local.origin]]));
    // Act
    const reply = await callBotWebhook(installation('https://agentes.test/lilachat/events'), 'command.invoked', { command: '/clima' }, 3_000);
    // Assert
    expect(reply).toEqual({ status: 200, body: { text: 'local' } });
    expect(local.hits).toHaveLength(1);
    expect(local.hits[0]!.url).toBe('/lilachat/events');
    expect(local.hits[0]!.headers['x-lilachat-signature']).toMatch(/^v1=/);
  });

  it('when nobody listens locally, the same delivery goes by the public address', async () => {
    // Arrange
    const port = await closedPort();
    const publicApp = await fakeApp('public');
    configureBotLoopback(new Map([['localhost', `http://127.0.0.1:${port}`]]));
    const publicUrl = `${publicApp.origin.replace('127.0.0.1', 'localhost')}/hooks`;
    // Act
    const reply = await callBotWebhook(installation(publicUrl), 'command.invoked', { command: '/clima' }, 3_000);
    // Assert
    expect(reply).toEqual({ status: 200, body: { text: 'public' } });
    expect(publicApp.hits).toHaveLength(1);
  });
});
