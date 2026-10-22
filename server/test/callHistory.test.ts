import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** Pending 38 (José, 21/10): the web's «Llamadas», built from each chat's call lines. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
const DAY_MS = 86_400_000;

const callLine = (chatId: Types.ObjectId, seq: number, from: Types.ObjectId, valor: string, at: Date, extra: Record<string, unknown> = {}) =>
  MessageModel.create({ chatId, seq, senderId: from, clientKey: `sis-llamada-${seq}`, kind: 'system', body: 'Llamada', system: { evento: 'llamada', valor }, at, ...extra });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_call_history'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create({ _id: ana, phone: '987654321', name: 'Ana' });
});

describe('GET /api/calls/history', () => {
  it('my chats’ call lines, newest first, with who called', async () => {
    const chat = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 3 }))._id;
    const now = Date.now();
    await callLine(chat, 1, me, 'voz:42', new Date(now - 2 * DAY_MS));
    await callLine(chat, 2, ana, 'video:perdida', new Date(now - DAY_MS));
    await MessageModel.create({ chatId: chat, seq: 3, senderId: ana, clientKey: 'k3', kind: 'text', body: 'hola', at: new Date(now) });

    const { body } = await request(app).get('/api/calls/history').set(auth()).expect(200);

    expect(body.calls).toEqual([
      { chatId: String(chat), seq: 2, at: new Date(now - DAY_MS).toISOString(), valor: 'video:perdida', mine: false, title: 'Ana', phone: '987654321' },
      { chatId: String(chat), seq: 1, at: new Date(now - 2 * DAY_MS).toISOString(), valor: 'voz:42', mine: true, title: 'Ana', phone: '987654321' },
    ]);
  });

  it('a group says its name and no phone', async () => {
    const group = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'admin' }], lastSeq: 1 }))._id;
    await callLine(group, 1, ana, 'voz:5', new Date());

    const { body } = await request(app).get('/api/calls/history').set(auth()).expect(200);

    expect(body.calls[0]).toMatchObject({ chatId: String(group), title: 'Obra', phone: null });
  });

  it('leaves out other people’s chats, deleted lines and lines older than the window', async () => {
    const mine = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 3 }))._id;
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 1 }))._id;
    await callLine(foreign, 1, ana, 'voz:10', new Date());
    await callLine(mine, 1, ana, 'voz:10', new Date(), { deletedAt: new Date() });
    await callLine(mine, 2, ana, 'voz:10', new Date(Date.now() - 120 * DAY_MS));

    const { body } = await request(app).get('/api/calls/history').set(auth()).expect(200);

    expect(body.calls).toEqual([]);
  });

  it('without a session, 401', async () => {
    await request(app).get('/api/calls/history').expect(401);
  });
});
