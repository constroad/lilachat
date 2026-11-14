import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, InvitationModel, UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../src/workspaceModels.js';

/** José, 14/11: the superadmin sees the people grouped by the space they belong to. */
const app = buildApp();
let mongo: MongoMemoryServer;
const ids: Record<'jose' | 'ana' | 'beto' | 'carla' | 'dora' | 'eli' | 'bot' | 'lila' | 'gf' | 'cr' | 'gone', Types.ObjectId> = {} as never;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
let joinCodes = 0;
const space = async (name: string, extra: Record<string, unknown> = {}) =>
  (await WorkspaceModel.create({ name, ownerId: new Types.ObjectId(), joinCode: `CODE-${(joinCodes += 1)}`, joinPolicy: 'open', ...extra }))._id;
const member = (workspaceId: Types.ObjectId, userId: Types.ObjectId, role: string, extra: Record<string, unknown> = {}) => ({ workspaceId, userId, phone: `p-${userId}`, role, status: 'active', ...extra });
const names = (rows: { name: string }[]) => rows.map((row) => row.name);

async function seedPeople(): Promise<void> {
  ids.jose = (await UserModel.create({ phone: '902049935', name: 'José', createdAt: daysAgo(60), lastSeenAt: new Date() }))._id;
  ids.ana = (await UserModel.create({ phone: '987654321', name: 'Ana', email: 'ana@example.com', emailVerifiedAt: new Date(), createdAt: daysAgo(20), lastSeenAt: new Date() }))._id;
  ids.beto = (await UserModel.create({ phone: '911222333', name: 'Beto', createdAt: daysAgo(10), lastSeenAt: daysAgo(3) }))._id;
  ids.carla = (await UserModel.create({ phone: '944555666', name: 'Carla', createdAt: daysAgo(9) }))._id;
  ids.dora = (await UserModel.create({ phone: '955666777', name: 'Dora', createdAt: daysAgo(2) }))._id;
  ids.eli = (await UserModel.create({ phone: '966777888', name: 'Eli', createdAt: daysAgo(1) }))._id;
  ids.lila = (await UserModel.create({ phone: '000000000', name: 'Lila' }))._id;
  ids.bot = (await UserModel.create({ phone: 'app-1', name: 'Bot Portal', app: { appId: new Types.ObjectId(), installationId: new Types.ObjectId(), workspaceId: new Types.ObjectId() } }))._id;
}

async function seedSpaces(): Promise<void> {
  ids.gf = await space('Globofast');
  ids.cr = await space('ConstRoad');
  ids.gone = await space('Borrado', { deletedAt: new Date() });
  await WorkspaceMemberModel.create([
    member(ids.gf, ids.carla, 'guest', { hidden: true }),
    member(ids.gf, ids.beto, 'admin'),
    member(ids.gf, ids.ana, 'owner'),
    member(ids.gf, ids.bot, 'member'),
    { ...member(ids.gf, ids.eli, 'member'), status: 'pending' },
    member(ids.cr, ids.ana, 'member'),
    member(ids.cr, ids.jose, 'owner'),
    member(ids.cr, ids.lila, 'member'),
    member(ids.gone, ids.dora, 'owner'),
  ]);
  await DeviceModel.create({ deviceId: 'a1', userId: ids.ana, platform: 'android' });
  await InvitationModel.create({ phone: '911222333', invitedBy: String(ids.ana), status: 'invited' });
}

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_admin_spaces'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  delete process.env.LILACHAT_OPERADORES;
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), InvitationModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  await seedPeople();
  await seedSpaces();
});

describe('access to the grouped panel', () => {
  it('without a session, 401; someone who is not the superadmin, 403', async () => {
    await request(app).get('/api/admin/spaces').expect(401);
    await request(app).get('/api/admin/spaces').set(auth(ids.ana)).expect(403);
    await request(app).get(`/api/admin/spaces/${ids.gf}/members`).set(auth(ids.ana)).expect(403);
  });
});

describe('GET /api/admin/spaces', () => {
  it('each live space with its active people, without bots, Lila, pending members or deleted spaces', async () => {
    // Act
    const body = (await request(app).get('/api/admin/spaces').set(auth(ids.jose)).expect(200)).body;
    // Assert
    expect(body.spaces).toEqual([
      { id: String(ids.gf), name: 'Globofast', logoUrl: null, members: 3, activeToday: 1 },
      { id: String(ids.cr), name: 'ConstRoad', logoUrl: null, members: 2, activeToday: 2 },
    ]);
    expect(body).toMatchObject({ page: 1, pageSize: 10, people: 6 });
    expect(body.totals).toMatchObject({ people: 6 });
  });

  it('a group shows its first members by role, with the hidden one marked and the other spaces', async () => {
    const body = (await request(app).get('/api/admin/spaces').set(auth(ids.jose)).expect(200)).body;
    const [globofast] = body.groups;
    expect(names(globofast.preview)).toEqual(['Ana', 'Beto', 'Carla']);
    expect(globofast.preview.map((row: { role: string }) => row.role)).toEqual(['owner', 'admin', 'guest']);
    expect(globofast.preview[0]).toMatchObject({ alsoIn: [{ id: String(ids.cr), name: 'ConstRoad' }], spaces: 2, hidden: false, devices: { android: 1, web: 0 } });
    expect(globofast.preview[1]).toMatchObject({ invitedBy: 'Ana', alsoIn: [] });
    expect(globofast.preview[2]).toMatchObject({ hidden: true });
  });

  it('«Sin espacio» counts who is in no live space, newest first', async () => {
    const body = (await request(app).get('/api/admin/spaces').set(auth(ids.jose)).expect(200)).body;
    expect(body.noSpace.members).toBe(2);
    expect(names(body.noSpace.preview)).toEqual(['Eli', 'Dora']);
    expect(body.noSpace.preview[0]).toMatchObject({ role: null, alsoIn: [], spaces: 0 });
  });

  it('the search narrows the spaces, their counts and «Sin espacio»', async () => {
    const body = (await request(app).get('/api/admin/spaces').query({ q: 'ana' }).set(auth(ids.jose)).expect(200)).body;
    expect(body.spaces.map((row: { members: number }) => row.members)).toEqual([1, 1]);
    expect(body.people).toBe(1);
    expect(body.noSpace).toEqual({ members: 0, preview: [] });
    const nobody = (await request(app).get('/api/admin/spaces').query({ q: '(nadie' }).set(auth(ids.jose)).expect(200)).body;
    expect(nobody).toMatchObject({ spaces: [], groups: [], people: 0 });
  });

  it('groups come 10 per page; the filter column lists them all', async () => {
    for (let index = 0; index < 10; index += 1) await WorkspaceMemberModel.create(member(await space(`Obra ${index}`), ids.eli, 'member'));
    const second = (await request(app).get('/api/admin/spaces').query({ page: 2 }).set(auth(ids.jose)).expect(200)).body;
    expect(second.spaces).toHaveLength(12);
    expect(second.groups).toHaveLength(2);
    expect(second.page).toBe(2);
  });
});

describe('GET /api/admin/spaces/:spaceId/members', () => {
  it('the members of one space, by role, with the space summary', async () => {
    const body = (await request(app).get(`/api/admin/spaces/${ids.gf}/members`).set(auth(ids.jose)).expect(200)).body;
    expect(body.space).toMatchObject({ name: 'Globofast', members: 3 });
    expect(names(body.members)).toEqual(['Ana', 'Beto', 'Carla']);
    expect(body).toMatchObject({ total: 3, page: 1, pageSize: 50 });
  });

  it('pages of 50', async () => {
    const extra = await UserModel.insertMany(Array.from({ length: 50 }, (_, index) => ({ phone: `9000001${String(index).padStart(2, '0')}`, name: `QA ${index}` })));
    await WorkspaceMemberModel.insertMany(extra.map((user) => member(ids.gf, user._id, 'member')));
    const second = (await request(app).get(`/api/admin/spaces/${ids.gf}/members`).query({ page: 2 }).set(auth(ids.jose)).expect(200)).body;
    expect(second.total).toBe(53);
    expect(second.members).toHaveLength(3);
    expect(second.members.at(-1).name).toBe('Carla');
  });

  it('«none» lists the people in no space; the search applies', async () => {
    const body = (await request(app).get('/api/admin/spaces/none/members').set(auth(ids.jose)).expect(200)).body;
    expect(body.space).toBeNull();
    expect(names(body.members)).toEqual(['Eli', 'Dora']);
    const searched = (await request(app).get('/api/admin/spaces/none/members').query({ q: 'dora' }).set(auth(ids.jose)).expect(200)).body;
    expect(names(searched.members)).toEqual(['Dora']);
  });

  it('a deleted space, an unknown one or a malformed id, 404', async () => {
    await request(app).get(`/api/admin/spaces/${ids.gone}/members`).set(auth(ids.jose)).expect(404);
    await request(app).get(`/api/admin/spaces/${new Types.ObjectId()}/members`).set(auth(ids.jose)).expect(404);
    await request(app).get('/api/admin/spaces/xyz/members').set(auth(ids.jose)).expect(404);
  });
});
