import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { signSession } from './sessions.js';

/** «Medios» (pending 38): photos, videos, documents and links of all my chats, newest first. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
let personal: Types.ObjectId;
let secret: Types.ObjectId;
let spaceChat: Types.ObjectId;
let foreign: Types.ObjectId;
let spaceId: Types.ObjectId;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({});
let seq = 0;
const message = (chatId: Types.ObjectId, kind: Message['kind'], at: string, extra: Partial<Message> = {}): Partial<Message> => ({ chatId, seq: (seq += 1), senderId: ana, clientKey: `k${seq}`, kind, at: new Date(at), ...extra });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_media_library'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  [me, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana Torres' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  seq = 0;
  const members = [{ userId: me, role: 'admin' as const }, { userId: ana, role: 'member' as const }];
  spaceId = new Types.ObjectId();
  await WorkspaceModel.create({ _id: spaceId, name: 'QA Obra', ownerId: me, joinCode: 'QAOB-7K3P' });
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: me, phone: '902049935', role: 'owner', status: 'active' });
  personal = (await ChatModel.create({ kind: 'direct', members, lastSeq: 9 }))._id;
  secret = (await ChatModel.create({ kind: 'direct', members, encrypted: true, lastSeq: 1 }))._id;
  spaceChat = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, members, lastSeq: 1 }))._id;
  foreign = (await ChatModel.create({ kind: 'group', name: 'Ajeno', members: [{ userId: ana, role: 'admin' as const }], lastSeq: 1 }))._id;
  await MessageModel.insertMany([
    message(personal, 'image', '2026-10-20T10:00:00Z', { media: { mediaId: 'm1', url: '/files/a.jpg', thumbUrl: '/files/a-t.jpg', mime: 'image/jpeg' } }),
    message(personal, 'image', '2026-10-21T10:00:00Z', { media: { mediaId: 'm2', url: '/files/b.jpg', mime: 'image/jpeg' } }),
    message(personal, 'image', '2026-10-21T11:00:00Z', { media: { mediaId: 'm3', url: '/files/c.jpg' }, deletedAt: new Date() }),
    message(personal, 'video', '2026-10-19T10:00:00Z', { media: { mediaId: 'v1', url: '/files/v.mp4', mime: 'video/mp4' } }),
    message(personal, 'file', '2026-10-18T10:00:00Z', { media: { mediaId: 'f1', url: '/files/f.pdf', mime: 'application/pdf', fileName: 'Informe.pdf', sizeBytes: 2048 } }),
    message(personal, 'audio', '2026-10-18T11:00:00Z', { media: { mediaId: 'a1', url: '/files/n.m4a', mime: 'audio/mp4' } }),
    message(personal, 'text', '2026-10-17T10:00:00Z', { body: 'Mira esto https://constroad.com/obra y avisa' }),
    message(personal, 'text', '2026-10-17T11:00:00Z', { body: 'sin enlace' }),
    message(secret, 'image', '2026-10-21T12:00:00Z', { envelope: { v: 1, nonce: 'n', ciphertext: 'c' } }),
    message(spaceChat, 'image', '2026-10-21T13:00:00Z', { media: { mediaId: 's1', url: '/files/s.jpg' } }),
    message(foreign, 'image', '2026-10-21T14:00:00Z', { media: { mediaId: 'x1', url: '/files/x.jpg' } }),
  ]);
});

const library = async (query: string) => (await request(app).get(`/api/media/library?${query}`).set(auth(me)).expect(200)).body as { items: Record<string, unknown>[]; hasMore: boolean };

describe('GET /api/media/library', () => {
  it('my personal photos, newest first, with absolute URLs and the chat they came from; never a deleted one, a secret chat or a chat I am not in', async () => {
    const { items } = await library('type=photos');
    expect(items.map((item) => (item.media as { url: string }).url.split('/').pop())).toEqual(['b.jpg', 'a.jpg']);
    expect(items[0]).toMatchObject({ chatId: String(personal), kind: 'image', chat: { kind: 'direct', phone: '987654321' } });
    // Served through `toClientMessage`, which makes it absolute where LILA_PUBLIC_URL is set.
    expect(String((items[0]!.media as { url: string }).url)).toMatch(/\/files\/b\.jpg$/);
  });

  it('videos, documents (a voice note is not one) and links each in their tab', async () => {
    expect((await library('type=videos')).items.map((item) => item.kind)).toEqual(['video']);
    const files = (await library('type=files')).items;
    expect(files.map((item) => (item.media as { fileName?: string }).fileName)).toEqual(['Informe.pdf']);
    const links = (await library('type=links')).items;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ kind: 'text', link: 'https://constroad.com/obra' });
  });

  it('inside a space, only that space; someone outside the space gets nothing', async () => {
    expect((await library(`type=photos&workspace=${spaceId}`)).items.map((item) => item.chatId)).toEqual([String(spaceChat)]);
    const outsider = await request(app).get(`/api/media/library?type=photos&workspace=${spaceId}`).set(auth(ana)).expect(404);
    expect(outsider.body.items).toBeUndefined();
  });

  it('pages back with «before»', async () => {
    const first = await library('type=photos&limit=1');
    expect(first).toMatchObject({ hasMore: true });
    const second = await library(`type=photos&limit=1&before=${encodeURIComponent(String(first.items[0]!.at))}`);
    expect(second.items.map((item) => (item.media as { url: string }).url.split('/').pop())).toEqual(['a.jpg']);
  });
});
