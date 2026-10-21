import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server as SocketServer, type Socket } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { registerAgendaRelay } from './agendaRelay.js';

const ROOM = (userId: string) => `user:${userId}`;
const QUIET_MS = 300;

let io: SocketServer;
let url = '';
const clients: ClientSocket[] = [];

beforeAll(async () => {
  const http = createServer();
  io = new SocketServer(http);
  io.use((socket: Socket & { deviceId?: string; userKey?: string }, next) => {
    socket.deviceId = String(socket.handshake.auth.deviceId);
    socket.userKey = String(socket.handshake.auth.userId);
    next();
  });
  io.on('connection', (socket: Socket & { deviceId?: string; userKey?: string }) => {
    const userId = socket.userKey ?? '';
    void socket.join(ROOM(userId));
    registerAgendaRelay(io, socket, userId, ROOM(userId));
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(() => {
  for (const client of clients) client.disconnect();
  io.close();
});

async function join(userId: string, deviceId: string): Promise<ClientSocket> {
  const client = connect(url, { auth: { userId, deviceId }, transports: ['websocket'] });
  clients.push(client);
  await new Promise<void>((resolve) => client.on('connect', () => resolve()));
  return client;
}

function next<T>(client: ClientSocket, event: string): Promise<T | 'nothing'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('nothing'), QUIET_MS);
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Contacts on the web through the phone (José, 20/10, option «b»). */
describe('agenda relay', () => {
  it('the web asks, only that user’s phone answers, and the names reach the web that asked', async () => {
    const phone = await join('ana', 'phone-1');
    const web = await join('ana', 'vinculado-web-1');
    const otherWeb = await join('ana', 'vinculado-web-2');
    const stranger = await join('beto', 'phone-2');
    phone.on('agenda.pedido', ({ requestId, phones }: { requestId: string; phones: string[] }) => {
      expect(phones).toEqual(['960397018']);
      phone.emit('agenda.respuesta', { requestId, nombres: { '960397018': 'Wilson', '902049935': 'Mamá' } });
    });
    const strangerAsked = next(stranger, 'agenda.pedido');
    const otherWebGot = next(otherWeb, 'agenda.nombres');

    const names = next<{ nombres: Record<string, string> }>(web, 'agenda.nombres');
    web.emit('agenda.pedir', { phones: ['+51 960 397 018'] });

    expect(await names).toEqual({ nombres: { '960397018': 'Wilson' } });
    expect(await strangerAsked).toBe('nothing');
    expect(await otherWebGot).toBe('nothing');
  });

  it('a phone cannot ask, and a web cannot answer', async () => {
    const phone = await join('carla', 'phone-3');
    const web = await join('carla', 'vinculado-web-3');
    const webAsked = next(web, 'agenda.pedido');
    phone.emit('agenda.pedir', { phones: ['960397018'] });
    expect(await webAsked).toBe('nothing');

    let requestId = '';
    phone.once('agenda.pedido', (payload: { requestId: string }) => {
      requestId = payload.requestId;
    });
    const names = next(web, 'agenda.nombres');
    web.emit('agenda.pedir', { phones: ['960397018'] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    web.emit('agenda.respuesta', { requestId, nombres: { '960397018': 'Falso' } });
    expect(await names).toBe('nothing');
  });

  it('another user’s phone cannot answer someone else’s request', async () => {
    const phone = await join('dora', 'phone-4');
    const web = await join('dora', 'vinculado-web-4');
    const intruder = await join('eva', 'phone-5');
    phone.once('agenda.pedido', ({ requestId }: { requestId: string }) => {
      intruder.emit('agenda.respuesta', { requestId, nombres: { '960397018': 'Intruso' } });
    });
    const names = next(web, 'agenda.nombres');
    web.emit('agenda.pedir', { phones: ['960397018'] });
    expect(await names).toBe('nothing');
  });
});
