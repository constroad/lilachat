import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel, ReceiptModel, type Message } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { signSession } from './sessions.js';

/** «Menciones y actividad» (design e-19): mentions of me, the threads I am in and reactions to my messages, in a space or personal. */
let mongo: MongoMemoryServer;
const app = buildApp({});
let me: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
let outsideGroup: Types.ObjectId;
let seq = 0;
const auth = { get Authorization() { return `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}`; } };
const message = (chatId: Types.ObjectId, senderId: Types.ObjectId, at: string, extra: Partial<Message> = {}): Partial<Message> => ({ chatId, seq: (seq += 1), senderId, clientKey: `k${seq}`, kind: 'text', at: new Date(at), ...extra });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_activity'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  seq = 0;
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReceiptModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  [me, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana Torres' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: me, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: me, phone: '902049935', role: 'owner', status: 'active' });
  const members = [{ userId: me, role: 'admin' as const }, { userId: ana, role: 'member' as const }];
  channel = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members, lastSeq: 9 }))._id;
  outsideGroup = (await ChatModel.create({ kind: 'group', name: 'Familia', members, lastSeq: 9 }))._id;
  await MessageModel.insertMany([
    message(channel, ana, '2026-10-21T15:42:00Z', { body: '@José necesitamos confirmar', menciones: [{ userId: String(me), desde: 0, largo: 5 }] }),
    message(channel, ana, '2026-10-20T21:20:00Z', { body: '@todos facturas cargadas', menciones: [{ userId: 'todos', desde: 0, largo: 6 }] }),
    message(channel, ana, '2026-10-21T16:00:00Z', { body: 'sin mención' }),
    message(channel, me, '2026-10-21T12:00:00Z', { body: 'Mi pregunta', hilo: { respuestas: 2, ultimaEn: new Date('2026-10-21T17:00:00Z'), ultimaSeq: 9, autores: [String(ana)] }, reacciones: [{ userId: String(ana), emoji: '👍', en: new Date('2026-10-21T13:00:00Z') }] }),
    message(outsideGroup, ana, '2026-10-21T15:00:00Z', { body: '@José ven a almorzar', menciones: [{ userId: String(me), desde: 0, largo: 5 }] }),
  ]);
  // I read the channel up to the second message: the first mention (seq 1) is read, the @todos (seq 2) too.
  await ReceiptModel.create({ chatId: channel, userId: me, readSeq: 1 });
});

const activity = async (query: string) => (await request(app).get(`/api/activity?${query}`).set(auth).expect(200)).body as { items: Record<string, unknown>[]; unread: Record<string, number> };

describe('GET /api/activity', () => {
  it('mentions of me in a space, by name and @todos, newest first, with the chat and the author, and which are unread', async () => {
    const { items, unread } = await activity(`type=mentions&workspace=${spaceId}`);
    expect(items.map((item) => item.body)).toEqual(['@José necesitamos confirmar', '@todos facturas cargadas']);
    expect(items[0]).toMatchObject({ chatId: String(channel), chat: { kind: 'group', name: 'planta', channel: true }, author: { id: String(ana), name: 'Ana Torres' }, unread: false });
    expect(items[1]).toMatchObject({ unread: true });
    expect(unread).toEqual({ mentions: 1, threads: 1 });
  });

  it('the personal account has its own, apart from the space', async () => {
    const { items } = await activity('type=mentions');
    expect(items.map((item) => item.body)).toEqual(['@José ven a almorzar']);
  });

  it('threads I am in, by their last reply; reactions of others to my messages', async () => {
    const threads = (await activity(`type=threads&workspace=${spaceId}`)).items;
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ body: 'Mi pregunta', thread: { replies: 2 }, at: '2026-10-21T17:00:00.000Z', unread: true });
    const reactions = (await activity(`type=reactions&workspace=${spaceId}`)).items;
    expect(reactions[0]).toMatchObject({ body: 'Mi pregunta', reactions: [{ emoji: '👍', count: 1 }], at: '2026-10-21T13:00:00.000Z', author: { id: String(ana) } });
  });

  it('only the counts, for the chips of the list', async () => {
    expect(await activity(`counts=1&workspace=${spaceId}`)).toEqual({ items: [], unread: { mentions: 1, threads: 1 } });
  });

  it('a space I am not in gives nothing', async () => {
    const other = await WorkspaceModel.create({ name: 'Otra', ownerId: ana, joinCode: 'OTRA-2B9Q' });
    await request(app).get(`/api/activity?type=mentions&workspace=${other._id}`).set(auth).expect(404);
  });
});
