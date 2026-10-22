import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';

/**
 * Pending 44 (José, 22/10: «Ese mensaje está más arriba: sube para cargarlo»):
 * a window around an old message, and its pages down, like WhatsApp Web.
 */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
let chatId: Types.ObjectId;
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
const seqsOf = (body: { messages: { seq: number }[] }) => body.messages.map((message) => message.seq);
const page = (query: string) => request(app).get(`/api/chats/${chatId}/messages?${query}`).set(auth());

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_message_window'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 120 }))._id;
  await MessageModel.insertMany(Array.from({ length: 120 }, (_, index) => ({ chatId, seq: index + 1, senderId: index % 2 ? me : ana, clientKey: `k${index + 1}`, kind: 'text', body: `m${index + 1}`, at: new Date(Date.UTC(2026, 9, 1, 0, index)) })));
});

describe('GET /api/chats/:chatId/messages?around', () => {
  it('half before (the target included) and half after, with what is beyond on each side', async () => {
    const { body } = await page('around=60&limit=10').expect(200);
    expect(seqsOf(body)).toEqual([56, 57, 58, 59, 60, 61, 62, 63, 64, 65]);
    expect(body).toMatchObject({ hasOlder: true, hasNewer: true, lastSeq: 120 });
  });

  it('near the beginning there is nothing older', async () => {
    const { body } = await page('around=3&limit=10').expect(200);
    expect(seqsOf(body)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(body).toMatchObject({ hasOlder: false, hasNewer: true });
  });

  it('near the end there is nothing newer', async () => {
    const { body } = await page('around=118&limit=10').expect(200);
    expect(seqsOf(body)).toEqual([114, 115, 116, 117, 118, 119, 120]);
    expect(body).toMatchObject({ hasOlder: true, hasNewer: false });
  });

  it('what I emptied «for me» does not come back through a window', async () => {
    await ChatModel.updateOne({ _id: chatId, 'members.userId': me }, { $set: { 'members.$.borradoHasta': 58 } });
    const { body } = await page('around=60&limit=10').expect(200);
    expect(seqsOf(body)).toEqual([59, 60, 61, 62, 63, 64, 65]);
    expect(body.hasOlder).toBe(false);
  });
});

describe('GET /api/chats/:chatId/messages?afterSeq', () => {
  it('the page after a message, oldest first, and whether there is more', async () => {
    const first = (await page('afterSeq=100&limit=10').expect(200)).body;
    expect(seqsOf(first)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
    expect(first.hasNewer).toBe(true);
    const last = (await page('afterSeq=115&limit=10').expect(200)).body;
    expect(seqsOf(last)).toEqual([116, 117, 118, 119, 120]);
    expect(last.hasNewer).toBe(false);
  });
});

describe('the page parameters', () => {
  it('only one of beforeSeq, afterSeq or around', async () => {
    const { body } = await page('around=60&afterSeq=10').expect(400);
    expect(body.message).toBe('Usa solo uno: beforeSeq, afterSeq o around.');
  });

  it('beforeSeq answers as always (old phones and webs)', async () => {
    const { body } = await page('beforeSeq=11&limit=5').expect(200);
    expect(seqsOf(body)).toEqual([6, 7, 8, 9, 10]);
    expect(body.hasOlder).toBeUndefined();
  });

  it('someone else’s chat is 403', async () => {
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await request(app).get(`/api/chats/${foreign}/messages?around=1`).set(auth()).expect(403);
  });
});
