import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { signSession } from './sessions.js';

/** José 10/11: a photo or a GIF answers a message or goes into a thread, like a text or a sticker. */
let mongo: MongoMemoryServer;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4e00000000049454e44ae426082', 'hex');
const GIF = Buffer.from('GIF89a', 'ascii');
const app = buildApp({
  mediaUploader: { async upload(params) { return { ok: true, media: { url: `/files/${params.fileName}`, storageName: `st-${params.fileName}`, sizeBytes: params.bytes.length } }; } },
  giphy: {
    apiKey: 'test-key',
    fetchers: {
      json: async () => ({ data: { id: 'abc123', images: { fixed_width: { url: 'https://media.giphy.com/media/abc123/200w.gif', width: '200', height: '150', size: '1000' } } } }),
      bytes: async () => GIF,
    },
  },
});
let ana: Types.ObjectId;
let chat: Types.ObjectId;
const asAna = { get Authorization() { return `Bearer ${signSession({ userId: String(ana), deviceId: 'd-ana', email: 'x' })}`; } };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_media_target'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  const [jose, anaUser] = await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }]);
  ana = anaUser!._id as Types.ObjectId;
  chat = (await ChatModel.create({ kind: 'group', name: 'obra', members: [{ userId: jose!._id, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 1 }))._id as Types.ObjectId;
  await MessageModel.create({ chatId: chat, seq: 1, senderId: jose!._id, clientKey: 'raiz', kind: 'text', body: '¿Cómo va el riego?' });
});

const photo = (fields: Record<string, string>) => {
  const sent = request(app).post('/api/media').set(asAna).field('chatId', String(chat)).field('clientKey', `k-${Object.keys(fields).join('-')}`);
  for (const [name, value] of Object.entries(fields)) sent.field(name, value);
  return sent.attach('file', PNG, { filename: 'foto.png', contentType: 'image/png' });
};

describe('a photo with a target', () => {
  it('answers the message it quotes', async () => {
    await photo({ replyToSeq: '1' }).expect(201);
    const sent = await MessageModel.findOne({ chatId: chat, kind: 'image' }).lean();
    expect(sent?.replyToSeq).toBe(1);
  });

  it('goes into the thread, hidden from the chat unless «También enviar al chat», and counts as a reply', async () => {
    await photo({ hiloDe: '1' }).expect(201);
    const [reply, root] = await Promise.all([MessageModel.findOne({ chatId: chat, kind: 'image' }).lean(), MessageModel.findOne({ chatId: chat, seq: 1 }).lean()]);
    expect(reply?.hiloDe).toBe(1);
    expect(reply?.enElChat).toBeUndefined();
    expect(root?.hilo?.respuestas).toBe(1);
  });
});

describe('a GIF with a target', () => {
  it('answers a message and goes into a thread', async () => {
    await request(app).post('/api/gifs/send').set(asAna).send({ chatId: String(chat), gifId: 'abc123', clientKey: 'g1', replyToSeq: 1 }).expect(201);
    await request(app).post('/api/gifs/send').set(asAna).send({ chatId: String(chat), gifId: 'abc123', clientKey: 'g2', hiloDe: 1, enElChat: true }).expect(201);
    const [answer, inThread] = await Promise.all([MessageModel.findOne({ clientKey: 'g1' }).lean(), MessageModel.findOne({ clientKey: 'g2' }).lean()]);
    expect(answer?.replyToSeq).toBe(1);
    expect([inThread?.hiloDe, inThread?.enElChat]).toEqual([1, true]);
  });
});
