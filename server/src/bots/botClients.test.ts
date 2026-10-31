import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';
import { configureDevelopers } from './botApps.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';
import { configureChannelNotices } from '../workspaceNotices.js';

/** A channel per client (pending 21, §157): the app sends the client's state and posts by client. */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const asLila = { Authorization: `Basic ${Buffer.from('lca_dev_lila:lcx_dev_secret').toString('base64')}` };
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asBot = (token: string) => ({ Authorization: `Bearer ${token}` });
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let outsider: Types.ObjectId;
let spaceId: Types.ObjectId;
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const asOutsider = asUser(() => outsider);
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
const CLIENT = '64f1c2a9b8e7d6c5b4a39281';
const service = (status: string, extra: Record<string, unknown> = {}) => ({ id: 'srv-1', name: 'Base granular km 12', status, stage: 'ejecucion', stage_label: 'Ejecución', progress: 40, ...extra });
const state = (lastActivityAt: string | null, services: Record<string, unknown>[] = []) => ({ name: 'Transportes Huaral', ruc: '20491238471', last_activity_at: lastActivityAt, last_order_at: lastActivityAt, orders_total: 12, services });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_clients'));
  configureDevelopers(['lca_dev_lila']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, ClientChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, outsider] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }, { phone: '51911111111', name: 'Otro' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
  ]);
  await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: 'http://127.0.0.1:9/events' });
});

async function installApp(key = 'portal'): Promise<string> {
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key, name: key, redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:9/events' }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  return token.body.access_token;
}
const putClient = (token: string, body: unknown, clientId = CLIENT) => request(app).put(`/api/bots/clients/${clientId}`).set(asBot(token)).send(body as object);
const post = (token: string, body: Record<string, unknown>) => request(app).post('/api/bots/messages').set(asBot(token)).send(body);
const listClients = (as: { Authorization: string }) => request(app).get(`/api/workspaces/${spaceId}/clients`).set(as);

describe('PUT /api/bots/clients/:clientId', () => {
  it('the first time it creates a PRIVATE channel with the client name, the bot and the space admins only; again it changes nothing', async () => {
    // Arrange
    const token = await installApp();
    // Act
    const first = await putClient(token, state(daysAgo(3), [service('in_progress')])).expect(201);
    const again = await putClient(token, state(daysAgo(3), [service('in_progress')])).expect(200);
    // Assert
    expect(first.body.client).toMatchObject({ id: CLIENT, live: true, archived_since: null, channel: { name: 'Transportes Huaral' } });
    expect(again.body.client.channel.id).toBe(first.body.client.channel.id);
    const chat = await ChatModel.findById(first.body.client.channel.id).lean();
    expect(chat).toMatchObject({ kind: 'group', workspaceId: spaceId, channel: { visibility: 'private' } });
    expect(chat!.members.map((member) => String(member.userId))).toContain(String(jose));
    expect(chat!.members.map((member) => String(member.userId))).not.toContain(String(ana));
    expect(await ChatModel.countDocuments({ name: 'Transportes Huaral' })).toBe(1);
  });

  it('the admins are told a new channel is theirs, so it shows without reloading (José, 30/10: El Almirante did not show)', async () => {
    // Arrange
    const token = await installApp();
    const told: [string, string][] = [];
    configureChannelNotices((userId, chatId) => told.push([userId, chatId]));
    // Act
    const first = await putClient(token, state(daysAgo(3))).expect(201);
    await putClient(token, state(daysAgo(2))).expect(200);
    configureChannelNotices(() => undefined);
    // Assert
    expect(told).toEqual([[String(jose), first.body.client.channel.id]]);
  });

  it('an admin promoted after the channel was born joins it with the next PUT', async () => {
    // Arrange
    const token = await installApp();
    const created = await putClient(token, state(daysAgo(1))).expect(201);
    await WorkspaceMemberModel.updateOne({ workspaceId: spaceId, userId: ana }, { $set: { role: 'admin' } });
    // Act
    await putClient(token, state(daysAgo(0))).expect(200);
    await putClient(token, state(daysAgo(0))).expect(200);
    // Assert
    const chat = await ChatModel.findById(created.body.client.channel.id).lean();
    expect(chat!.members.filter((member) => String(member.userId) === String(ana))).toEqual([expect.objectContaining({ role: 'admin' })]);
  });

  it('refuses a bad body or a bad client id with 400', async () => {
    // Arrange
    const token = await installApp();
    // Act
    const noName = await putClient(token, { ...state(null), name: '' }).expect(400);
    const badId = await putClient(token, state(null), 'no válido!').expect(400);
    // Assert
    expect(noName.body.error).toBe('invalid_request');
    expect(badId.body.error).toBe('invalid_request');
  });

  it('without movement in 60 days it is archived even with an open service; a new movement brings it back', async () => {
    // Arrange
    const token = await installApp();
    // Act
    const archived = await putClient(token, state(daysAgo(120), [service('in_progress')])).expect(201);
    const back = await putClient(token, state(daysAgo(0), [service('in_progress')])).expect(200);
    // Assert
    expect(archived.body.client).toMatchObject({ live: false });
    expect(Date.parse(archived.body.client.archived_since)).toBeLessThan(Date.now());
    expect(back.body.client).toMatchObject({ live: true, archived_since: null });
  });
});

describe('posting to a client', () => {
  it('a message with target client lands in its channel and keeps its kind and the service', async () => {
    // Arrange
    const token = await installApp();
    const created = await putClient(token, state(daysAgo(1), [service('in_progress')])).expect(201);
    // Act
    const sent = await post(token, { client: CLIENT, kind: 'service.stage_changed', refs: { service_id: 'srv-1' }, text: 'Pasó a Ejecución', idempotency_key: 'k1' }).expect(201);
    // Assert
    expect(sent.body.message.chat_id).toBe(created.body.client.channel.id);
    const message = await MessageModel.findOne({ chatId: created.body.client.channel.id, seq: sent.body.message.seq }).lean();
    expect(message?.clientRef).toEqual({ kind: 'service.stage_changed', serviceId: 'srv-1' });
  });

  it('a client that was never sent is a 404 that says what to do; another app cannot reach this one', async () => {
    // Arrange
    const portal = await installApp();
    await putClient(portal, state(daysAgo(1))).expect(201);
    const other = await installApp('inframaq');
    // Act
    const unknown = await post(portal, { client: 'otro-cliente', text: 'Hola', idempotency_key: 'k2' }).expect(404);
    const foreign = await post(other, { client: CLIENT, text: 'Hola', idempotency_key: 'k3' }).expect(404);
    // Assert
    expect(unknown.body.error).toBe('client_not_found');
    expect(unknown.body.message).toContain('PUT /api/bots/clients/');
    expect(foreign.body.error).toBe('client_not_found');
  });
});

describe('GET /api/workspaces/:id/clients', () => {
  it('an admin sees the clients with live or archived; a plain member sees none; someone outside the space gets 404', async () => {
    // Arrange
    const token = await installApp();
    await putClient(token, state(daysAgo(1))).expect(201);
    await putClient(token, { ...state(daysAgo(200)), name: 'Constructora Rímac' }, 'cliente-2').expect(201);
    // Act
    const forJose = await listClients(asJose).expect(200);
    const forAna = await listClients(asAna).expect(200);
    await listClients(asOutsider).expect(404);
    // Assert
    expect(forJose.body.clients.map((one: { name: string; live: boolean }) => [one.name, one.live])).toEqual([['Transportes Huaral', true], ['Constructora Rímac', false]]);
    expect(forJose.body.clients[1]).toMatchObject({ ruc: '20491238471', orders_total: 12, archived_group: '6+' });
    expect(forJose.body.clients[0].chat_id).toBeTruthy();
    expect(forAna.body.clients).toEqual([]);
  });
});

describe('a service\'s start date (José 31/10: «la lista de servicios no muestra la fecha»)', () => {
  it('what agentes sends as started_at reaches the list; without it, no key', async () => {
    // Arrange
    const token = await installApp();
    await putClient(token, state(daysAgo(1), [service('in_progress', { started_at: '2026-10-06' }), { ...service('pending'), id: 'srv-2' }])).expect(201);
    // Act
    const list = await listClients(asJose).expect(200);
    // Assert
    const [started, plain] = list.body.clients[0].services;
    expect(started.started_at).toBe('2026-10-06');
    expect(plain).not.toHaveProperty('started_at');
  });
});

describe('client channels stay out of the app\'s channel pickers (José, 30/10)', () => {
  it('«Canales donde funciona», «En qué canales está» and «¿Dónde llega cada aviso?» do not list them', async () => {
    // Arrange
    const token = await installApp();
    await putClient(token, state(daysAgo(1))).expect(201);
    const appId = String((await BotAppModel.findOne({ name: 'portal' }).lean())!._id);
    // Act
    const items = await request(app).get(`/api/workspaces/${spaceId}/apps/${appId}/items`).set(asJose).expect(200);
    const channels = await request(app).get(`/api/workspaces/${spaceId}/apps/${appId}/channels`).set(asJose).expect(200);
    const topics = await request(app).get(`/api/workspaces/${spaceId}/apps/${appId}/topics`).set(asJose).expect(200);
    // Assert
    const names = (list: { name: string }[]) => list.map((one) => one.name);
    expect(names(items.body.channels)).toEqual(['general']);
    expect(names(channels.body.channels)).toEqual(['general']);
    expect(names(topics.body.channels)).toEqual(['general']);
  });
});

describe('GET /api/workspaces/:id/clients/:clientId/records', () => {
  it('lists the records of each service for a member of the channel, newest first; a plain member of the space gets 404', async () => {
    // Arrange
    const token = await installApp();
    await putClient(token, { ...state(daysAgo(1), [service('in_progress')]), drive_url: 'https://portal.constroad.com/drive/c1' }).expect(201);
    await post(token, { client: CLIENT, kind: 'service.record', refs: { service_id: 'srv-1', record_id: 'r1' }, text: 'Control de pista · 29 de octubre', idempotency_key: 'k1' }).expect(201);
    await post(token, { client: CLIENT, kind: 'service.record', refs: { service_id: 'srv-1', record_id: 'r2' }, text: 'Cotización COT-12', idempotency_key: 'k2' }).expect(201);
    await post(token, { client: CLIENT, text: 'Sin servicio', idempotency_key: 'k3' }).expect(201);
    // Act
    const forJose = await request(app).get(`/api/workspaces/${spaceId}/clients/${CLIENT}/records`).set(asJose).expect(200);
    await request(app).get(`/api/workspaces/${spaceId}/clients/${CLIENT}/records`).set(asAna).expect(404);
    const list = await listClients(asJose).expect(200);
    // Assert
    expect(forJose.body.records.map((one: { title: string; service_id: string }) => [one.title, one.service_id])).toEqual([['Cotización COT-12', 'srv-1'], ['Control de pista · 29 de octubre', 'srv-1']]);
    expect(forJose.body.records[0]).toMatchObject({ kind: 'service.record', record_id: 'r2' });
    expect(list.body.clients[0].drive_url).toBe('https://portal.constroad.com/drive/c1');
  });
});
