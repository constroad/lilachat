import { createServer, type Server as HttpServer } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose from 'mongoose';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { attachSocket } from '../src/socket.js';

/** Pending 56 (José, 29/10): a group call over the real socket, with three phones. */
let mongo: MongoMemoryServer;
let httpServer: HttpServer;
let port: number;
const open: ClientSocket[] = [];

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_group_call_test'));
  httpServer = createServer(buildApp());
  attachSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const socket of open) socket.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await new Promise((resolve) => setTimeout(resolve, 300));
  await mongoose.disconnect();
  await mongo.stop();
});

type Heard = { event: string; frame: Record<string, unknown> };
async function connect(userId: string): Promise<{ socket: ClientSocket; heard: Heard[] }> {
  const token = signSession({ userId, deviceId: `d-${userId}`, email: 'x@x.com' });
  const socket = createClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
  open.push(socket);
  const heard: Heard[] = [];
  socket.onAny((event: string, frame) => heard.push({ event, frame }));
  await new Promise((ready) => socket.on('connect', () => ready(null)));
  return { socket, heard };
}
const ask = <T>(socket: ClientSocket, event: string, frame: object) => new Promise<T>((resolve) => socket.emit(event, frame, resolve));
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('group call over the socket', () => {
  it('rings the group, relays a pair\'s signals to that socket only, and leaves its line when the last one hangs up', async () => {
    // Arrange
    const users = await UserModel.create([{ phone: '900000091', name: 'Ana' }, { phone: '900000092', name: 'Beto' }, { phone: '900000093', name: 'Caro' }]);
    const [ana, beto, caro] = users.map((user) => String(user._id)) as [string, string, string];
    const chat = await ChatModel.create({ kind: 'group', name: 'Obra', members: users.map((user) => ({ userId: user._id })), lastSeq: 0 });
    const chatId = String(chat._id);
    const [a, b, c] = await Promise.all([connect(ana), connect(beto), connect(caro)]);
    // Act
    const first = await ask<{ ok: boolean; peers: string[] }>(a.socket, 'groupcall.join', { chatId, video: true });
    const second = await ask<{ ok: boolean; peers: string[] }>(b.socket, 'groupcall.join', { chatId, video: true });
    b.socket.emit('groupcall.signal', { chatId, to: ana, kind: 'offer', data: { type: 'offer', sdp: 'v=0' } });
    await settle();
    await ask(a.socket, 'groupcall.leave', { chatId });
    b.socket.disconnect();
    await settle();
    // Assert
    expect(first).toMatchObject({ ok: true, peers: [] });
    expect(second).toMatchObject({ ok: true, peers: [ana] });
    expect(c.heard.find((one) => one.event === 'groupcall.ring')?.frame).toMatchObject({ chatId, from: ana, fromName: 'Ana', video: true });
    expect(a.heard.find((one) => one.event === 'groupcall.signal')?.frame).toMatchObject({ chatId, from: beto, kind: 'offer' });
    expect(c.heard.some((one) => one.event === 'groupcall.signal')).toBe(false);
    expect(b.heard.find((one) => one.event === 'groupcall.left')?.frame).toEqual({ chatId, userId: ana });
    expect(c.heard.filter((one) => one.event === 'groupcall.state').at(-1)?.frame).toEqual({ chatId, room: null, names: {} });
    const line = await MessageModel.findOne({ chatId, kind: 'system' }).sort({ seq: -1 }).lean();
    expect(line?.body).toBe('Videollamada grupal · 2 personas');
  });

  it('a 1:1 chat cannot have a group call', async () => {
    const users = await UserModel.create([{ phone: '900000094', name: 'Dani' }, { phone: '900000095', name: 'Eli' }]);
    const chat = await ChatModel.create({ kind: 'direct', members: users.map((user) => ({ userId: user._id })), lastSeq: 0 });
    const { socket } = await connect(String(users[0]!._id));
    expect(await ask(socket, 'groupcall.join', { chatId: String(chat._id), video: false })).toMatchObject({ ok: false });
  });
});
