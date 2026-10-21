import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { InvitationModel, UserModel } from './models.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { signSession } from './sessions.js';

/** The enterprise screens (designs `e1-08`…`e1-14`): directory, members and roles, requests, settings, «te agregaron» and «ya no tienes acceso». */
let mongo: MongoMemoryServer;
const app = buildApp();
const users: Record<'jose' | 'ana' | 'beto', Types.ObjectId> = {} as never;
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
  ]);
  [users.jose, users.ana, users.beto] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
});

async function createSpace() {
  const res = await request(app).post('/api/workspaces').set('Authorization', jwt('jose')).send({ name: 'CONSTROAD', rubro: 'Construcción', joinPolicy: 'approval' }).expect(201);
  return res.body.workspace as { id: string; joinCode: string };
}
const mySpaces = async (who: keyof typeof users) => (await request(app).get('/api/workspaces').set('Authorization', jwt(who)).expect(200)).body.workspaces as Record<string, unknown>[];
const members = async (spaceId: string, status = 'active') => (await request(app).get(`/api/workspaces/${spaceId}/members?status=${status}`).set('Authorization', jwt('jose')).expect(200)).body.members as Record<string, unknown>[];

describe('requests to come in (e1-11)', () => {
  it('an admin sees how many are waiting; each request says when it came', async () => {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect((await mySpaces('jose'))[0]).toMatchObject({ pendingRequests: 1 });
    const [request1] = await members(space.id, 'pending');
    expect(request1).toMatchObject({ name: 'Ana Torres', status: 'pending' });
    expect(typeof request1!.requestedAt).toBe('string');
  });

  it('approving with an area and a title lets them in with both', async () => {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    const [pending] = await members(space.id, 'pending');
    const approved = await request(app).patch(`/api/workspaces/${space.id}/members/${pending!.id}`).set('Authorization', jwt('jose')).send({ status: 'active', area: 'Obra', title: 'Residente de obra' }).expect(200);
    expect(approved.body.member).toMatchObject({ status: 'active', area: 'Obra', title: 'Residente de obra' });
    expect(typeof approved.body.member.joinedAt).toBe('string');
  });

  it('rejecting removes the request (it does not land in «Desactivados»); a member cannot reject', async () => {
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    const [pending] = await members(space.id, 'pending');
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('beto')).send({ code: space.joinCode }).expect(200);
    await WorkspaceMemberModel.updateOne({ userId: users.beto }, { $set: { status: 'active' } });
    await request(app).delete(`/api/workspaces/${space.id}/members/${pending!.id}`).set('Authorization', jwt('beto')).expect(403);
    await request(app).delete(`/api/workspaces/${space.id}/members/${pending!.id}`).set('Authorization', jwt('jose')).expect(204);
    expect(await members(space.id, 'pending')).toHaveLength(0);
    expect(await members(space.id, 'deactivated')).toHaveLength(0);
    expect((await mySpaces('ana'))).toHaveLength(0);
  });

  it('only a request is rejected this way: an active member is deactivated, not deleted', async () => {
    const space = await createSpace();
    const added = await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    await request(app).delete(`/api/workspaces/${space.id}/members/${added.body.member.id}`).set('Authorization', jwt('jose')).expect(409);
  });
});

describe('«te agregaron» (e1-13) and «ya no tienes acceso» (e1-14)', () => {
  it('a space someone added me to says who did it; one I joined myself does not', async () => {
    const space = await createSpace();
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    expect((await mySpaces('ana'))[0]).toMatchObject({ addedBy: { name: 'José Zamora', phone: '902049935' } });
    expect((await mySpaces('jose'))[0]!.addedBy).toBeUndefined();
  });

  it('without access, my spaces still name its admins so I can talk to one', async () => {
    const space = await createSpace();
    const added = await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '987654321' }).expect(201);
    await request(app).patch(`/api/workspaces/${space.id}/members/${added.body.member.id}`).set('Authorization', jwt('jose')).send({ status: 'deactivated' }).expect(200);
    const [mine] = await mySpaces('ana');
    expect(mine).toMatchObject({ status: 'deactivated', admins: [{ userId: String(users.jose), name: 'José Zamora', phone: '902049935' }] });
    expect(mine!.joinCode).toBeUndefined();
    // An active member does not need them in the list.
    expect((await mySpaces('jose'))[0]!.admins).toBeUndefined();
  });
});

describe('live notice «workspaces.changed»', () => {
  it('a request tells the admins; approving, the person; adding by phone, the one added', async () => {
    const { configureWorkspaceNotices } = await import('./workspaceNotices.js');
    const told: string[][] = [];
    configureWorkspaceNotices((ids) => told.push([...ids]));
    const space = await createSpace();
    await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
    expect(told.at(-1)).toEqual([String(users.jose)]);
    const [pending] = await members(space.id, 'pending');
    await request(app).patch(`/api/workspaces/${space.id}/members/${pending!.id}`).set('Authorization', jwt('jose')).send({ status: 'active' }).expect(200);
    expect(told.at(-1)).toEqual([String(users.ana)]);
    await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone: '976543210' }).expect(201);
    expect(told.at(-1)).toEqual([String(users.beto)]);
    configureWorkspaceNotices(() => undefined);
  });
});
