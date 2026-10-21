import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { StickerModel } from './stickerModel.js';
import { buildPushText } from './pushSender.js';
import { signSession } from './sessions.js';

/**
 * Stickers (José, 20/10: «in WhatsApp I upload a photo, the background goes
 * away, I add text and make a sticker; Lilachat must have it»). The sticker is
 * made on the phone or the web; the server keeps «Mis stickers» and sends it to
 * the chat without uploading it again.
 */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
let chatId: Types.ObjectId;
const uploads: { fileName: string; mimeType: string }[] = [];
const withJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({
  mediaUploader: {
    async upload(p) {
      uploads.push({ fileName: p.fileName, mimeType: p.mimeType });
      return { ok: true, media: { url: `/files/${p.fileName}`, storageName: `st-${uploads.length}`, thumbnailUrl: '' } as never };
    },
  },
});
const WEBP = Buffer.from('524946461a000000574542505650384c0d0000002f0000000007d0ff3fe0ffbf000000', 'hex');

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('lilachat_stickers'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  uploads.length = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), StickerModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }]);
  me = users[0]!._id;
  ana = users[1]!._id;
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: ana }], lastSeq: 0 }))._id;
});

const create = (userId: Types.ObjectId, file = WEBP, type = 'image/webp') =>
  request(app).post('/api/stickers').set(withJwt(userId)).field('width', '512').field('height', '512').attach('file', file, { filename: 'sticker.webp', contentType: type });

describe('my stickers', () => {
  it('creates one (webp or png) listed only for its owner, newest first', async () => {
    const res = await create(me);
    expect(res.status).toBe(201);
    expect(res.body.sticker).toMatchObject({ width: 512, height: 512, favorite: false });
    expect(res.body.sticker.url).toContain('/files/');
    await create(me, WEBP, 'image/png');
    const list = await request(app).get('/api/stickers').set(withJwt(me));
    expect(list.body.stickers).toHaveLength(2);
    expect((await request(app).get('/api/stickers').set(withJwt(ana))).body.stickers).toEqual([]);
  });

  it('a regular photo (jpeg) or a heavy file is not a sticker', async () => {
    expect((await create(me, WEBP, 'image/jpeg')).status).toBe(400);
    expect((await create(me, Buffer.alloc(600 * 1024, 1))).status).toBe(413);
  });

  it('favorite toggles; deleting is owner-only', async () => {
    const id = (await create(me)).body.sticker.id as string;
    expect((await request(app).patch(`/api/stickers/${id}`).set(withJwt(me)).send({ favorite: true })).body.sticker.favorite).toBe(true);
    expect((await request(app).delete(`/api/stickers/${id}`).set(withJwt(ana))).status).toBe(404);
    expect((await request(app).delete(`/api/stickers/${id}`).set(withJwt(me))).status).toBe(204);
    expect((await request(app).get('/api/stickers').set(withJwt(me))).body.stickers).toEqual([]);
  });
});

describe('sending a sticker', () => {
  it('goes to the chat as a «sticker» message without uploading again; a retry does not duplicate', async () => {
    const id = (await create(me)).body.sticker.id as string;
    const uploadsBefore = uploads.length;
    const first = await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: id, clientKey: 'k-st-1' });
    expect(first.status).toBe(201);
    expect(first.body.message).toMatchObject({ kind: 'sticker', seq: 1 });
    expect(first.body.message.media.url).toContain('/files/');
    const again = await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: id, clientKey: 'k-st-1' });
    expect(again.body.duplicate).toBe(true);
    expect(uploads.length).toBe(uploadsBefore);
    expect(await MessageModel.countDocuments({ chatId, kind: 'sticker' })).toBe(1);
  });

  it('a default pack sticker is sent from the server that hosts it, with no library entry', async () => {
    const res = await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).set('Host', 'lilachat.example').set('X-Forwarded-Proto', 'https').send({ stickerId: 'pack:lila-1/dog-ready', clientKey: 'k-pack' });
    expect(res.status).toBe(201);
    expect(res.body.message.media).toMatchObject({ mediaId: 'pack:lila-1/dog-ready', url: 'https://lilachat.example/stickers/lila-1/dog-ready.webp', width: 512, height: 512 });
    expect(await StickerModel.countDocuments({})).toBe(0);
  });

  it('goes into a thread (José, 20/10), counts on the root and can also go to the chat', async () => {
    const { sendMessage } = await import('./chatService.js');
    const root = await sendMessage({ chatId: String(chatId), senderId: ana, clientKey: 'root', body: '¿Vamos?' });
    const send = (clientKey: string, extra: Record<string, unknown>) =>
      request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).set('Host', 'lilachat.example').send({ stickerId: 'pack:lila-1/thumbs-up', clientKey, hiloDe: root.message.seq, ...extra });

    const inThread = await send('k-thread', {});
    const alsoInChat = await send('k-thread-chat', { enElChat: true });

    expect(inThread.status).toBe(201);
    expect(inThread.body.message).toMatchObject({ kind: 'sticker', hiloDe: root.message.seq });
    expect(inThread.body.message.enElChat).toBeFalsy();
    expect(alsoInChat.body.message).toMatchObject({ hiloDe: root.message.seq, enElChat: true });
    const stored = await MessageModel.findOne({ chatId, seq: root.message.seq }).lean();
    expect(stored?.hilo?.respuestas).toBe(2);
  });

  it('an unknown pack sticker or a forged host is refused', async () => {
    expect((await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: 'pack:lila-1/nope', clientKey: 'k5' })).status).toBe(404);
    expect((await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).set('Host', 'evil.com/x?').send({ stickerId: 'pack:lila-1/dog-ready', clientKey: 'k6' })).status).toBe(400);
  });

  it('another person sticker, a chat I am not in, or a secret chat: no', async () => {
    const anas = (await create(ana)).body.sticker.id as string;
    expect((await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: anas, clientKey: 'k2' })).status).toBe(404);
    const mine = (await create(me)).body.sticker.id as string;
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: new Types.ObjectId() }], lastSeq: 0 }))._id;
    expect((await request(app).post(`/api/chats/${foreign}/stickers`).set(withJwt(me)).send({ stickerId: mine, clientKey: 'k3' })).status).toBe(404);
    await ChatModel.updateOne({ _id: chatId }, { $set: { encrypted: true } });
    expect((await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: mine, clientKey: 'k4' })).status).toBe(400);
  });
});

describe('saving a received or a pack sticker', () => {
  it('a received one goes to the receiver library, once', async () => {
    const id = (await create(ana)).body.sticker.id as string;
    await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(ana)).send({ stickerId: id, clientKey: 'k-ana' });
    const saved = await request(app).post('/api/stickers/from-message').set(withJwt(me)).send({ chatId: String(chatId), seq: 1 });
    expect(saved.status).toBe(201);
    const again = await request(app).post('/api/stickers/from-message').set(withJwt(me)).send({ chatId: String(chatId), seq: 1 });
    expect(again.body.sticker.id).toBe(saved.body.sticker.id);
    expect((await request(app).get('/api/stickers').set(withJwt(me))).body.stickers).toHaveLength(1);
  });

  it('a message that is not a sticker, or from a chat I am not in: no', async () => {
    await MessageModel.create({ chatId, seq: 1, senderId: ana, clientKey: 'k-t', kind: 'text', body: 'hola', at: new Date() });
    expect((await request(app).post('/api/stickers/from-message').set(withJwt(me)).send({ chatId: String(chatId), seq: 1 })).status).toBe(400);
    const other = (await UserModel.create({ phone: '900000003' }))._id;
    expect((await request(app).post('/api/stickers/from-message').set(withJwt(other)).send({ chatId: String(chatId), seq: 1 })).status).toBe(404);
  });

  it('a pack sticker can be kept as a favorite (once); an unknown one cannot', async () => {
    const saved = await request(app).post('/api/stickers/from-pack').set(withJwt(me)).send({ stickerId: 'pack:lila-1/cat', favorite: true });
    expect(saved.status).toBe(201);
    expect(saved.body.sticker).toMatchObject({ favorite: true });
    expect(saved.body.sticker.url).toMatch(/\/stickers\/lila-1\/cat\.webp$/);
    const again = await request(app).post('/api/stickers/from-pack').set(withJwt(me)).send({ stickerId: 'pack:lila-1/cat', favorite: true });
    expect(again.body.sticker.id).toBe(saved.body.sticker.id);
    expect((await request(app).post('/api/stickers/from-pack').set(withJwt(me)).send({ stickerId: 'pack:lila-1/../x' })).status).toBe(404);
  });
});

describe('the push of a sticker', () => {
  it('says «Sticker»', () => {
    expect(buildPushText({ senderName: 'Ana', kind: 'sticker' }).body).toBe('Sticker');
  });
});
