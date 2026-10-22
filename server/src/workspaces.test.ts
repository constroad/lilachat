import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { InvitationModel, UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { claimPhoneInvites } from './workspaces.js';
import { signSession } from './sessions.js';

/** E1 (spec §66): company spaces over the personal account. */
let mongo: MongoMemoryServer;
const app = buildApp();
const users: Record<'jose' | 'ana' | 'beto' | 'carla', Types.ObjectId> = {} as never;
const jwt = (who: keyof typeof users) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), InvitationModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  const created = await UserModel.create([
    { phone: '902049935', name: 'José Zamora' },
    { phone: '987654321', name: 'Ana Torres' },
    { phone: '976543210', name: 'Beto Ramos' },
    { phone: '965432109', name: 'Carla Díaz' },
  ]);
  [users.jose, users.ana, users.beto, users.carla] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
});

async function createSpace(policy: 'open' | 'approval' = 'approval') {
  const res = await request(app).post('/api/workspaces').set('Authorization', jwt('jose')).send({ name: 'CONSTROAD', rubro: 'Construcción', joinPolicy: policy }).expect(201);
  return res.body.workspace as { id: string; joinCode: string; role: string };
}

describe('creating and joining a space', () => {
  it('the creator is the owner and gets a readable code', async () => {
    const space = await createSpace();
    expect(space.role).toBe('owner');
    expect(space.joinCode).toMatch(/^CONS-[A-Z0-9]{4}$/);
  });

  it('the code shows a preview, and an unknown code says nothing else', async () => {
    const space = await createSpace();
    const preview = await request(app).get(`/api/workspaces/preview/${space.joinCode.toLowerCase()}`).set('Authorization', jwt('ana')).expect(200);
    expect(preview.body).toMatchObject({ name: 'CONSTROAD', rubro: 'Construcción', members: 1, joinPolicy: 'approval' });
    await request(app).get('/api/workspaces/preview/ZZZZ-2222').set('Authorization', jwt('ana')).expect(404);
  });

  it('joining waits for approval (twice is the same request); an open space lets in', async () => {
    const space = await createSpace();
    const first = await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect(first.body.status).toBe('pending');
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect(await WorkspaceMemberModel.countDocuments({ workspaceId: space.id })).toBe(2);

    const open = await request(app).post('/api/workspaces').set('Authorization', jwt('carla')).send({ name: 'Inframaq', joinPolicy: 'open' }).expect(201);
    const joined = await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: open.body.workspace.joinCode }).expect(200);
    expect(joined.body.status).toBe('active');
  });

  /** «Cancelar solicitud» (design `e1-03-solicitud-enviada`): a pending request can be withdrawn. */
  it('a pending request is withdrawn by leaving', async () => {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    await request(app).post(`/api/workspaces/${space.id}/leave`).set('Authorization', jwt('ana')).expect(204);
    expect(await WorkspaceMemberModel.countDocuments({ workspaceId: space.id, userId: users.ana })).toBe(0);
  });

  it('my spaces list both, with my role and status', async () => {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    const mine = await request(app).get('/api/workspaces').set('Authorization', jwt('ana')).expect(200);
    expect(mine.body.workspaces).toEqual([expect.objectContaining({ name: 'CONSTROAD', role: 'member', status: 'pending' })]);
  });
});

describe('admins manage people', () => {
  async function pendingAna() {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    const member = await WorkspaceMemberModel.findOne({ workspaceId: space.id, userId: users.ana }).lean();
    return { space, memberId: String(member!._id) };
  }

  it('the owner approves with area and title; a pending person cannot see the directory', async () => {
    const { space, memberId } = await pendingAna();
    await request(app).get(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('ana')).expect(404);
    await request(app).patch(`/api/workspaces/${space.id}/members/${memberId}`).set('Authorization', jwt('jose')).send({ status: 'active', area: 'Obra', title: 'Residente de obra' }).expect(200);
    const directory = await request(app).get(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('ana')).expect(200);
    expect(directory.body.members.map((m: { name: string }) => m.name).sort()).toEqual(['Ana Torres', 'José Zamora']);
  });

  it('a member cannot approve, change roles or deactivate', async () => {
    const { space, memberId } = await pendingAna();
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '976 543 210' }).expect(201);
    await request(app).patch(`/api/workspaces/${space.id}/members/${memberId}`).set('Authorization', jwt('beto')).send({ status: 'active' }).expect(403);
  });

  it('adding by phone: an existing user is in at once; a new phone is invited and joins when it signs up', async () => {
    const space = await createSpace();
    const beto = await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '+51 976 543 210', area: 'Planta' }).expect(201);
    expect(beto.body.member).toMatchObject({ status: 'active', area: 'Planta' });

    const luis = await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '954321098', area: 'Flota' }).expect(201);
    expect(luis.body.member.status).toBe('invited');
    expect(await InvitationModel.exists({ phone: '954321098', status: 'invited' })).toBeTruthy();

    const newUser = await UserModel.create({ phone: '954321098', name: 'Luis Huamán' });
    await claimPhoneInvites(newUser._id, '954321098');
    expect(await WorkspaceMemberModel.findOne({ workspaceId: space.id, phone: '954321098' }).lean()).toMatchObject({ status: 'active', userId: newUser._id });
  });

  it('only the owner names admins; nobody deactivates the owner; an admin deactivates a member', async () => {
    const space = await createSpace();
    const ana = (await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201)).body.member;
    const beto = (await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '976543210' }).expect(201)).body.member;
    await request(app).patch(`/api/workspaces/${space.id}/members/${ana.id}`).set('Authorization', jwt('jose')).send({ role: 'admin' }).expect(200);
    await request(app).patch(`/api/workspaces/${space.id}/members/${beto.id}`).set('Authorization', jwt('ana')).send({ role: 'admin' }).expect(403);
    const owner = await WorkspaceMemberModel.findOne({ workspaceId: space.id, userId: users.jose }).lean();
    await request(app).patch(`/api/workspaces/${space.id}/members/${owner!._id}`).set('Authorization', jwt('ana')).send({ status: 'deactivated' }).expect(403);
    await request(app).patch(`/api/workspaces/${space.id}/members/${beto.id}`).set('Authorization', jwt('ana')).send({ status: 'deactivated' }).expect(200);
    const mine = await request(app).get('/api/workspaces').set('Authorization', jwt('beto')).expect(200);
    expect(mine.body.workspaces[0]).toMatchObject({ status: 'deactivated' });
  });
});

describe('space settings and leaving', () => {
  it('an admin renames and changes the code; the old code stops working', async () => {
    const space = await createSpace();
    const updated = await request(app).patch(`/api/workspaces/${space.id}`).set('Authorization', jwt('jose')).send({ name: 'CONSTROAD SAC', newCode: true, joinPolicy: 'open' }).expect(200);
    expect(updated.body.workspace).toMatchObject({ name: 'CONSTROAD SAC', joinPolicy: 'open' });
    expect(updated.body.workspace.joinCode).not.toBe(space.joinCode);
    await request(app).get(`/api/workspaces/preview/${space.joinCode}`).set('Authorization', jwt('ana')).expect(404);
  });

  it('a member leaves; the owner cannot leave without handing it over', async () => {
    const space = await createSpace();
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    await request(app).post(`/api/workspaces/${space.id}/leave`).set('Authorization', jwt('ana')).expect(204);
    expect(await WorkspaceMemberModel.exists({ workspaceId: space.id, userId: users.ana })).toBeNull();
    await request(app).post(`/api/workspaces/${space.id}/leave`).set('Authorization', jwt('jose')).expect(409);
  });
});

describe('chats inside a space', () => {
  async function spaceWithAnaAndBeto() {
    const space = await createSpace();
    const ana = (await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201)).body.member;
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '976543210' }).expect(201);
    return { space, anaMemberId: ana.id as string };
  }
  const listOf = async (who: keyof typeof users, workspace?: string) =>
    (await request(app).get(`/api/chats${workspace ? `?workspace=${workspace}` : ''}`).set('Authorization', jwt(who)).expect(200)).body.chats as { id: string; name?: string }[];

  /** The space switcher (design `e1-06-selector-espacios`): «Construcción · 48 miembros» and a badge of chats with something new. */
  it('my spaces say how many active members they have and how many of my chats there have something new', async () => {
    const { space } = await spaceWithAnaAndBeto();
    const created = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'group', name: 'Obra Miraflores', memberIds: [String(users.ana), String(users.beto)], workspaceId: space.id }).expect(201);
    await ChatModel.updateOne({ _id: created.body.chatId }, { $set: { lastSeq: 3 } });
    const mine = (await request(app).get('/api/workspaces').set('Authorization', jwt('ana')).expect(200)).body.workspaces;
    // The group, and #general: Beto arrived after Ana (22/10). Ana's own arrival is not news to her.
    expect(mine).toEqual([expect.objectContaining({ id: space.id, members: 3, unreadChats: 2 })]);
  });

  it('a group of the space shows in the space, not in the personal list', async () => {
    const { space } = await spaceWithAnaAndBeto();
    const created = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'group', name: 'Obra Miraflores', memberIds: [String(users.ana), String(users.beto)], workspaceId: space.id }).expect(201);
    expect((await listOf('ana', space.id)).map((c) => c.name).sort()).toEqual(['Obra Miraflores', 'general']);
    expect(await listOf('ana')).toEqual([]);
  });

  it('only active members of the space go in; an outsider is refused', async () => {
    const { space } = await spaceWithAnaAndBeto();
    await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'group', name: 'Obra', memberIds: [String(users.carla)], workspaceId: space.id }).expect(403);
    await request(app).post('/api/chats').set('Authorization', jwt('carla')).send({ kind: 'direct', memberIds: [String(users.ana)], workspaceId: space.id }).expect(403);
    await request(app).get(`/api/chats?workspace=${space.id}`).set('Authorization', jwt('carla')).expect(404);
  });

  it('the 1:1 in the space is not the personal 1:1 with the same person', async () => {
    const { space } = await spaceWithAnaAndBeto();
    const ownChat = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'direct', memberIds: [String(users.ana)] }).expect(201);
    const inSpace = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'direct', memberIds: [String(users.ana)], workspaceId: space.id }).expect(201);
    const again = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'direct', memberIds: [String(users.ana)], workspaceId: space.id }).expect(201);
    expect(inSpace.body.chatId).not.toBe(ownChat.body.chatId);
    expect(again.body.chatId).toBe(inSpace.body.chatId);
  });

  it('deactivating takes the person out of the space chats at once; reactivating brings them back', async () => {
    const { space, anaMemberId } = await spaceWithAnaAndBeto();
    const group = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'group', name: 'Obra', memberIds: [String(users.ana), String(users.beto)], workspaceId: space.id }).expect(201);
    await request(app).patch(`/api/workspaces/${space.id}/members/${anaMemberId}`).set('Authorization', jwt('jose')).send({ status: 'deactivated' }).expect(200);
    await request(app).get(`/api/chats/${group.body.chatId}/detail`).set('Authorization', jwt('ana')).expect(404);
    await request(app).patch(`/api/workspaces/${space.id}/members/${anaMemberId}`).set('Authorization', jwt('jose')).send({ status: 'active' }).expect(200);
    await request(app).get(`/api/chats/${group.body.chatId}/detail`).set('Authorization', jwt('ana')).expect(200);
  });
});

describe('channels (E2)', () => {
  async function spaceWithAna() {
    const space = await createSpace();
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '976543210' }).expect(201);
    return space;
  }

  it('a member creates a public channel with a clean name; it shows as a channel in the space list', async () => {
    const space = await spaceWithAna();
    const created = await request(app).post(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('ana')).send({ name: 'Obra Surco', descripcion: 'Coordinación diaria', visibility: 'public' }).expect(201);
    expect(created.body.channel).toMatchObject({ name: 'obra-surco', visibility: 'public', joined: true, members: 1 });
    const list = await request(app).get(`/api/chats?workspace=${space.id}`).set('Authorization', jwt('ana')).expect(200);
    expect(list.body.chats.find((chat: { name: string }) => chat.name === 'obra-surco')).toMatchObject({ kind: 'group', channel: { visibility: 'public' } });
  });

  it('exploring shows public channels and my private ones; anyone joins a public one, nobody joins a private one', async () => {
    const space = await spaceWithAna();
    const avisos = (await request(app).post(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('jose')).send({ name: 'avisos', visibility: 'public' }).expect(201)).body.channel;
    const boss = (await request(app).post(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('jose')).send({ name: 'gerencia', visibility: 'private' }).expect(201)).body.channel;
    const seen = await request(app).get(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('beto')).expect(200);
    expect(seen.body.channels.map((c: { name: string; joined: boolean }) => [c.name, c.joined])).toEqual([['avisos', false], ['general', true]]);
    await request(app).post(`/api/workspaces/${space.id}/channels/${avisos.id}/join`).set('Authorization', jwt('beto')).expect(200);
    await request(app).post(`/api/workspaces/${space.id}/channels/${boss.id}/join`).set('Authorization', jwt('beto')).expect(404);
    const after = await request(app).get(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('beto')).expect(200);
    expect(after.body.channels[0]).toMatchObject({ name: 'avisos', joined: true, members: 2 });
  });

  it('the same channel name twice in a space is refused; outsiders see nothing', async () => {
    const space = await spaceWithAna();
    await request(app).post(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('jose')).send({ name: 'flota' }).expect(201);
    await request(app).post(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('ana')).send({ name: 'Flota' }).expect(409);
    await request(app).get(`/api/workspaces/${space.id}/channels`).set('Authorization', jwt('carla')).expect(404);
  });
});
