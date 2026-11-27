import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { StickerModel } from './stickerModel.js';
import { buildPushText } from './pushSender.js';
import { signSession } from './sessions.js';
import type { StickerSoundCutter, VideoStickerConverter } from './soundSticker.js';
import type { StickerVideoMaker } from './stickerVideo.js';

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
/** What the video converter was asked (ffmpeg runs for real in `soundSticker.test.ts`). */
const conversions: { durationMs: number; soundFrom: string }[] = [];
const fromVideo: VideoStickerConverter = async ({ video, window, soundFrom }) => {
  conversions.push({ durationMs: window.durationMs, soundFrom: soundFrom === null ? 'none' : soundFrom === 'video' ? 'video' : 'file' });
  if (video.toString() === 'broken') return 'not-a-video';
  return { webp: WEBP, audio: soundFrom === null ? null : Buffer.alloc(2_000, 1) };
};
/** What the sound cutter got (ffmpeg runs for real in `soundSticker.test.ts`): the size of each sound. */
const soundCuts: { bytes: number }[] = [];
const cutSound: StickerSoundCutter = async ({ sound }) => {
  soundCuts.push({ bytes: sound.length });
  return Buffer.alloc(2_000, 2);
};
/** What the export got: the picture, and the sound when there is one. */
const exports: { picture: string; sound: string | null }[] = [];
const makeVideo: StickerVideoMaker = async ({ picture, sound }) => {
  exports.push({ picture: picture.toString('hex').slice(0, 8), sound: sound?.toString() ?? null });
  return Buffer.from('mp4-bytes');
};
const readBytes = async (url: string) => (url.includes('/unreachable/') ? null : url.endsWith('.m4a') || url.includes('/sonidos/') ? Buffer.from(`sound:${url.split('/').pop()}`) : WEBP);
const app = buildApp({
  animatedStickers: { fromVideo, cutSound, makeVideo, readBytes },
  mediaUploader: {
    async upload(p) {
      uploads.push({ fileName: p.fileName, mimeType: p.mimeType });
      return { ok: true, media: { url: `/files/${p.fileName}`, storageName: `st-${uploads.length}`, thumbnailUrl: '' } as never };
    },
  },
});
const WEBP = Buffer.from('524946461a000000574542505650384c0d0000002f0000000007d0ff3fe0ffbf000000', 'hex');

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_stickers'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  uploads.length = 0;
  conversions.length = 0;
  soundCuts.length = 0;
  exports.length = 0;
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

/** José 26/11: an animated sticker with sound from a video (designs ss-01…ss-04). */
describe('a sticker with sound from a video', () => {
  const VIDEO = Buffer.from('a video');
  const fromVideoRequest = (fields: Record<string, string>, video = VIDEO, audio?: Buffer) => {
    let pending = request(app).post('/api/stickers/from-video').set(withJwt(me)).set('Host', 'lilachat.example').set('X-Forwarded-Proto', 'https');
    for (const [name, value] of Object.entries(fields)) pending = pending.field(name, value);
    pending = pending.attach('file', video, { filename: 'clip.mp4', contentType: 'video/mp4' });
    return audio ? pending.attach('audio', audio, { filename: 'voz.webm', contentType: 'audio/webm' }) : pending;
  };

  it('keeps the video sound next to an animated sticker in «Mis stickers»', async () => {
    // Act
    const res = await fromVideoRequest({ startMs: '12000', endMs: '20000', sound: 'original' });
    // Assert
    expect(res.status).toBe(201);
    expect(res.body.sticker).toMatchObject({ animated: true, width: 512, height: 512 });
    expect(res.body.sticker.audioUrl).toMatch(/sticker-sonido\.m4a$/);
    expect(conversions).toEqual([{ durationMs: 6_000, soundFrom: 'video' }]);
    expect(uploads.map((upload) => upload.mimeType)).toEqual(['image/webp', 'audio/mp4']);
  });

  it('a recorded or uploaded sound goes to the converter', async () => {
    const res = await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'file' }, VIDEO, Buffer.from('voice'));
    expect(res.status).toBe(201);
    expect(conversions).toEqual([{ durationMs: 3_000, soundFrom: 'file' }]);
  });

  it('a Lilachat sound is our own file served by the web: nothing is uploaded for it', async () => {
    const res = await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'preset:bocina' });
    expect(res.status).toBe(201);
    expect(res.body.sticker.audioUrl).toBe('https://lilachat.example/sonidos/wink-horn.mp3');
    expect(uploads).toHaveLength(1);
  });

  it('with no sound it is a plain animated sticker', async () => {
    const res = await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'none' });
    expect(res.status).toBe(201);
    expect(res.body.sticker.audioUrl).toBeUndefined();
  });

  it('the sound travels with the sticker into the chat and when someone saves it', async () => {
    // Arrange
    const id = (await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'original' })).body.sticker.id;
    // Act
    const sent = await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: id, clientKey: 'k-sound' });
    const saved = await request(app).post('/api/stickers/from-message').set(withJwt(ana)).send({ chatId: String(chatId), seq: sent.body.message.seq });
    // Assert
    expect(sent.body.message.media).toMatchObject({ animated: true });
    expect(sent.body.message.media.audioUrl).toMatch(/sticker-sonido\.m4a$/);
    expect(saved.body.sticker.audioUrl).toBe(sent.body.message.media.audioUrl);
  });

  it('a GIF makes one too (José 26/11: «¿por qué no desde un GIF con audio?»)', async () => {
    const res = await request(app).post('/api/stickers/from-video').set(withJwt(me)).set('Host', 'lilachat.example')
      .field('startMs', '0').field('endMs', '4000').field('sound', 'preset:risa').attach('file', Buffer.from('a gif'), { filename: 'a.gif', contentType: 'image/gif' });
    expect(res.status).toBe(201);
    expect(res.body.sticker.audioUrl).toBe('http://lilachat.example/sonidos/wink-laugh.mp3');
  });

  it('refuses what cannot make a sticker', async () => {
    expect((await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'loud' })).status).toBe(400);
    expect((await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'file' })).status).toBe(400);
    expect((await fromVideoRequest({ startMs: '3000', endMs: '3000', sound: 'none' })).status).toBe(400);
    expect((await fromVideoRequest({ startMs: '0', endMs: '3000', sound: 'none' }, Buffer.from('broken'))).status).toBe(400);
    const photo = await request(app).post('/api/stickers/from-video').set(withJwt(me)).field('startMs', '0').field('endMs', '3000').field('sound', 'none').attach('file', WEBP, { filename: 'a.webp', contentType: 'image/webp' });
    expect(photo.status).toBe(400);
    expect(await StickerModel.countDocuments({})).toBe(0);
  });
});

/** José 27/11: «ya tengo un sticker en mis favoritos… quiero agregarle audio sin volver a buscar el GIF». */
describe('the sound of a saved sticker', () => {
  const soundRequest = (id: string, fields: Record<string, string>, audio?: Buffer, userId = me) => {
    let pending = request(app).post(`/api/stickers/${id}/sound`).set(withJwt(userId)).set('Host', 'lilachat.example').set('X-Forwarded-Proto', 'https');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    return audio ? pending.attach('audio', audio, { filename: 'voz.webm', contentType: 'audio/webm' }) : pending;
  };
  const saved = async () => (await create(me)).body.sticker.id as string;

  it('one of ours: the sticker keeps its picture and gets the sound', async () => {
    // Arrange
    const id = await saved();
    // Act
    const res = await soundRequest(id, { sound: 'preset:risa' });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.sticker).toMatchObject({ id, audioUrl: 'https://lilachat.example/sonidos/wink-laugh.mp3' });
    expect((await StickerModel.findById(id).lean())?.audioUrl).toBe('https://lilachat.example/sonidos/wink-laugh.mp3');
    expect(soundCuts).toHaveLength(0);
  });

  it('a recorded or uploaded one is cut to the sticker and saved as its own audio', async () => {
    const id = await saved();
    const before = uploads.length;
    const res = await soundRequest(id, { sound: 'file' }, Buffer.from('voice'));
    expect(res.status).toBe(200);
    expect(uploads.slice(before)).toEqual([{ fileName: 'sticker-sonido.m4a', mimeType: 'audio/mp4' }]);
    expect(res.body.sticker.audioUrl).toMatch(/sticker-sonido\.m4a$/);
    expect(soundCuts).toHaveLength(1);
  });

  it('«Sin sonido» takes it away; changing it again replaces it', async () => {
    const id = await saved();
    await soundRequest(id, { sound: 'preset:bocina' }).expect(200);
    await soundRequest(id, { sound: 'preset:aplausos' }).expect(200);
    expect((await StickerModel.findById(id).lean())?.audioUrl).toMatch(/wink-clap\.mp3$/);
    const quiet = await soundRequest(id, { sound: 'none' });
    expect(quiet.status).toBe(200);
    expect(quiet.body.sticker.audioUrl).toBeUndefined();
    expect((await StickerModel.findById(id).lean())?.audioUrl).toBeUndefined();
  });

  it('a sticker already sent keeps the sound it had in the chat', async () => {
    const id = await saved();
    await request(app).post(`/api/chats/${chatId}/stickers`).set(withJwt(me)).send({ stickerId: id, clientKey: 'k-sound-1' }).expect(201);
    await soundRequest(id, { sound: 'preset:risa' }).expect(200);
    const sent = await MessageModel.findOne({ chatId, kind: 'sticker' }).lean();
    expect(sent?.media?.audioUrl).toBeUndefined();
  });

  it('only my own sticker, and only a sound it can carry', async () => {
    const id = await saved();
    expect((await soundRequest(id, { sound: 'preset:risa' }, undefined, ana)).status).toBe(404);
    expect((await soundRequest(new Types.ObjectId().toString(), { sound: 'preset:risa' })).status).toBe(404);
    expect((await soundRequest('not-an-id', { sound: 'preset:risa' })).status).toBe(404);
    // A saved sticker has no video: «Sonido original» does not apply.
    expect((await soundRequest(id, { sound: 'original' })).status).toBe(400);
    expect((await soundRequest(id, { sound: 'file' })).status).toBe(400);
    expect((await soundRequest(id, { sound: 'loud' })).status).toBe(400);
  });
});

/** José 27/11: «exportarlo para usarlo en WhatsApp» (design sa-05): the video with its sound, for WhatsApp's «Crear sticker». */
describe('exporting a saved sticker', () => {
  const exportRequest = (id: string, userId = me) => request(app).get(`/api/stickers/${id}/export.mp4`).set(withJwt(userId)).buffer(true).parse((res, done) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });

  it('one with sound comes as an MP4 with that sound', async () => {
    // Arrange: a sticker that got «Risa»
    const id = (await create(me)).body.sticker.id as string;
    await request(app).post(`/api/stickers/${id}/sound`).set(withJwt(me)).set('Host', 'lilachat.example').set('X-Forwarded-Proto', 'https').field('sound', 'preset:risa').expect(200);
    // Act
    const res = await exportRequest(id);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['content-disposition']).toContain('sticker-lilachat.mp4');
    expect((res.body as Buffer).toString()).toBe('mp4-bytes');
    expect(exports).toEqual([{ picture: '52494646', sound: 'sound:wink-laugh.mp3' }]);
  });

  it('a sound that cannot be read is an error, never a silent video (E2E 27/11)', async () => {
    // Arrange: an animated sticker whose sound address does not answer
    const id = (await create(me)).body.sticker.id as string;
    await StickerModel.updateOne({ _id: id }, { $set: { audioUrl: 'http://10.0.2.2:4003/unreachable/wink-laugh.mp3' } });
    // Act
    const res = await exportRequest(id);
    // Assert
    expect(res.status).toBe(503);
    expect(exports).toHaveLength(0);
  });

  it('a still one without sound is only a picture: no video', async () => {
    const id = (await create(me)).body.sticker.id as string;
    expect((await exportRequest(id)).status).toBe(400);
    expect(exports).toHaveLength(0);
  });

  it('only my own', async () => {
    const id = (await create(me)).body.sticker.id as string;
    expect((await exportRequest(id, ana)).status).toBe(404);
    expect((await exportRequest('nope')).status).toBe(404);
  });
});
