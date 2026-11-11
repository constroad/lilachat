import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import type { AuthClient } from './authClient.js';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { SharedChannelModel } from './sharedChannelModel.js';
import { viewingSpacesOf } from './sharedChannels.js';
import { signSession } from './sessions.js';
import { avisarCambioDeChat } from './reparto.js';

vi.mock('./reparto.js', async (original) => ({ ...(await original<typeof import('./reparto.js')>()), avisarCambioDeChat: vi.fn() }));

/**
 * José 11/11 (via Portal): the «administración» channel of Inframaq shared with
 * Constroad and Globofast, seen from each space under «Inframaq», and people
 * from other spaces added to it. Like Slack Connect.
 */
let mongo: MongoMemoryServer;
const codeService: AuthClient = {
  requestCode: () => Promise.resolve({ ok: true, valor: { canal: 'email' } }),
  verifyCode: () => Promise.resolve({ ok: true, valor: { secreto: 's' } }),
  validateDevice: () => Promise.resolve({ ok: true, valor: { companyId: 'constroad', identidad: 'x', app: 'lilachat' } }),
};
const app = buildApp({ authClient: codeService });
type Who = 'jose' | 'marco' | 'ana' | 'luis' | 'rosa';
const users = {} as Record<Who, Types.ObjectId>;
const spaces = {} as Record<'inframaq' | 'constroad' | 'globofast' | 'otra', Types.ObjectId>;
let channelId: Types.ObjectId;
let generalId: Types.ObjectId;
const jwt = (who: Who) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;
const api = (who: Who) => ({
  get: (path: string) => request(app).get(path).set('Authorization', jwt(who)),
  post: (path: string, body: object = {}) => request(app).post(path).set('Authorization', jwt(who)).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', jwt(who)),
});

async function member(space: keyof typeof spaces, who: Who, role: 'owner' | 'admin' | 'member') {
  await WorkspaceMemberModel.create({ workspaceId: spaces[space], userId: users[who], phone: `9${who.length}${Math.round(Math.random() * 1e7)}`, role, status: 'active', joinedAt: new Date() });
}

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({}), SharedChannelModel.deleteMany({})]);
  const created = await UserModel.create([{ phone: '902049935', name: 'José Zamora' }, { phone: '987111222', name: 'Marco Ríos' }, { phone: '987333444', name: 'Ana Quispe' }, { phone: '987555666', name: 'Luis Paredes' }, { phone: '987777888', name: 'Rosa Mendoza' }]);
  (['jose', 'marco', 'ana', 'luis', 'rosa'] as const).forEach((who, index) => (users[who] = created[index]!._id));
  const made = await WorkspaceModel.create([{ name: 'Inframaq', ownerId: users.jose, joinCode: 'INFR-0001' }, { name: 'Constroad', ownerId: users.jose, joinCode: 'CONS-0001' }, { name: 'Globofast', ownerId: users.luis, joinCode: 'GLOB-0001' }, { name: 'Otra', ownerId: users.rosa, joinCode: 'OTRA-0001' }]);
  (['inframaq', 'constroad', 'globofast', 'otra'] as const).forEach((space, index) => (spaces[space] = made[index]!._id));
  await member('inframaq', 'jose', 'owner');
  await member('inframaq', 'marco', 'member');
  await member('constroad', 'jose', 'owner');
  await member('constroad', 'ana', 'member');
  await member('globofast', 'luis', 'owner');
  await member('globofast', 'jose', 'member');
  await member('otra', 'rosa', 'owner');
  const general = await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaces.inframaq, channel: { visibility: 'public' }, members: [{ userId: users.jose, role: 'admin' }, { userId: users.marco }], lastSeq: 0 });
  generalId = general._id;
  await WorkspaceModel.updateOne({ _id: spaces.inframaq }, { generalChatId: general._id });
  const channel = await ChatModel.create({ kind: 'group', name: 'administracion', workspaceId: spaces.inframaq, channel: { visibility: 'private' }, members: [{ userId: users.jose, role: 'admin' }, { userId: users.marco }], lastSeq: 0 });
  channelId = channel._id;
});

const sharesPath = () => `/api/workspaces/${spaces.inframaq}/channels/${channelId}/shares`;

describe('sharing a channel with another space', () => {
  it('is active at once when the one sharing also runs the other space, and the channel lists there under «Inframaq»', async () => {
    const shared = await api('jose').post(sharesPath(), { workspaceId: String(spaces.constroad) });

    expect(shared.status).toBe(201);
    expect(shared.body.shares).toEqual([expect.objectContaining({ workspaceId: String(spaces.constroad), name: 'Constroad', status: 'active' })]);
    expect((await ChatModel.findById(channelId).lean())?.channel?.shared).toBe(true);
    const list = await api('jose').get(`/api/chats?workspace=${spaces.constroad}`);
    const row = list.body.chats.find((chat: { id: string }) => chat.id === String(channelId));
    expect(row).toMatchObject({ sharedFrom: { workspaceId: String(spaces.inframaq), name: 'Inframaq' }, channel: { visibility: 'private', shared: true } });
    // In its own space it stays a channel of Inframaq, marked shared, without `sharedFrom`.
    const own = (await api('jose').get(`/api/chats?workspace=${spaces.inframaq}`)).body.chats.find((chat: { id: string }) => chat.id === String(channelId));
    expect(own.sharedFrom).toBeUndefined();
    expect(own.channel.shared).toBe(true);
  });

  it('waits for an admin of the other space when the one sharing is only a member there; the admin accepts and enters', async () => {
    const shared = await api('jose').post(sharesPath(), { workspaceId: String(spaces.globofast) });
    expect(shared.body.shares[0]).toMatchObject({ name: 'Globofast', status: 'pending' });
    expect((await api('jose').get(`/api/workspaces/${spaces.globofast}/share-invites`)).body.invites).toEqual([]);

    const invites = await api('luis').get(`/api/workspaces/${spaces.globofast}/share-invites`);
    expect(invites.body.invites).toEqual([expect.objectContaining({ chatId: String(channelId), channelName: 'administracion', from: expect.objectContaining({ name: 'Inframaq' }), invitedBy: 'José Zamora' })]);
    expect((await api('luis').post(`/api/workspaces/${spaces.globofast}/share-invites/${channelId}`, { accept: true })).status).toBe(200);

    const chat = await ChatModel.findById(channelId).lean();
    expect(chat?.members.map((m) => String(m.userId))).toContain(String(users.luis));
    expect((await api('luis').get(`/api/chats?workspace=${spaces.globofast}`)).body.chats.map((c: { id: string }) => c.id)).toContain(String(channelId));
  });

  it('refuses a plain member, #general, a space I am not in and the same space', async () => {
    expect((await api('marco').post(sharesPath(), { workspaceId: String(spaces.constroad) })).status).toBe(403);
    expect((await api('jose').post(`/api/workspaces/${spaces.inframaq}/channels/${generalId}/shares`, { workspaceId: String(spaces.constroad) })).body.message).toMatch(/#general/);
    expect((await api('jose').post(sharesPath(), { workspaceId: String(spaces.otra) })).status).toBe(400);
    expect((await api('jose').post(sharesPath(), { workspaceId: String(spaces.inframaq) })).status).toBe(400);
    expect(await SharedChannelModel.countDocuments()).toBe(0);
  });

  it('someone outside the owner space gets a 404 that says nothing about it', async () => {
    expect((await api('ana').post(sharesPath(), { workspaceId: String(spaces.constroad) })).status).toBe(404);
  });
});

describe('people of the other spaces', () => {
  beforeEach(async () => {
    await api('jose').post(sharesPath(), { workspaceId: String(spaces.constroad) });
  });

  it('are offered with their space and added; someone from an unrelated space is refused', async () => {
    const people = await api('jose').get(`/api/workspaces/${spaces.constroad}/channels/${channelId}/people`);
    const byName = Object.fromEntries(people.body.people.map((person: { name: string; space: { name: string }; inChannel: boolean }) => [person.name, person]));
    expect(byName['Ana Quispe']).toMatchObject({ space: { name: 'Constroad' }, inChannel: false });
    expect(byName['José Zamora']).toMatchObject({ space: { name: 'Inframaq' }, inChannel: true });
    expect(byName['Rosa Mendoza']).toBeUndefined();

    expect((await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) })).status).toBe(200);
    expect((await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.rosa) })).status).toBe(403);
  });

  it('count on the rail of the space they see it from, and a notice lands each one in their space', async () => {
    await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) });
    await ChatModel.updateOne({ _id: channelId }, { lastSeq: 3, lastMainSeq: 3 });

    const mine = await api('ana').get('/api/workspaces');
    expect(mine.body.workspaces.find((space: { id: string }) => space.id === String(spaces.constroad)).unreadChats).toBe(1);
    const chat = (await ChatModel.findById(channelId).lean())!;
    const viewing = await viewingSpacesOf(chat, [String(users.ana), String(users.jose)]);
    expect(viewing.get(String(users.ana))).toBe(String(spaces.constroad));
    expect(viewing.get(String(users.jose))).toBe(String(spaces.inframaq));
  });

  it('go out when the share ends or when they are deactivated in their space; the owner space stays', async () => {
    await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) });
    await api('jose').delete(`${sharesPath()}/${spaces.constroad}`).expect(200);

    let ids = (await ChatModel.findById(channelId).lean())!.members.map((m) => String(m.userId));
    expect(ids).not.toContain(String(users.ana));
    expect(ids).toEqual(expect.arrayContaining([String(users.jose), String(users.marco)]));
    expect((await ChatModel.findById(channelId).lean())?.channel?.shared).toBeUndefined();

    await api('jose').post(sharesPath(), { workspaceId: String(spaces.constroad) });
    await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) });
    const anaRow = await WorkspaceMemberModel.findOne({ workspaceId: spaces.constroad, userId: users.ana }).lean();
    await request(app).patch(`/api/workspaces/${spaces.constroad}/members/${anaRow!._id}`).set('Authorization', jwt('jose')).send({ status: 'deactivated' }).expect(200);
    ids = (await ChatModel.findById(channelId).lean())!.members.map((m) => String(m.userId));
    expect(ids).not.toContain(String(users.ana));
  });

  it('the receiving space leaves on its own: its people go out, and whoever stays hears the channel changed', async () => {
    await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) });
    vi.mocked(avisarCambioDeChat).mockClear();

    await api('jose').delete(`/api/workspaces/${spaces.constroad}/channels/${channelId}/shares/${spaces.constroad}`).expect(200);

    expect((await ChatModel.findById(channelId).lean())!.members.map((m) => String(m.userId))).not.toContain(String(users.ana));
    expect(vi.mocked(avisarCambioDeChat)).toHaveBeenCalledWith(String(users.jose), String(channelId));
    expect(vi.mocked(avisarCambioDeChat)).toHaveBeenCalledWith(String(users.marco), String(channelId));
  });

  it('end when the receiving space is deleted: its people leave and the channel is no longer shared', async () => {
    await api('jose').post(`/api/chats/${channelId}/members`, { userId: String(users.ana) });

    await request(app).post(`/api/workspaces/${spaces.constroad}/delete`).set('Authorization', jwt('jose')).send({ confirmName: 'Constroad' }).expect(200);

    const chat = (await ChatModel.findById(channelId).lean())!;
    expect(chat.members.map((m) => String(m.userId))).not.toContain(String(users.ana));
    expect(chat.channel?.shared).toBeUndefined();
    expect((await api('jose').get(sharesPath())).body.shares).toEqual([]);
  });

  it('end when the owner space is deleted: no invitation is left waiting in the other space', async () => {
    await api('jose').post(sharesPath(), { workspaceId: String(spaces.globofast) });
    expect((await api('luis').get(`/api/workspaces/${spaces.globofast}/share-invites`)).body.invites).toHaveLength(1);

    await request(app).post(`/api/workspaces/${spaces.inframaq}/delete`).set('Authorization', jwt('jose')).send({ confirmName: 'Inframaq' }).expect(200);

    expect((await api('luis').get(`/api/workspaces/${spaces.globofast}/share-invites`)).body.invites).toEqual([]);
    expect(await SharedChannelModel.countDocuments({ status: { $ne: 'removed' } })).toBe(0);
  });
});
