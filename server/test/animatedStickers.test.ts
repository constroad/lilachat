import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { StickerModel } from '../src/stickerModel.js';
import { signSession } from '../src/sessions.js';

/** Pending 37 (José, 21/10 and 22/10): my own animated stickers, from a gallery GIF or a GIF in a chat. */
const GIF = Buffer.from('GIF89a-qa');
const WEBP = Buffer.from('RIFF-animated-webp');
const fetched: string[] = [];
let convertAnswer: Buffer | 'too-heavy' | 'not-an-image' = WEBP;
const app = buildApp({
  mediaUploader: { async upload(p) { return { ok: true, media: { url: `/files/${p.fileName}`, storageName: `st-${Date.now()}-${Math.random()}`, thumbnailUrl: '' } as never }; } },
  animatedStickers: {
    convert: async () => convertAnswer,
    fetchMedia: async (url) => (fetched.push(url), GIF),
  },
});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_animated_stickers'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  fetched.length = 0;
  convertAnswer = WEBP;
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), StickerModel.deleteMany({})]);
});

const gifMessage = async (encrypted = false) => {
  const chat = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 1, ...(encrypted ? { encrypted: true } : {}) }))._id;
  await MessageModel.create({ chatId: chat, seq: 1, senderId: ana, clientKey: 'g1', kind: 'image', media: { mediaId: 'm1', url: '/files/giphy-abc.gif', mime: 'image/gif' }, at: new Date() });
  return chat;
};

describe('POST /api/stickers/animated', () => {
  it('a gallery GIF becomes an animated sticker in «Mis stickers»', async () => {
    const { body } = await request(app).post('/api/stickers/animated').set(auth()).attach('file', GIF, { filename: 'risa.gif', contentType: 'image/gif' }).expect(201);
    expect(body.sticker).toMatchObject({ mime: 'image/webp', width: 512, height: 512, animated: true });
    await expect(StickerModel.countDocuments({ userId: me, animated: true })).resolves.toBe(1);
  });

  it('a file that is not a GIF is refused before converting', async () => {
    await request(app).post('/api/stickers/animated').set(auth()).attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
  });

  it('a GIF that cannot fit in 500 KB says so, and nothing is kept', async () => {
    convertAnswer = 'too-heavy';
    const { body } = await request(app).post('/api/stickers/animated').set(auth()).attach('file', GIF, { filename: 'largo.gif', contentType: 'image/gif' }).expect(413);
    expect(body.message).toContain('500 KB');
    await expect(StickerModel.countDocuments({})).resolves.toBe(0);
  });
});

describe('POST /api/stickers/from-gif', () => {
  it('a GIF in my chat becomes my sticker, read from the file the server stored', async () => {
    const chat = await gifMessage();
    const { body } = await request(app).post('/api/stickers/from-gif').set(auth()).send({ chatId: String(chat), seq: 1 }).expect(201);
    expect(body.sticker).toMatchObject({ animated: true });
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('/files/giphy-abc.gif');
  });

  it('someone else’s chat is 404 and a secret chat cannot be converted', async () => {
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await request(app).post('/api/stickers/from-gif').set(auth()).send({ chatId: String(foreign), seq: 1 }).expect(404);
    const secret = await gifMessage(true);
    await request(app).post('/api/stickers/from-gif').set(auth()).send({ chatId: String(secret), seq: 1 }).expect(400);
    expect(fetched).toEqual([]);
  });

  it('a message that is not a GIF is refused', async () => {
    const chat = await gifMessage();
    await MessageModel.updateOne({ chatId: chat, seq: 1 }, { $set: { 'media.mime': 'image/jpeg' } });
    await request(app).post('/api/stickers/from-gif').set(auth()).send({ chatId: String(chat), seq: 1 }).expect(400);
  });
});
