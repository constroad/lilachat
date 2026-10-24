import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { forgetBots } from './botRegistry.js';

/** «Conectado como … / Desconectar» per app (pending 59; agentes f02cb99). */
let mongo: MongoMemoryServer;
const app = buildApp({});
let hook: Server;
let hookUrl = '';
let jose: Types.ObjectId;
let stranger: Types.ObjectId;
let spaceId: Types.ObjectId;
let portalId: Types.ObjectId;
type Event = { type: string; installationId: string; data: Record<string, unknown> };
const received: Event[] = [];
let answer: (event: Event, res: ServerResponse) => void = (_event, res) => res.end();
const json = (body: unknown, status = 200) => (_event: Event, res: ServerResponse) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asStranger = asUser(() => stranger);
const linkPath = () => `/api/workspaces/${spaceId}/apps/${portalId}/link`;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_link'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const event = { type: String(req.headers['x-lilachat-event']), installationId: String(parsed.installation_id), data: parsed.data ?? {} };
      received.push(event);
      answer(event, res);
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  answer = (_event, res) => res.end();
  forgetBots();
  await Promise.all([UserModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, stranger] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51911111111', name: 'Otro' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' });
  portalId = (await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/vuelta'], webhookUrl: hookUrl }))._id;
  const botUser = await UserModel.create({ phone: '51900000001', name: 'Portal' });
  await BotInstallationModel.create({ appId: portalId, workspaceId: spaceId, botUserId: botUser._id, installedBy: jose, signingSecret: 'lcs_test', tokenHash: 'h' });
});

describe('my account in an app', () => {
  it('asks THIS installation\'s app with link.status and shows who I am there', async () => {
    // Arrange
    answer = json({ linked: true, label: 'j•••@constroad.com' });
    // Act
    const link = await request(app).get(linkPath()).set(asJose).expect(200);
    // Assert
    expect(link.body).toEqual({ linked: true, label: 'j•••@constroad.com' });
    const installation = await BotInstallationModel.findOne({ appId: portalId }).lean();
    expect(received).toEqual([{ type: 'link.status', installationId: String(installation!._id), data: { user: { id: String(jose) } } }]);
  });

  it('not connected, or an app that does not answer it: the row says so or hides', async () => {
    answer = json({ linked: false });
    expect((await request(app).get(linkPath()).set(asJose).expect(200)).body).toEqual({ linked: false });
    answer = json({ error: 'falta user' }, 400);
    expect((await request(app).get(linkPath()).set(asJose).expect(200)).body).toEqual({ unknown: true });
  });

  it('«Desconectar» sends link.revoke and only succeeds with { ok: true }', async () => {
    // Arrange
    answer = json({ ok: true });
    // Act
    await request(app).delete(linkPath()).set(asJose).expect(204);
    answer = json({ ok: false });
    const refused = await request(app).delete(linkPath()).set(asJose).expect(502);
    // Assert
    expect(received.map((event) => event.type)).toEqual(['link.revoke', 'link.revoke']);
    expect(refused.body.message).toMatch(/no confirmó/);
  });

  it('someone outside the space, or an app not installed, gets 404 and the app hears nothing', async () => {
    await request(app).get(linkPath()).set(asStranger).expect(404);
    await request(app).delete(`/api/workspaces/${spaceId}/apps/${new Types.ObjectId()}/link`).set(asJose).expect(404);
    expect(received).toEqual([]);
  });
});
