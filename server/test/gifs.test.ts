import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import type { MediaUploader } from '../src/mediaClient.js';
import type { GiphyFetchers } from '../src/gifRoutes.js';

/** Backlog 37 (José, 21/10): GIPHY through the server; the key never leaves it. */
const giphyItem = (id: string) => ({ id, title: `GIF ${id}`, images: { fixed_width_small: { url: `https://media.giphy.com/media/${id}/100w.gif`, webp: `https://media.giphy.com/media/${id}/100w.webp`, width: '100', height: '75' }, fixed_width: { url: `https://media.giphy.com/media/${id}/200w.gif`, width: '200', height: '150', size: '1000' } } });
const urls: string[] = [];
const fetchers: GiphyFetchers = {
  json: vi.fn(async (url: string) => (urls.push(url), url.includes('/gifs/abc') ? { data: giphyItem('abc') } : { data: [giphyItem('a1'), giphyItem('a2')] })),
  bytes: vi.fn(async () => Buffer.from('GIF89a-fake')),
};
const uploads: { mimeType: string; fileName: string }[] = [];
const uploader: MediaUploader = {
  upload: async (params) => (uploads.push({ mimeType: params.mimeType, fileName: params.fileName }), { ok: true, media: { storageName: 's1', url: '/media/s1.gif', thumbnailUrl: '/media/s1-thumb.jpg' } }),
} as MediaUploader;
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let chat: Types.ObjectId;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const withKey = buildApp({ mediaUploader: uploader, giphy: { apiKey: 'k-test', fetchers } });
const withoutKey = buildApp({ mediaUploader: uploader, giphy: { apiKey: '', fetchers } });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_gifs'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  urls.length = 0;
  uploads.length = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  me = (await UserModel.create({ phone: '900000001', name: 'José' }))._id;
  chat = (await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: new Types.ObjectId() }], lastSeq: 0 }))._id;
});

describe('GIPHY through the server', () => {
  it('without a key the panel does not show the tab, and nothing is searched', async () => {
    expect((await request(withoutKey).get('/api/gifs').set(auth(me)).expect(200)).body).toEqual({ available: false });
    await request(withoutKey).get('/api/gifs/search').set(auth(me)).expect(404);
    expect(urls).toEqual([]);
  });

  it('with a key: trending without words, search with them, pg-13, and the key only in the server request', async () => {
    expect((await request(withKey).get('/api/gifs').set(auth(me)).expect(200)).body).toEqual({ available: true });
    const trending = (await request(withKey).get('/api/gifs/search').set(auth(me)).expect(200)).body;
    expect(trending.gifs.map((gif: { id: string }) => gif.id)).toEqual(['a1', 'a2']);
    expect(urls[0]).toContain('/v1/gifs/trending?');
    await request(withKey).get('/api/gifs/search').query({ q: 'buen trabajo', offset: '24' }).set(auth(me)).expect(200);
    expect(urls[1]).toContain('/v1/gifs/search?');
    expect(urls[1]).toContain('q=buen+trabajo');
    expect(urls[1]).toContain('offset=24');
    expect(urls.every((url) => url.includes('rating=pg-13') && url.includes('api_key=k-test'))).toBe(true);
    expect(JSON.stringify(trending)).not.toContain('k-test');
  });

  it('sending a GIF stores the 200 px GIF and posts it as an animated image; the same key twice is one message', async () => {
    const body = { chatId: String(chat), gifId: 'abc', clientKey: 'gif-1' };
    const sent = (await request(withKey).post('/api/gifs/send').set(auth(me)).send(body).expect(201)).body;
    expect(uploads).toEqual([{ mimeType: 'image/gif', fileName: 'giphy-abc.gif' }]);
    expect(sent.message).toMatchObject({ kind: 'image', media: expect.objectContaining({ mime: 'image/gif', width: 200, height: 150 }) });
    await request(withKey).post('/api/gifs/send').set(auth(me)).send(body).expect(200);
    expect(await MessageModel.countDocuments({ chatId: chat })).toBe(1);
    expect(uploads).toHaveLength(1);
  });

  it('outside the chat, 403; a bad id, 400', async () => {
    const stranger = (await UserModel.create({ phone: '900000002', name: 'Otro' }))._id;
    await request(withKey).post('/api/gifs/send').set(auth(stranger)).send({ chatId: String(chat), gifId: 'abc', clientKey: 'k' }).expect(403);
    await request(withKey).post('/api/gifs/send').set(auth(me)).send({ chatId: String(chat), gifId: '../x', clientKey: 'k' }).expect(400);
  });
});
