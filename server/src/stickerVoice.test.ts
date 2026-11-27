import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { StickerModel } from './stickerModel.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { signSession } from './sessions.js';
import type { StickerSoundCutter, VideoStickerConverter } from './soundSticker.js';
import type { StickerVoiceSpeaker, VoiceSpeech } from './stickerVoice.js';

/** José 27/11: Latin Spanish voices for stickers, admins only, only Valeria and Daniel. */
let mongo: MongoMemoryServer;
let admin: Types.ObjectId;
let member: Types.ObjectId;
const space = new Types.ObjectId();
const WEBP = Buffer.from('524946461a000000574542505650384c0d0000002f0000000007d0ff3fe0ffbf000000', 'hex');
const SPOKEN = Buffer.from('m4a-of-the-voice');
const asked: VoiceSpeech[] = [];
let answer: Awaited<ReturnType<StickerVoiceSpeaker>> = { ok: true, audio: SPOKEN };
const speak: StickerVoiceSpeaker = async (speech) => {
  asked.push(speech);
  return answer;
};
const cutSound: StickerSoundCutter = async ({ sound }) => Buffer.concat([Buffer.from('cut:'), sound]);
const fromVideo: VideoStickerConverter = async ({ soundFrom }) => ({ webp: WEBP, audio: Buffer.isBuffer(soundFrom) ? soundFrom : null });
const uploads: string[] = [];
const app = buildApp({
  animatedStickers: { cutSound, fromVideo, speak, readBytes: async () => WEBP },
  mediaUploader: {
    async upload(p) {
      uploads.push(p.fileName);
      return { ok: true, media: { url: `https://lila.test/files/a/${p.fileName}`, storageName: `st-${uploads.length}`, thumbnailUrl: '' } as never };
    },
  },
});
const withJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_sticker_voice'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  asked.length = 0;
  uploads.length = 0;
  answer = { ok: true, audio: SPOKEN };
  await Promise.all([UserModel.deleteMany({}), StickerModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000011', name: 'Admin' }, { phone: '900000012', name: 'Miembro' }]);
  admin = users[0]!._id;
  member = users[1]!._id;
  await WorkspaceMemberModel.create([
    { workspaceId: space, userId: admin, phone: '51900000011', role: 'admin', status: 'active' },
    { workspaceId: space, userId: member, phone: '51900000012', role: 'member', status: 'active' },
  ]);
});

const savedSticker = async (userId: Types.ObjectId) => (await StickerModel.create({ userId, mediaId: 'm1', url: 'https://lila.test/files/a/s.webp', mime: 'image/webp', width: 512, height: 512, animated: true }))._id;
const giveVoice = (id: Types.ObjectId, userId: Types.ObjectId, fields: Record<string, string>) => {
  const call = request(app).post(`/api/stickers/${id}/sound`).set(withJwt(userId));
  for (const [key, value] of Object.entries({ sound: 'voice:valeria', voiceText: '¡Vaciado listo!', spaceId: String(space), ...fields })) call.field(key, value);
  return call;
};

describe('a voice as the sound of a saved sticker', () => {
  it('an admin gets the phrase spoken by Valeria, kept under the voice name', async () => {
    // Arrange
    const id = await savedSticker(admin);
    // Act
    const res = await giveVoice(id, admin, {});
    // Assert
    expect(res.status).toBe(200);
    expect(asked).toEqual([{ text: '¡Vaciado listo!', voiceId: 'valeria', spaceId: String(space), userId: String(admin) }]);
    expect(uploads).toEqual(['sticker-voz-valeria.m4a']);
    expect(res.body.sticker.audioUrl).toBe('https://lila.test/files/a/sticker-voz-valeria.m4a');
  });

  it('a member, or someone outside the space, is refused before asking for the voice', async () => {
    const id = await savedSticker(member);
    expect((await giveVoice(id, member, {})).status).toBe(403);
    expect((await giveVoice(id, member, { spaceId: String(new Types.ObjectId()) })).status).toBe(403);
    expect((await giveVoice(id, member, { spaceId: 'nope' })).status).toBe(403);
    expect(asked).toHaveLength(0);
  });

  it('an empty or too long phrase, or a voice not offered, is a 400', async () => {
    const id = await savedSticker(admin);
    expect((await giveVoice(id, admin, { voiceText: '  ' })).status).toBe(400);
    expect((await giveVoice(id, admin, { voiceText: 'a'.repeat(121) })).status).toBe(400);
    expect((await giveVoice(id, admin, { sound: 'voice:lucia' })).status).toBe(400);
    expect(asked).toHaveLength(0);
  });

  it('when the voice is not available it says so and the sticker keeps its sound', async () => {
    // Arrange
    const id = await savedSticker(admin);
    answer = { ok: false, reason: 'unavailable' };
    // Act
    const res = await giveVoice(id, admin, {});
    // Assert
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('La voz no está disponible ahora. Inténtalo más tarde.');
    expect((await StickerModel.findById(id).lean())?.audioUrl).toBeUndefined();
  });

  it('the space cap is a 429', async () => {
    const id = await savedSticker(admin);
    answer = { ok: false, reason: 'limit' };
    expect((await giveVoice(id, admin, {})).status).toBe(429);
  });
});

describe('a voice for a sticker made from a video', () => {
  it('goes to the converter as its sound and is kept under the voice name', async () => {
    // Act
    const res = await request(app).post('/api/stickers/from-video').set(withJwt(admin))
      .field('sound', 'voice:daniel').field('voiceText', 'Buen trabajo').field('spaceId', String(space)).field('startMs', '0').field('endMs', '3000')
      .attach('file', Buffer.from('video'), { filename: 'clip.mp4', contentType: 'video/mp4' });
    // Assert
    expect(res.status).toBe(201);
    expect(asked.map((speech) => speech.voiceId)).toEqual(['daniel']);
    expect(uploads).toEqual(['sticker-video.webp', 'sticker-voz-daniel.m4a']);
  });

  it('a member cannot', async () => {
    const res = await request(app).post('/api/stickers/from-video').set(withJwt(member))
      .field('sound', 'voice:daniel').field('voiceText', 'Hola').field('spaceId', String(space)).field('startMs', '0').field('endMs', '3000')
      .attach('file', Buffer.from('video'), { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(403);
  });
});

describe('listening to a voice before saving', () => {
  it('an admin hears the phrase as audio', async () => {
    const res = await request(app).post('/api/stickers/voice/preview').set(withJwt(admin)).send({ voice: 'valeria', text: 'Hola', spaceId: String(space) })
      .buffer(true).parse((stream, done) => { const chunks: Buffer[] = []; stream.on('data', (chunk: Buffer) => chunks.push(chunk)); stream.on('end', () => done(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mp4');
    expect((res.body as Buffer).toString()).toBe('m4a-of-the-voice');
  });

  it('a member does not', async () => {
    expect((await request(app).post('/api/stickers/voice/preview').set(withJwt(member)).send({ voice: 'valeria', text: 'Hola', spaceId: String(space) })).status).toBe(403);
  });
});
