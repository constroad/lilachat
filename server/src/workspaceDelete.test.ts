import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { BotInstallationModel } from './bots/botModels.js';
import { signSession } from './sessions.js';

/** José 10/11: «no es posible eliminar un espacio». Only its owner, typing its name; nothing is erased. */
let mongo: MongoMemoryServer;
const app = buildApp();
const users: Record<'jose' | 'ana', Types.ObjectId> = {} as never;
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
  await Promise.all([UserModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), ChatModel.deleteMany({}), BotInstallationModel.deleteMany({})]);
  const created = await UserModel.create([{ phone: '902049935', name: 'José Zamora' }, { phone: '987654321', name: 'Ana Torres' }]);
  [users.jose, users.ana] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
});

/** A space of José's with Ana as admin and an app installed. */
async function spaceWithAnaAndAnApp() {
  const res = await request(app).post('/api/workspaces').set('Authorization', jwt('jose')).send({ name: 'Obras Ñandú', joinPolicy: 'open' }).expect(201);
  const space = res.body.workspace as { id: string; joinCode: string };
  await request(app).post('/api/workspaces/join').set('Authorization', jwt('ana')).send({ code: space.joinCode }).expect(200);
  await WorkspaceMemberModel.updateOne({ workspaceId: space.id, userId: users.ana }, { $set: { role: 'admin' } });
  const installation = await BotInstallationModel.create({ appId: new Types.ObjectId(), workspaceId: space.id, botUserId: new Types.ObjectId(), tokenHash: `hash-${space.id}`, signingSecret: 'qa-secret', installedBy: users.jose });
  return { ...space, installationId: installation._id };
}

describe('deleting a space', () => {
  it('an admin who is not the owner cannot delete it', async () => {
    const space = await spaceWithAnaAndAnApp();
    const res = await request(app).post(`/api/workspaces/${space.id}/delete`).set('Authorization', jwt('ana')).send({ confirmName: 'Obras Ñandú' }).expect(403);
    expect(res.body.message).toMatch(/dueño/);
    expect(await WorkspaceModel.exists({ _id: space.id, deletedAt: { $exists: true } })).toBeNull();
  });

  it('without the right name nothing happens', async () => {
    const space = await spaceWithAnaAndAnApp();
    await request(app).post(`/api/workspaces/${space.id}/delete`).set('Authorization', jwt('jose')).send({}).expect(400);
    await request(app).post(`/api/workspaces/${space.id}/delete`).set('Authorization', jwt('jose')).send({ confirmName: 'Obras' }).expect(400);
    expect(await WorkspaceModel.exists({ _id: space.id, deletedAt: { $exists: true } })).toBeNull();
  });

  it('the owner deletes it: gone for everyone, its code dead, its apps uninstalled, its chats kept aside', async () => {
    const space = await spaceWithAnaAndAnApp();
    const general = await ChatModel.findOne({ workspaceId: space.id }).lean();
    expect(general?.members.length).toBe(2);

    await request(app).post(`/api/workspaces/${space.id}/delete`).set('Authorization', jwt('jose')).send({ confirmName: '  obras ñandu ' }).expect(200);

    for (const who of ['jose', 'ana'] as const) {
      const mine = await request(app).get('/api/workspaces').set('Authorization', jwt(who)).expect(200);
      expect(mine.body.workspaces).toEqual([]);
    }
    await request(app).get(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('ana')).expect(404);
    await request(app).get(`/api/workspaces/preview/${space.joinCode}`).set('Authorization', jwt('ana')).expect(404);
    const kept = await ChatModel.collection.findOne({ _id: general!._id });
    expect(kept?.members).toEqual([]);
    expect(kept?.deletedWithSpace?.members).toHaveLength(2);
    expect((await BotInstallationModel.findById(space.installationId).lean())?.revokedAt).toBeInstanceOf(Date);
    expect(await WorkspaceMemberModel.countDocuments({ workspaceId: space.id })).toBe(2);
  });
});
