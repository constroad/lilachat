import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { configureDevelopers } from './botApps.js';
import { configureAppsAnnounce } from './botAnnounce.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** Apps made by a developer app through a manifest (`specs/BOTS-API.spec.md` §0-bis): no secret per app through a person. */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const basic = (clientId: string, secret: string) => ({ Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` });
const asLila = basic('lca_dev_lila', 'lcx_dev_secret');
const asOther = basic('lca_dev_other', 'lcx_other_secret');
let jose: Types.ObjectId;
let spaceId: Types.ObjectId;
let hook: Server;
let hookUrl = '';
const received: { headers: IncomingMessage['headers']; body: string }[] = [];
const manifest = () => ({ key: 'inframaq', name: 'Inframaq', redirect_uri: REDIRECT, webhook_url: hookUrl, install_url: 'https://agentes.example.com/canales/lilachat/instalar?app=inframaq', commands: [{ command: 'clima', description: 'Clima de la planta' }] });
const asJose = { get Authorization() { return `Bearer ${signSession({ userId: String(jose), deviceId: 'd-jose', email: 'x' })}`; } };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_apps'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.end();
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
  configureDevelopers(['lca_dev_lila', 'lca_dev_other']);
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  forgetBots();
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' });
  await BotAppModel.create([
    { clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: hookUrl },
    { clientId: 'lca_dev_other', clientSecretHash: sha256('lcx_other_secret'), name: 'Otra', redirectUris: [REDIRECT], webhookUrl: hookUrl },
    { clientId: 'lca_plain', clientSecretHash: sha256('lcx_plain_secret'), name: 'Suelta', redirectUris: [REDIRECT], webhookUrl: hookUrl },
  ]);
});

async function installWith(clientId: string, clientSecret: string) {
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: clientId, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  return request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: clientId, client_secret: clientSecret, code_verifier: VERIFIER });
}

describe('who may create apps', () => {
  it('only a developer app, with its right secret', async () => {
    expect((await request(app).post('/api/bots/apps').send(manifest()).expect(401)).body.error).toBe('invalid_client');
    await request(app).post('/api/bots/apps').set(basic('lca_dev_lila', 'lcx_wrong')).send(manifest()).expect(401);
    expect((await request(app).post('/api/bots/apps').set(basic('lca_plain', 'lcx_plain_secret')).send(manifest()).expect(403)).body.error).toBe('not_a_developer');
    expect((await request(app).post('/api/bots/apps').set(asLila).send({ ...manifest(), key: 'Mal' }).expect(400)).body.error).toBe('invalid_request');
  });
});

describe('the manifest', () => {
  it('201 with the secret the first time, 200 without it after; the fields and commands follow the manifest', async () => {
    const first = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    expect(first.body.client_id).toMatch(/^lca_/);
    expect(first.body.client_secret).toMatch(/^lcx_/);
    const again = await request(app).post('/api/bots/apps').set(asLila).send({ ...manifest(), name: 'Inframaq Planta', commands: [{ command: 'tanques', description: 'Nivel' }] }).expect(200);
    expect(again.body).toEqual({ client_id: first.body.client_id });
    const stored = await BotAppModel.findOne({ clientId: first.body.client_id }).lean();
    expect(stored).toMatchObject({ name: 'Inframaq Planta', key: 'inframaq', installUrl: manifest().install_url, commands: [{ command: 'tanques', description: 'Nivel' }] });
  });

  it('the new app installs by OAuth with the secret it got, and its commands reach the space', async () => {
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    const token = await installWith(body.client_id, body.client_secret);
    expect(token.status).toBe(200);
    expect(token.body.access_token).toMatch(/^lcb_/);
    const groups = (await request(app).get(`/api/workspaces/${spaceId}/commands`).set(asJose).expect(200)).body.groups;
    expect(groups).toEqual([expect.objectContaining({ appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima de la planta' }] })]);
  });

  it('a re-sent manifest tells the members of every space with the app, so their «/» list is not stale (José, 23/10)', async () => {
    // Arrange
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    await installWith(body.client_id, body.client_secret);
    // The install tells them too, on its own time: let it pass first.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const told: { userIds: readonly string[]; workspaceId: string }[] = [];
    configureAppsAnnounce((userIds, workspaceId) => told.push({ userIds, workspaceId }));
    // Act
    await request(app).post('/api/bots/apps').set(asLila).send({ ...manifest(), commands: [] }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Assert
    expect(told).toEqual([{ userIds: [String(jose)], workspaceId: String(spaceId) }]);
    expect((await request(app).get(`/api/workspaces/${spaceId}/commands`).set(asJose).expect(200)).body.groups).toEqual([]);
    configureAppsAnnounce(() => undefined);
  });

  it('rotating gives a new secret and the old one stops working; the installation lives on', async () => {
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    const token = (await installWith(body.client_id, body.client_secret)).body.access_token;
    const rotated = await request(app).post(`/api/bots/apps/${body.client_id}/secret`).set(asLila).expect(200);
    expect(rotated.body.client_secret).not.toBe(body.client_secret);
    expect((await installWith(body.client_id, body.client_secret)).body.error).toBe('invalid_client');
    expect((await installWith(body.client_id, rotated.body.client_secret)).status).toBe(200);
    await request(app).get('/api/bots/me').set({ Authorization: `Bearer ${token}` }).expect(401); // reinstalling replaced it, as always
  });

  it('lists only its own apps, without secrets, with how many spaces have them', async () => {
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    await installWith(body.client_id, body.client_secret);
    await request(app).post('/api/bots/apps').set(asOther).send({ ...manifest(), key: 'portal', name: 'Portal' }).expect(201);
    const listed = (await request(app).get('/api/bots/apps').set(asLila).expect(200)).body.apps;
    expect(listed).toEqual([{ client_id: body.client_id, key: 'inframaq', name: 'Inframaq', redirect_uri: REDIRECT, webhook_url: hookUrl, install_url: manifest().install_url, commands: [{ command: 'clima', description: 'Clima de la planta' }], installations: 1 }]);
    expect(JSON.stringify(listed)).not.toContain('lcx_');
  });

  it("another developer's app is 404, never 403", async () => {
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    await request(app).post(`/api/bots/apps/${body.client_id}/secret`).set(asOther).expect(404);
    await request(app).delete(`/api/bots/apps/${body.client_id}`).set(asOther).expect(404);
  });

  it('deleting tells every space (app.uninstalled, by nobody), revokes and removes the app', async () => {
    const { body } = await request(app).post('/api/bots/apps').set(asLila).send(manifest()).expect(201);
    const token = (await installWith(body.client_id, body.client_secret)).body.access_token;
    await request(app).delete(`/api/bots/apps/${body.client_id}`).set(asLila).expect(204);
    const notice = received.find((one) => one.headers['x-lilachat-event'] === 'app.uninstalled');
    expect(JSON.parse(notice!.body).data).toEqual({ by: null });
    await request(app).get('/api/bots/me').set({ Authorization: `Bearer ${token}` }).expect(401);
    expect(await BotAppModel.countDocuments({ clientId: body.client_id })).toBe(0);
    await request(app).delete(`/api/bots/apps/${body.client_id}`).set(asLila).expect(404);
  });

  it('twenty apps per developer at most', async () => {
    for (let index = 0; index < 20; index++) await request(app).post('/api/bots/apps').set(asLila).send({ ...manifest(), key: `app-${index}` }).expect(201);
    expect((await request(app).post('/api/bots/apps').set(asLila).send({ ...manifest(), key: 'one-more' }).expect(400)).body.error).toBe('too_many_apps');
  });
});
