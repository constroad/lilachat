import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { ChecklistModel } from '../checklistModel.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';
import { configureDevelopers } from './botApps.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** José 06/11: an order's field checklist goes to the «Checklist» tab, where people assign, date and tick it. */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl: string;
const heard: { type: string; data: Record<string, unknown> }[] = [];
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const asLila = { Authorization: `Basic ${Buffer.from('lca_dev_lila:lcx_dev_secret').toString('base64')}` };
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asBot = (token: string) => ({ Authorization: `Bearer ${token}` });
const CLIENT = '64f1c2a9b8e7d6c5b4a39281';
const EXECUTION = 3;
let jose: Types.ObjectId;
let spaceId: Types.ObjectId;
let token: string;
const asJose = asUser(() => jose);
const order = (key: string, label: string, items: unknown[] = [{ text: 'Cuadrilla', key: 'cuadrilla' }, { text: 'Termómetro', key: 'termometro' }]) => ({ key, label, items });
const addTasks = (body: unknown, clientId = CLIENT) => request(app).post(`/api/bots/clients/${clientId}/tasks`).set(asBot(token)).send(body as object);
const stageOf = async () => ChecklistModel.findOne({ stage: EXECUTION }).lean();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_client_tasks'));
  configureDevelopers(['lca_dev_lila']);
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      heard.push({ type: String(req.headers['x-lilachat-event']), data: (JSON.parse(body || '{}') as { data?: Record<string, unknown> }).data ?? {} });
      res.writeHead(200).end('{}');
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/events`;
});
afterAll(async () => {
  await new Promise((resolve) => hook.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  heard.length = 0;
  await Promise.all([UserModel, ChatModel, MessageModel, ChecklistModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, ClientChannelModel].map((model) => (model as typeof UserModel).deleteMany({})));
  jose = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' });
  await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }] });
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: hookUrl });
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key: 'portal', name: 'Portal', redirect_uri: REDIRECT, webhook_url: hookUrl }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const issued = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  token = issued.body.access_token;
  await request(app).put(`/api/bots/clients/${CLIENT}`).set(asBot(token)).send({ name: 'Transportes Huaral', last_activity_at: null, last_order_at: null, orders_total: 0, services: [] }).expect((res) => expect(res.status).toBeLessThan(300));
});

describe('POST /api/bots/clients/:clientId/tasks', () => {
  it('adds the order\'s tasks to «Ejecución» with its code, starting the channel\'s stages, and posts nothing in the chat', async () => {
    // Act
    const added = await addTasks(order('order:ped-12', 'PED-12')).expect(201);
    // Assert
    expect(added.body).toEqual({ added: 2 });
    const stage = await stageOf();
    expect(stage?.title).toBe('Ejecución');
    expect(stage?.items.map((item) => item.text)).toEqual(['PED-12 · Cuadrilla', 'PED-12 · Termómetro']);
    expect(await ChecklistModel.countDocuments({ stage: { $exists: true } })).toBe(7);
    expect(await MessageModel.countDocuments({})).toBe(0);
  });

  it('the same order twice adds nothing: the event can arrive again', async () => {
    // Arrange
    await addTasks(order('order:ped-12', 'PED-12')).expect(201);
    // Act
    const again = await addTasks(order('order:ped-12', 'PED-12')).expect(200);
    // Assert
    expect(again.body).toEqual({ added: 0 });
    expect((await stageOf())?.items).toHaveLength(2);
  });

  it('two orders live in the same stage, past the thirty tasks of a chat checklist', async () => {
    // Arrange
    const tasks = Array.from({ length: 9 }, (_, index) => ({ text: `Punto ${index + 1}` }));
    // Act
    for (const code of ['PED-1', 'PED-2', 'PED-3', 'PED-4']) await addTasks(order(`order:${code}`, code, tasks)).expect(201);
    // Assert
    expect((await stageOf())?.items).toHaveLength(36);
  });

  it('a stage at its limit says so and keeps what it has', async () => {
    // Arrange
    const tasks = Array.from({ length: 30 }, (_, index) => ({ text: `Punto ${index + 1}` }));
    for (let round = 0; round < 10; round += 1) await addTasks(order(`order:${round}`, `PED-${round}`, tasks)).expect(201);
    // Act
    const refused = await addTasks(order('order:full', 'PED-X', [{ text: 'Una más' }])).expect(409);
    // Assert
    expect(refused.body.error).toBe('stage_full');
    expect((await stageOf())?.items).toHaveLength(300);
  });

  it('a task can come with its person and date; a client without channel or a bad body is refused', async () => {
    // Act
    await addTasks(order('order:ped-7', 'PED-7', [{ text: 'Cuadrilla', assignee_phone: '902049935', due_at: '2026-11-07T15:00:00.000Z' }])).expect(201);
    const noClient = await addTasks(order('order:x', 'PED-8'), 'otro-cliente').expect(404);
    const noKey = await addTasks({ label: 'PED-8', items: [{ text: 'A' }] }).expect(400);
    const noPerson = await addTasks(order('order:y', 'PED-9', [{ text: 'A', assignee_phone: '911111111' }])).expect(400);
    // Assert
    const [task] = (await stageOf())!.items;
    expect(String(task!.assignee)).toBe(String(jose));
    expect(task!.dueAt?.toISOString()).toBe('2026-11-07T15:00:00.000Z');
    expect(noClient.body.error).toBe('client_not_found');
    expect(noKey.body.message).toContain('key');
    expect(noPerson.body.error).toBe('assignee_not_member');
  });

  it('whoever sees the channel assigns and dates a task the app added, and the app hears when it is ticked', async () => {
    // Arrange
    await addTasks(order('order:ped-12', 'PED-12')).expect(201);
    const stage = (await stageOf())!;
    const task = stage.items[0]!;
    const channel = await ClientChannelModel.findOne({ clientId: CLIENT }).lean();
    await ChatModel.updateOne({ _id: channel!.chatId }, { $addToSet: { members: { userId: jose, role: 'admin' } } });
    // Act
    await request(app).patch(`/api/agenda/checklists/${stage._id}/items/${task.id}`).set(asJose).send({ assignee: String(jose), dueAt: '2026-11-08T15:00:00.000Z' }).expect(200);
    await request(app).post(`/api/agenda/checklists/${stage._id}/items/${task.id}/toggle`).set(asJose).send({}).expect(200);
    await expect.poll(() => heard.filter((one) => one.type === 'checklist.item.toggled').length).toBe(1);
    // Assert
    const event = heard.find((one) => one.type === 'checklist.item.toggled')!;
    expect(event.data.item).toMatchObject({ id: task.id, key: 'cuadrilla', text: 'PED-12 · Cuadrilla', done: true, source_key: 'order:ped-12' });
    expect((await stageOf())?.items[0]?.assignee).toBeTruthy();
  });

  it('the app reads where an order\'s tasks stand: each with its key, done or not, its person and date', async () => {
    // Arrange
    await addTasks(order('order:ped-12', 'PED-12', [{ text: 'Cuadrilla', key: 'cuadrilla', assignee_phone: '902049935', due_at: '2026-11-07T15:00:00.000Z' }, { text: 'Comidas', key: 'comidas' }])).expect(201);
    await addTasks(order('order:ped-13', 'PED-13')).expect(201);
    // Act
    const read = await request(app).get(`/api/bots/clients/${CLIENT}/tasks`).query({ key: 'order:ped-12' }).set(asBot(token)).expect(200);
    const noKey = await request(app).get(`/api/bots/clients/${CLIENT}/tasks`).set(asBot(token)).expect(400);
    const noClient = await request(app).get('/api/bots/clients/otro/tasks').query({ key: 'order:ped-12' }).set(asBot(token)).expect(404);
    // Assert
    expect(read.body.tasks).toEqual([
      { id: expect.any(String), key: 'cuadrilla', text: 'PED-12 · Cuadrilla', done: false, done_at: null, assignee_phone: '51902049935', due_at: '2026-11-07T15:00:00.000Z' },
      { id: expect.any(String), key: 'comidas', text: 'PED-12 · Comidas', done: false, done_at: null, assignee_phone: null, due_at: null },
    ]);
    expect(noKey.body.message).toBe('Falta key.');
    expect(noClient.body.error).toBe('client_not_found');
  });
});
