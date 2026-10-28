import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { forgetBots } from './botRegistry.js';
import { installApp } from './botInstall.js';

/** «En qué canales está» of an app (pending 99, design c-05): the switches ride the members routes that already exist. */
let mongo: MongoMemoryServer;
const app = buildApp({});
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let appId: Types.ObjectId;
let botUserId: string;
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const channel = (name: string, visibility: 'public' | 'private', members: { userId: Types.ObjectId; role: 'admin' | 'member' }[], descripcion?: string) =>
  ChatModel.create({ kind: 'group', name, workspaceId: spaceId, channel: { visibility }, members, lastSeq: 0, ...(descripcion ? { descripcion } : {}) });
const listOf = async (asWho: typeof asJose) => (await request(app).get(`/api/workspaces/${spaceId}/apps/${appId}/channels`).set(asWho).expect(200)).body;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_channels'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([{ workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' }, { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active' }]);
  await channel('planta-asfalto', 'public', [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], 'Reportes de tolvas y clima');
  await channel('general', 'public', [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }]);
  await channel('gerencia', 'private', [{ userId: jose, role: 'admin' }]);
  const bot = await BotAppModel.create({ clientId: 'lca_inframaq', clientSecretHash: 'x', name: 'Inframaq', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: 'https://agentes.example.com/events' });
  appId = bot._id;
  botUserId = String((await installApp({ app: bot.toObject(), workspaceId: spaceId, installedBy: jose })).installation.botUserId);
});

describe('where an app is (GET /api/workspaces/:id/apps/:appId/channels)', () => {
  it('an admin sees every channel, the app in the public ones, and can switch it where they are admin', async () => {
    const body = await listOf(asJose);
    expect(body.canEdit).toBe(true);
    expect(body.botUserId).toBe(botUserId);
    expect(body.channels).toEqual([
      { id: expect.any(String), name: 'planta-asfalto', description: 'Reportes de tolvas y clima', private: false, inChannel: true, canChange: true },
      { id: expect.any(String), name: 'general', private: false, inChannel: true, canChange: true },
      { id: expect.any(String), name: 'gerencia', private: true, inChannel: false, canChange: true },
    ]);
  });

  it('a member sees it read-only, and never a private channel they are not in', async () => {
    const body = await listOf(asAna);
    expect(body.canEdit).toBe(false);
    expect(body.channels.map((one: { name: string }) => one.name)).toEqual(['planta-asfalto', 'general']);
    expect(body.channels.every((one: { canChange: boolean }) => !one.canChange)).toBe(true);
  });

  it('taking it out and putting it back go through the members routes, and the list follows', async () => {
    const [planta] = (await listOf(asJose)).channels;
    await request(app).delete(`/api/chats/${planta.id}/members/${botUserId}`).set(asJose).expect(200);
    expect((await listOf(asJose)).channels[0]).toMatchObject({ name: 'planta-asfalto', inChannel: false });
    await request(app).post(`/api/chats/${planta.id}/members`).set(asJose).send({ userId: botUserId }).expect(200);
    expect((await listOf(asJose)).channels[0]).toMatchObject({ name: 'planta-asfalto', inChannel: true });
  });

  it('an admin of the space switches it only where the members routes let them: in the channel, and as its admin to take it out', async () => {
    await WorkspaceMemberModel.updateOne({ userId: ana }, { $set: { role: 'admin' } });
    await channel('flota', 'public', [{ userId: jose, role: 'admin' }]);
    const byName = Object.fromEntries((await listOf(asAna)).channels.map((one: { name: string }) => [one.name, one]));
    expect(byName.flota).toMatchObject({ inChannel: false, canChange: false });
    expect(byName['planta-asfalto']).toMatchObject({ inChannel: true, canChange: false });
  });

  it('outside the space, or an app not installed: 404', async () => {
    const stranger = (await UserModel.create({ phone: '911111111', name: 'X' }))._id;
    await request(app).get(`/api/workspaces/${spaceId}/apps/${appId}/channels`).set(asUser(() => stranger)).expect(404);
    await request(app).get(`/api/workspaces/${spaceId}/apps/${new Types.ObjectId()}/channels`).set(asJose).expect(404);
  });
});
