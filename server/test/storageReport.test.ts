import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';

/** Pending 13: what each of my chats weighs, and the files over 5 MB. */
const app = buildApp({});
const MB = 1024 * 1024;
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
let seq = 0;
const media = (chatId: Types.ObjectId, kind: string, sizeBytes: number, extra: Record<string, unknown> = {}) =>
  MessageModel.create({ chatId, seq: ++seq, senderId: ana, clientKey: `k${seq}`, kind, media: { mediaId: `m${seq}`, sizeBytes, fileName: `f${seq}` }, at: new Date(), ...extra });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_storage_report'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  seq = 0;
});

describe('GET /api/me/storage', () => {
  it('sums each chat by kind, heaviest first, and lists the files over 5 MB', async () => {
    const work = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'admin' }], lastSeq: 9 }))._id;
    const direct = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 9 }))._id;
    await media(work, 'video', 40 * MB);
    await media(work, 'image', 2 * MB);
    await media(direct, 'file', 6 * MB);
    await media(direct, 'audio', 1 * MB);
    const { body } = await request(app).get('/api/me/storage').set(auth()).expect(200);
    expect(body.chats).toEqual([
      { chatId: String(work), bytes: 42 * MB, count: 2, byKind: { video: 40 * MB, image: 2 * MB }, chat: { kind: 'group', name: 'Obra' } },
      { chatId: String(direct), bytes: 7 * MB, count: 2, byKind: { file: 6 * MB, audio: 1 * MB }, chat: expect.objectContaining({ kind: 'direct' }) },
    ]);
    expect(body.bigFiles.map((file: { kind: string; bytes: number }) => [file.kind, file.bytes])).toEqual([['video', 40 * MB], ['file', 6 * MB]]);
    expect(body.bigFiles[0]).toMatchObject({ chatId: String(work), seq: 1, fileName: 'f1', chat: { kind: 'group', name: 'Obra' } });
  });

  it('lists every file of one chat, biggest first; someone else’s chat is a 404', async () => {
    const work = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'admin' }], lastSeq: 9 }))._id;
    await media(work, 'image', 1 * MB);
    await media(work, 'video', 9 * MB);
    await media(work, 'audio', 2 * MB);
    const { body } = await request(app).get(`/api/me/storage/chats/${work}/files`).set(auth()).expect(200);
    expect(body.files.map((file: { seq: number }) => file.seq)).toEqual([2, 3, 1]);
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 1 }))._id;
    await request(app).get(`/api/me/storage/chats/${foreign}/files`).set(auth()).expect(404);
  });

  it('leaves out what I no longer see: deleted messages, what I cleared, chats I am not in, stickers', async () => {
    const chat = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member', borradoHasta: 1 }, { userId: ana, role: 'member' }], lastSeq: 9 }))._id;
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 9 }))._id;
    await media(chat, 'video', 30 * MB);
    await media(chat, 'image', 3 * MB, { deletedAt: new Date() });
    await media(chat, 'sticker', 1 * MB);
    await media(chat, 'image', 1 * MB);
    await media(foreign, 'video', 50 * MB);
    const { body } = await request(app).get('/api/me/storage').set(auth()).expect(200);
    expect(body.chats).toEqual([{ chatId: String(chat), bytes: 1 * MB, count: 1, byKind: { image: 1 * MB }, chat: expect.objectContaining({ kind: 'direct' }) }]);
    expect(body.bigFiles).toEqual([]);
  });
});
