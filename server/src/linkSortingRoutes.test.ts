import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import type { LinkCard } from '@lilachat/shared';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { signSession } from './sessions.js';
import { configureLinkSorting, drainLinkSorting } from './linkSorting.js';

/** José 18/11: the person corrects what Lila sorted (move, create, rename, merge). */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let jwt: string;
let strangerJwt: string;
let chatId: string;
let videoId: string;
let adsId: string;
const app = buildApp();
const as = (token: string) => ({ get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`), send: (method: 'post' | 'put' | 'patch', url: string, body: object) => request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body) });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_link_routes_test'));
  configureLinkSorting({
    readCard: async (url) => ({ url, platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi', text: 'Kokoro' }),
    classifier: { classify: async () => ({ ok: true, categoryId: null }), propose: async () => ({ ok: true, names: [] }) },
    emit: () => undefined,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await drainLinkSorting();
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  me = (await UserModel.create({ phone: '900000001', name: 'José' }))._id;
  const stranger = (await UserModel.create({ phone: '900000002', name: 'Ana' }))._id;
  jwt = signSession({ userId: String(me), deviceId: 'd1', email: 'x' });
  strangerJwt = signSession({ userId: String(stranger), deviceId: 'd2', email: 'y' });
  videoId = String(new Types.ObjectId());
  adsId = String(new Types.ObjectId());
  const chat = await ChatModel.create({
    kind: 'notas',
    name: 'IA links',
    members: [{ userId: me, role: 'admin' }],
    lastSeq: 2,
    linkSorting: { enabled: true, categories: [{ _id: videoId, name: 'Video, voz e imagen', by: 'user' }, { _id: adsId, name: 'Publicidad y ventas', by: 'user' }] },
  });
  chatId = String(chat._id);
  const link = (categoryId: string | null): LinkCard => ({ url: 'https://www.instagram.com/reel/a/', platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi', categoryId, categoryBy: 'lila' });
  await MessageModel.create([
    { chatId: chat._id, seq: 1, senderId: me, clientKey: 'a', body: 'https://www.instagram.com/reel/a/', link: link(videoId), at: new Date('2026-11-09T10:00:00Z') },
    { chatId: chat._id, seq: 2, senderId: me, clientKey: 'b', body: 'una nota', at: new Date('2026-11-10T10:00:00Z') },
  ]);
});

describe('GET /api/chats/:chatId/links', () => {
  it('gives the switch, the categories and only the messages with a card', async () => {
    const response = await as(jwt).get(`/api/chats/${chatId}/links`);
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
    expect(response.body.categories).toEqual([{ id: videoId, name: 'Video, voz e imagen' }, { id: adsId, name: 'Publicidad y ventas' }]);
    expect(response.body.items).toEqual([{ seq: 1, at: '2026-11-09T10:00:00.000Z', link: expect.objectContaining({ categoryId: videoId }) }]);
  });

  it('is not found for someone outside the chat', async () => {
    expect((await as(strangerJwt).get(`/api/chats/${chatId}/links`)).status).toBe(404);
  });
});

describe('moving and correcting', () => {
  it('moves a link and marks it as the person’s choice', async () => {
    const response = await as(jwt).send('put', `/api/chats/${chatId}/messages/1/link-category`, { categoryId: adsId });
    expect(response.status).toBe(200);
    expect((await MessageModel.findOne({ chatId, seq: 1 }).lean())?.link).toMatchObject({ categoryId: adsId, categoryBy: 'user' });
  });

  it('refuses a category of another chat and a message without a link', async () => {
    expect((await as(jwt).send('put', `/api/chats/${chatId}/messages/1/link-category`, { categoryId: String(new Types.ObjectId()) })).status).toBe(404);
    expect((await as(jwt).send('put', `/api/chats/${chatId}/messages/2/link-category`, { categoryId: adsId })).status).toBe(404);
  });

  it('creates and renames, without repeating a name', async () => {
    const created = await as(jwt).send('post', `/api/chats/${chatId}/link-categories`, { name: '  Claude y skills ' });
    expect(created.body.category.name).toBe('Claude y skills');
    expect((await as(jwt).send('post', `/api/chats/${chatId}/link-categories`, { name: 'claude Y SKILLS' })).status).toBe(409);
    expect((await as(jwt).send('patch', `/api/chats/${chatId}/link-categories/${adsId}`, { name: 'Ventas' })).status).toBe(200);
    expect((await as(jwt).send('patch', `/api/chats/${chatId}/link-categories/${adsId}`, { name: '' })).status).toBe(400);
    expect((await ChatModel.findById(chatId).lean())!.linkSorting!.categories.map((category) => category.name)).toEqual(['Video, voz e imagen', 'Ventas', 'Claude y skills']);
  });

  it('merges a category into another, or into «Sin categoría»', async () => {
    expect((await as(jwt).send('post', `/api/chats/${chatId}/link-categories/${videoId}/merge`, { into: adsId })).status).toBe(200);
    expect((await MessageModel.findOne({ chatId, seq: 1 }).lean())?.link?.categoryId).toBe(adsId);
    expect((await as(jwt).send('post', `/api/chats/${chatId}/link-categories/${adsId}/merge`, { into: null })).status).toBe(200);
    expect((await MessageModel.findOne({ chatId, seq: 1 }).lean())?.link?.categoryId).toBeNull();
    expect((await ChatModel.findById(chatId).lean())!.linkSorting!.categories).toEqual([]);
  });

  it('reads an unreadable link again on «Reintentar»', async () => {
    await MessageModel.updateOne({ chatId, seq: 1 }, { $set: { 'link.status': 'unreadable' } });
    expect((await as(jwt).send('post', `/api/chats/${chatId}/messages/1/link-refresh`, {})).status).toBe(202);
    await drainLinkSorting();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await MessageModel.findOne({ chatId, seq: 1 }).lean())?.link?.status).toBe('ready');
  });
});

describe('PUT /api/chats/:chatId/link-sorting', () => {
  it('turns the switch off and keeps the categories', async () => {
    expect((await as(jwt).send('put', `/api/chats/${chatId}/link-sorting`, { enabled: false })).status).toBe(200);
    const chat = await ChatModel.findById(chatId).lean();
    expect(chat!.linkSorting).toMatchObject({ enabled: false });
    expect(chat!.linkSorting!.categories).toHaveLength(2);
  });
});
