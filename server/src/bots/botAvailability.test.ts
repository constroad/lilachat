import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
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
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** Which apps each space may install, decided from agentes' console (José, 23/10; `specs/BOTS-API.spec.md` §0-ter). */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const HOOK = 'https://agentes.example.com/v1/channels/lilachat/events';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const basic = (clientId: string, secret: string) => ({ Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` });
const asLila = basic('lca_dev_lila', 'lcx_dev_secret');
const asOther = basic('lca_dev_other', 'lcx_other_secret');
let jose: Types.ObjectId;
let inframaq: Types.ObjectId;
let portalSpace: Types.ObjectId;
let foreign: Types.ObjectId;
const asJose = { get Authorization() { return `Bearer ${signSession({ userId: String(jose), deviceId: 'd-jose', email: 'x' })}`; } };
const manifest = (key: string, name: string) => ({ key, name, redirect_uri: REDIRECT, webhook_url: HOOK, install_url: `https://agentes.example.com/canales/lilachat/instalar?app=${key}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_availability'));
  configureDevelopers(['lca_dev_lila', 'lca_dev_other']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  jose = (await UserModel.create({ phone: '51902049935', name: 'José', email: 'jose@constroad.com', emailVerifiedAt: new Date() }))._id;
  const ana = (await UserModel.create({ phone: '51900000801', name: 'Ana' }))._id;
  [inframaq, portalSpace, foreign] = (await WorkspaceModel.create([
    { name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' },
    { name: 'Portal', ownerId: ana, joinCode: 'PORT-2M4Q' },
    { name: 'Ajeno', ownerId: ana, joinCode: 'AJEN-9X8Z' },
  ])).map((space) => space._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  await WorkspaceMemberModel.create([
    { workspaceId: inframaq, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: inframaq, userId: ana, phone: '51900000801', role: 'member', status: 'active' },
    { workspaceId: portalSpace, userId: ana, phone: '51900000801', role: 'owner', status: 'active' },
    { workspaceId: portalSpace, userId: jose, phone: '51902049935', role: 'admin', status: 'active' },
    { workspaceId: foreign, userId: ana, phone: '51900000801', role: 'owner', status: 'active' },
    { workspaceId: foreign, userId: jose, phone: '51902049935', role: 'member', status: 'active' },
  ]);
  await BotAppModel.create([
    { clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: HOOK },
    { clientId: 'lca_dev_other', clientSecretHash: sha256('lcx_other_secret'), name: 'Otra', redirectUris: [REDIRECT], webhookUrl: HOOK },
  ]);
  await request(app).post('/api/bots/apps').set(asLila).send(manifest('inframaq', 'Inframaq')).expect(201);
  await request(app).post('/api/bots/apps').set(asLila).send(manifest('portal', 'Portal')).expect(201);
});

const clientIdOf = async (key: string) => (await BotAppModel.findOne({ key }).lean())!.clientId;
const authorizeIn = (clientId: string, spaceId: Types.ObjectId) =>
  request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: clientId, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' });
async function install(key: string, spaceId: Types.ObjectId) {
  const clientId = await clientIdOf(key);
  const authorized = await authorizeIn(clientId, spaceId).expect(200);
  // The secret came back once at creation; the test sets a known one to trade the code.
  await BotAppModel.updateOne({ clientId }, { $set: { clientSecretHash: sha256('lcx_known') } });
  await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: clientId, client_secret: 'lcx_known', code_verifier: VERIFIER }).expect(200);
}
const directoryNames = async (spaceId: Types.ObjectId) => (await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asJose).expect(200)).body.apps.map((one: { name: string }) => one.name);

describe('the spaces a person runs (GET /api/bots/spaces)', () => {
  it('by phone or verified email: only where they are owner or admin, with their role, members and the developer apps installed there', async () => {
    // Arrange
    await install('inframaq', inframaq);
    // Act
    const byEmail = (await request(app).get('/api/bots/spaces').query({ admin: 'JOSE@constroad.com ' }).set(asLila).expect(200)).body.spaces;
    const byPhone = (await request(app).get('/api/bots/spaces').query({ admin: '902 049 935' }).set(asLila).expect(200)).body.spaces;
    // Assert
    expect(byEmail).toEqual([
      { id: String(inframaq), name: 'INFRAMAQ', members: 2, role: 'owner', installed: ['inframaq'] },
      { id: String(portalSpace), name: 'Portal', members: 2, role: 'admin', installed: [] },
    ]);
    expect(byPhone).toEqual(byEmail);
  });

  it('an unverified email, an unknown person or another developer\'s apps reveal nothing', async () => {
    await UserModel.updateOne({ _id: jose }, { $unset: { emailVerifiedAt: 1 } });
    await install('inframaq', inframaq);
    expect((await request(app).get('/api/bots/spaces').query({ admin: 'jose@constroad.com' }).set(asLila).expect(200)).body.spaces).toEqual([]);
    expect((await request(app).get('/api/bots/spaces').query({ admin: '987654321' }).set(asLila).expect(200)).body.spaces).toEqual([]);
    const seenByOther = (await request(app).get('/api/bots/spaces').query({ admin: '902049935' }).set(asOther).expect(200)).body.spaces;
    expect(seenByOther[0].installed).toEqual([]);
  });

  it('asks for a phone or an email, and a developer credential', async () => {
    expect((await request(app).get('/api/bots/spaces').query({ admin: 'hola' }).set(asLila).expect(400)).body.error).toBe('invalid_request');
    await request(app).get('/api/bots/spaces').query({ admin: '902049935' }).expect(401);
  });
});

describe('which spaces may install an app (availability)', () => {
  it('everywhere until agentes chooses; then the directory hides it and its OAuth refuses where it is not available', async () => {
    // Arrange
    expect((await request(app).get('/api/bots/apps/by-key/portal/availability').set(asLila).expect(200)).body).toEqual({ everywhere: true });
    // Act
    const set = await request(app).put('/api/bots/apps/by-key/portal/availability').set(asLila).send({ spaces: [String(portalSpace)] }).expect(200);
    // Assert
    expect(set.body).toEqual({ spaces: [String(portalSpace)] });
    expect(await directoryNames(inframaq)).toEqual(['Inframaq']);
    expect(await directoryNames(portalSpace)).toEqual(['Inframaq', 'Portal']);
    const refused = await authorizeIn(await clientIdOf('portal'), inframaq).expect(403);
    expect(refused.body.error).toBe('app_not_available');
    const consent = await request(app).get('/api/oauth/app').query({ client_id: await clientIdOf('portal'), redirect_uri: REDIRECT }).set(asJose).expect(200);
    expect(consent.body.spaces.map((space: { name: string }) => space.name)).toEqual(['Portal']);
  });

  it('an app already installed stays in its space after being taken off the list; everywhere brings it back', async () => {
    await install('inframaq', inframaq);
    await request(app).put(`/api/bots/apps/${await clientIdOf('inframaq')}/availability`).set(asLila).send({ spaces: [String(portalSpace)] }).expect(200);
    expect(await directoryNames(inframaq)).toEqual(['Inframaq', 'Portal']);
    await request(app).put('/api/bots/apps/by-key/inframaq/availability').set(asLila).send({ everywhere: true }).expect(200);
    expect((await request(app).get('/api/bots/apps/by-key/inframaq/availability').set(asLila).expect(200)).body).toEqual({ everywhere: true });
  });

  it('refuses unknown spaces, a bad body, and another developer\'s app', async () => {
    expect((await request(app).put('/api/bots/apps/by-key/portal/availability').set(asLila).send({ spaces: [String(new Types.ObjectId())] }).expect(400)).body.error).toBe('unknown_space');
    expect((await request(app).put('/api/bots/apps/by-key/portal/availability').set(asLila).send({ spaces: ['x'] }).expect(400)).body.error).toBe('invalid_request');
    expect((await request(app).put('/api/bots/apps/by-key/portal/availability').set(asLila).send({}).expect(400)).body.error).toBe('invalid_request');
    expect((await request(app).put('/api/bots/apps/by-key/portal/availability').set(asOther).send({ everywhere: true }).expect(404)).body.error).toBe('app_not_found');
  });

  it('an empty list means no space may install it', async () => {
    await request(app).put('/api/bots/apps/by-key/portal/availability').set(asLila).send({ spaces: [] }).expect(200);
    expect(await directoryNames(portalSpace)).toEqual(['Inframaq']);
  });
});
