import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, InvitationModel, UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { WorkspaceMemberModel } from '../src/workspaceModels.js';

/** José, 21/10: the creator sees who is in Lilachat and when they joined, never their messages. */
const app = buildApp();
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_admin'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  delete process.env.LILACHAT_OPERADORES;
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), InvitationModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  jose = (await UserModel.create({ phone: '902049935', name: 'José', createdAt: daysAgo(60), lastSeenAt: new Date() }))._id;
  ana = (await UserModel.create({ phone: '987654321', name: 'Ana', email: 'ana@example.com', emailVerifiedAt: new Date(), birthday: { day: 3, month: 5 }, createdAt: daysAgo(2) }))._id;
  beto = (await UserModel.create({ phone: '911222333', name: 'Beto (obra)', createdAt: daysAgo(10), lastSeenAt: daysAgo(3) }))._id;
  await UserModel.create([{ phone: '000000000', name: 'Lila' }, { phone: 'app-1', name: 'Bot Portal', app: { appId: new Types.ObjectId(), installationId: new Types.ObjectId(), workspaceId: new Types.ObjectId() } }]);
  await DeviceModel.create([{ deviceId: 'a1', userId: ana, platform: 'android' }, { deviceId: 'a2', userId: ana, platform: 'web' }, { deviceId: 'a3', userId: ana, platform: 'web' }]);
  await WorkspaceMemberModel.create({ workspaceId: new Types.ObjectId(), userId: ana, phone: '987654321', role: 'member', status: 'active' });
  await InvitationModel.create({ phone: '987654321', invitedBy: String(jose), status: 'invited' });
});

describe('users panel access', () => {
  it('without a session, 401; someone else, 403', async () => {
    await request(app).get('/api/admin/users').expect(401);
    await request(app).get('/api/admin').set(auth(ana)).expect(403);
    await request(app).get('/api/admin/users').set(auth(ana)).expect(403);
  });

  it('the creator, without any variable; an operator of LILACHAT_OPERADORES too', async () => {
    expect((await request(app).get('/api/admin').set(auth(jose)).expect(200)).body).toEqual({ superadmin: true });
    process.env.LILACHAT_OPERADORES = '911222333';
    await request(app).get('/api/admin').set(auth(beto)).expect(200);
  });
});

describe('GET /api/admin/users', () => {
  it('people only, newest first, with their basic information and nothing of their chats', async () => {
    const body = (await request(app).get('/api/admin/users').set(auth(jose)).expect(200)).body;
    expect(body.users.map((user: { name: string }) => user.name)).toEqual(['Ana', 'Beto (obra)', 'José']);
    expect(body.users[0]).toEqual({
      id: String(ana),
      name: 'Ana',
      phone: '987654321',
      avatarUrl: null,
      email: 'ana@example.com',
      emailVerified: true,
      profileComplete: true,
      joinedAt: expect.any(String),
      lastSeenAt: null,
      devices: { android: 1, web: 2 },
      spaces: 1,
      invitedBy: 'José',
    });
    expect(body.totals).toEqual({ people: 3, newThisWeek: 1, activeToday: 1, profileComplete: 1 });
    expect(body).toMatchObject({ total: 3, page: 1, pageSize: 50 });
  });

  it('searches by name, email or a piece of the phone; a parenthesis is text', async () => {
    const names = async (q: string) => (await request(app).get('/api/admin/users').query({ q }).set(auth(jose)).expect(200)).body.users.map((user: { name: string }) => user.name);
    expect(await names('ana@')).toEqual(['Ana']);
    expect(await names('222 333')).toEqual(['Beto (obra)']);
    expect(await names('(obra')).toEqual(['Beto (obra)']);
    expect(await names('nadie')).toEqual([]);
  });

  it('pages of 50: the second page has the rest, and the total counts them all', async () => {
    await UserModel.insertMany(Array.from({ length: 50 }, (_, index) => ({ phone: `9000001${String(index).padStart(2, '0')}`, name: `QA ${index}`, createdAt: daysAgo(30) })));
    const second = (await request(app).get('/api/admin/users').query({ page: 2 }).set(auth(jose)).expect(200)).body;
    expect(second.total).toBe(53);
    expect(second.users).toHaveLength(3);
    expect(second.users.at(-1).name).toBe('José');
  });
});
