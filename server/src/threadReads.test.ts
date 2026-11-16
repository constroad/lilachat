import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { signSession } from './sessions.js';
import { THREAD_READ_SINCE, threadCursorsOf, threadHasNewReplies, threadReadUpTo } from './threadReads.js';

const afterCursors = new Date(THREAD_READ_SINCE.getTime() + 3_600_000);
const beforeCursors = new Date(THREAD_READ_SINCE.getTime() - 3_600_000);

describe('threadReadUpTo: a thread has its own cursor, not the chat one', () => {
  it('its cursor wins over the chat read', () => {
    expect(threadReadUpTo({ ultimaSeq: 9, ultimaEn: afterCursors }, 7, 20)).toBe(7);
  });

  it('a thread answered before the cursors existed keeps the old rule (read with the chat)', () => {
    expect(threadReadUpTo({ ultimaSeq: 9, ultimaEn: beforeCursors }, undefined, 20)).toBe(20);
  });

  it('a thread answered after, never opened, is unread from the start', () => {
    expect(threadReadUpTo({ ultimaSeq: 9, ultimaEn: afterCursors.toISOString() }, undefined, 20)).toBe(0);
  });
});

describe('threadHasNewReplies', () => {
  it('new while the last reply is past the cursor and someone else wrote it', () => {
    expect(threadHasNewReplies({ ultimaSeq: 9, autores: ['ana'] }, 7, 'me')).toBe(true);
    expect(threadHasNewReplies({ ultimaSeq: 9, autores: ['ana', 'me'] }, 7, 'me')).toBe(false);
    expect(threadHasNewReplies({ ultimaSeq: 9, autores: ['ana'] }, 9, 'me')).toBe(false);
  });
});

describe('threadCursorsOf', () => {
  it('reads a lean object or a Map, and drops what is not a root and a seq', () => {
    expect([...threadCursorsOf({ 3: 9, x: 2, 4: 'a' })]).toEqual([[3, 9]]);
    expect([...threadCursorsOf(new Map([['5', 6]]))]).toEqual([[5, 6]]);
    expect(threadCursorsOf(undefined).size).toBe(0);
  });
});

/** José, 16/11: «abro la app y no sé dónde respondieron». Reading the chat used to swallow its threads. */
describe('thread cursors over HTTP', () => {
  let mongo: MongoMemoryServer;
  const app = buildApp({});
  let me: Types.ObjectId;
  let ana: Types.ObjectId;
  let chatId: Types.ObjectId;
  const tokenOf = (userId: Types.ObjectId) => `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}`;
  const threadsUnread = async () => (await request(app).get('/api/activity?counts=1').set('Authorization', tokenOf(me)).expect(200)).body.unread.threads as number;

  beforeAll(async () => {
    mongo = await startTestMongo();
    await mongoose.connect(mongo.getUri('lilachat_thread_reads'));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReceiptModel.deleteMany({})]);
    [me, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana Torres' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
    chatId = (await ChatModel.create({ kind: 'group', name: 'planta', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 3 }))._id;
    await MessageModel.insertMany([
      { chatId, seq: 1, senderId: me, clientKey: 'k1', kind: 'text', body: '¿Llegó el asfalto?', at: afterCursors, hilo: { respuestas: 1, ultimaEn: afterCursors, ultimaSeq: 2, autores: [String(ana)] } },
      { chatId, seq: 2, senderId: ana, clientKey: 'k2', kind: 'text', body: 'Sí, 8:40', at: afterCursors, hiloDe: 1 },
      { chatId, seq: 3, senderId: ana, clientKey: 'k3', kind: 'text', body: 'Buen día', at: afterCursors },
    ]);
  });

  it('reading the whole chat leaves the thread reply as new', async () => {
    await ReceiptModel.create({ chatId, userId: me, readSeq: 3 });

    expect(await threadsUnread()).toBe(1);
  });

  it('opening the thread reads it, on every device', async () => {
    await request(app).get(`/api/chats/${chatId}/hilos/1`).set('Authorization', tokenOf(me)).expect(200);

    expect(await threadsUnread()).toBe(0);
    const { hilos } = (await request(app).get(`/api/chats/${chatId}/hilos`).set('Authorization', tokenOf(me)).expect(200)).body;
    expect(hilos).toEqual([expect.objectContaining({ raiz: 1, visto: 2 })]);
  });

  it('a reply seen live moves the cursor, and it never goes back', async () => {
    const mark = (seq: number) => request(app).post(`/api/chats/${chatId}/hilos/1/visto`).set('Authorization', tokenOf(me)).send({ seq });
    await mark(2).expect(204);
    await mark(1).expect(204);

    const receipt = await ReceiptModel.findOne({ chatId, userId: me }).lean();
    expect(threadCursorsOf(receipt?.threadSeq).get(1)).toBe(2);
  });

  it('refuses a seq that is not a number, and a chat that is not mine', async () => {
    await request(app).post(`/api/chats/${chatId}/hilos/1/visto`).set('Authorization', tokenOf(me)).send({ seq: 'x' }).expect(400);
    const outsider = (await UserModel.create({ phone: '911111111', name: 'Otro' }))._id;
    await request(app).post(`/api/chats/${chatId}/hilos/1/visto`).set('Authorization', tokenOf(outsider)).send({ seq: 2 }).expect(404);
  });
});
