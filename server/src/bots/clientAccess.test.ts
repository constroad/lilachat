import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel } from '../chatModels.js';
import { ChecklistModel } from '../checklistModel.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotInstallationModel } from './botModels.js';
import { ClientChannelModel } from './botClients.js';

/**
 * José 30/10 night: topographers and engineers join a client's channel with
 * restricted access (the tabs and checklist stages an admin picks), and money
 * (Cuenta, quotes, Cobranza) is only for admins and whoever an admin marks.
 */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl = '';
let answer: { status: number; body: unknown } = { status: 200, body: {} };
let received: { type?: string }[] = [];
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let topo: Types.ObjectId;
let spaceId: Types.ObjectId;
let chatId: Types.ObjectId;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const base = () => `/api/workspaces/${spaceId}/clients/cli-cvs`;
const setAccess = (who: Types.ObjectId, target: Types.ObjectId, body: object) => request(app).put(`${base()}/access/${target}`).set(auth(who)).send(body);
const myAccess = async (who: Types.ObjectId) => (await request(app).get(`/api/workspaces/${spaceId}/clients`).set(auth(who)).expect(200)).body.clients[0].access;
const DETAIL = { service: { id: 'srv-318', name: 'Pavimentación' }, orders: [], dispatches: [], reports: [], quotes: [{ id: 'q1', code: '313', total: 1000, status_label: 'Borrador', tone: 'neutral' }], billing: { total: 1000, collected: 0, pending: 1000, items: [], payments: [] }, totals: { orders: 0, dispatches: 0, reports: 0, quotes: 1 } };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_client_access_test'));
  hook = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      received.push({ type: (JSON.parse(raw) as { type?: string }).type });
      res.writeHead(answer.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  const address = hook.address();
  hookUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/v1/channels/lilachat/events`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => hook.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received = [];
  answer = { status: 200, body: DETAIL };
  await Promise.all([UserModel, ChatModel, ChecklistModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, ClientChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, topo] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51922222222', name: 'Ana' }, { phone: '51933333333', name: 'Topógrafo' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51922222222', role: 'member', status: 'active' },
    { workspaceId: spaceId, userId: topo, phone: '51933333333', role: 'member', status: 'active' },
  ]);
  const botUser = (await UserModel.create({ phone: 'bot-portal', name: 'Portal' }))._id;
  const appDoc = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl });
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: 'h1', signingSecret: 'secret', installedBy: jose });
  chatId = (await ChatModel.create({ kind: 'group', name: 'constructora-via-sur', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: botUser, role: 'member' }, { userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  await ClientChannelModel.create({ workspaceId: spaceId, appId: appDoc._id, clientId: 'cli-cvs', chatId, name: 'Constructora Vía Sur', services: [{ id: 'srv-318', name: 'Pavimentación', status: 'in_progress' }] });
});

describe('my access, in the client list', () => {
  it('an admin sees money; a member does not; a restricted member gets her tabs and stages', async () => {
    // Act
    const admin = await myAccess(jose);
    const member = await myAccess(ana);
    await setAccess(jose, ana, { restricted: { tabs: ['checklist'], stages: [] } }).expect(200);
    const restricted = await myAccess(ana);
    // Assert
    expect(admin).toEqual({ money: true });
    expect(member).toEqual({ money: false });
    expect(restricted).toEqual({ money: false, restricted: { tabs: ['checklist'], stages: [] } });
  });
});

describe('the access editor (admins only)', () => {
  it('marks money and a restriction, lists them, and lifts the restriction with null', async () => {
    // Act
    await setAccess(jose, ana, { money: true }).expect(200);
    const saved = await setAccess(jose, ana, { restricted: { tabs: ['services', 'checklist'], stages: ['a'.repeat(24)] } }).expect(200);
    const lifted = await setAccess(jose, ana, { restricted: null }).expect(200);
    // Assert
    expect(saved.body).toEqual({ viewers: [String(ana)], restricted: [{ user_id: String(ana), tabs: ['services', 'checklist'], stages: ['a'.repeat(24)] }], admins: [String(jose)] });
    expect(lifted.body).toEqual({ viewers: [String(ana)], restricted: [], admins: [String(jose)] });
    expect((await request(app).get(`${base()}/access`).set(auth(jose)).expect(200)).body).toEqual(lifted.body);
  });

  it('a member cannot edit or list; nobody outside the channel; an admin of the space is never restricted; a bad tab is a 400', async () => {
    expect((await setAccess(ana, ana, { money: true })).status).toBe(403);
    expect((await request(app).get(`${base()}/access`).set(auth(ana))).status).toBe(403);
    expect((await setAccess(jose, topo, { money: true })).status).toBe(404);
    expect((await setAccess(jose, jose, { restricted: { tabs: [], stages: [] } })).body.message).toBe('Un admin del espacio ve todo el canal.');
    expect((await setAccess(jose, ana, { restricted: { tabs: ['account'], stages: [] } })).status).toBe(400);
  });

  it('promoting a restricted member to admin lifts her restriction', async () => {
    // Arrange
    await setAccess(jose, ana, { restricted: { tabs: [], stages: [] } }).expect(200);
    const anaMember = await WorkspaceMemberModel.findOne({ workspaceId: spaceId, userId: ana }).lean();
    // Act
    await request(app).patch(`/api/workspaces/${spaceId}/members/${anaMember!._id}`).set(auth(jose)).send({ role: 'admin' }).expect(200);
    // Assert
    expect(await myAccess(ana)).toEqual({ money: true });
  });
});

describe('what a restricted member can ask', () => {
  it('without Servicios or Archivos: no detail and no Drive (404, nothing asked)', async () => {
    await setAccess(jose, ana, { restricted: { tabs: ['checklist'], stages: [] } }).expect(200);
    expect((await request(app).get(`${base()}/services/srv-318/detail`).set(auth(ana))).status).toBe(404);
    expect((await request(app).get(`${base()}/services/srv-318/files`).set(auth(ana))).status).toBe(404);
    expect(received).toHaveLength(0);
  });

  it('with Servicios: the detail, without quotes nor collection', async () => {
    await setAccess(jose, ana, { restricted: { tabs: ['services'], stages: [] } }).expect(200);
    const detail = (await request(app).get(`${base()}/services/srv-318/detail`).set(auth(ana)).expect(200)).body.detail;
    expect(detail.quotes).toBeUndefined();
    expect(detail.billing).toBeUndefined();
  });
});

describe('money (José: «la cuenta y temas sensibles de plata y cotizaciones solo administradores»)', () => {
  it('a member without money gets no account and a detail without quotes; marked, she gets both', async () => {
    // Act
    const refused = await request(app).get(`${base()}/account`).set(auth(ana));
    const detail = (await request(app).get(`${base()}/services/srv-318/detail`).set(auth(ana)).expect(200)).body.detail;
    await setAccess(jose, ana, { money: true }).expect(200);
    const marked = (await request(app).get(`${base()}/services/srv-318/detail`).set(auth(ana)).expect(200)).body.detail;
    // Assert
    expect(refused.status).toBe(404);
    expect(detail.quotes).toBeUndefined();
    expect(marked.quotes).toHaveLength(1);
    expect(marked.billing.total).toBe(1000);
  });
});

describe('adding someone to the client channel with restricted access', () => {
  it('an admin adds the topographer with only the checklist: he joins restricted', async () => {
    // Act
    await request(app).post(`/api/chats/${chatId}/members`).set(auth(jose)).send({ userId: String(topo), history: false, access: { tabs: ['checklist'], stages: [] } }).expect(200);
    // Assert
    expect(await myAccess(topo)).toEqual({ money: false, restricted: { tabs: ['checklist'], stages: [] } });
  });

  it('only an admin of the space limits access; a bad access adds nobody', async () => {
    const byMember = await request(app).post(`/api/chats/${chatId}/members`).set(auth(ana)).send({ userId: String(topo), access: { tabs: [], stages: [] } });
    const bad = await request(app).post(`/api/chats/${chatId}/members`).set(auth(jose)).send({ userId: String(topo), access: { tabs: ['account'] } });
    expect(byMember.status).toBe(403);
    expect(bad.status).toBe(400);
    expect(await ChatModel.exists({ _id: chatId, 'members.userId': topo })).toBeNull();
  });
});

describe('the checklist by stages, seen by a restricted member', () => {
  const stagesOf = async (who: Types.ObjectId) => (await request(app).get(`/api/agenda/checklists/stages?chatId=${chatId}`).set(auth(who)).expect(200)).body.stages as { _id: string; title: string; items: { id: string }[] }[];

  async function twoStagesWithTasks() {
    await request(app).post('/api/agenda/checklists/stages').set(auth(jose)).send({ chatId: String(chatId) }).expect(201);
    const [first, second] = await stagesOf(jose);
    if (!first || !second) throw new Error('the seven stages were not created');
    await ChecklistModel.updateOne({ _id: first._id }, { $set: { items: [{ id: 'p1', text: 'Permiso municipal', doneBy: null, doneAt: null }] } });
    await ChecklistModel.updateOne({ _id: second._id }, { $set: { items: [{ id: 't1', text: 'Replanteo', doneBy: null, doneAt: null, assignee: ana }, { id: 't2', text: 'Monto de la valorización', doneBy: null, doneAt: null }] } });
    return { first: first._id, second: second._id };
  }

  it('sees the picked stage whole and, elsewhere, only her tasks', async () => {
    // Arrange
    const { first, second } = await twoStagesWithTasks();
    await setAccess(jose, ana, { restricted: { tabs: ['checklist'], stages: [first] } }).expect(200);
    // Act
    const seen = await stagesOf(ana);
    // Assert
    expect(seen.map((stage) => [stage._id, stage.items.map((item) => item.id)])).toEqual([[first, ['p1']], [second, ['t1']]]);
    expect((await stagesOf(jose)).length).toBe(7);
  });

  it('a restricted member does not start the checklist', async () => {
    await setAccess(jose, ana, { restricted: { tabs: ['checklist'], stages: [] } }).expect(200);
    expect((await request(app).post('/api/agenda/checklists/stages').set(auth(ana)).send({ chatId: String(chatId) })).status).toBe(403);
  });

  it('a hidden stage is a 404; in a stage she sees partly she ticks her task but cannot add', async () => {
    // Arrange
    const { second } = await twoStagesWithTasks();
    const third = (await stagesOf(jose))[2]!._id;
    await setAccess(jose, ana, { restricted: { tabs: ['checklist'], stages: [] } }).expect(200);
    // Act
    const hidden = await request(app).get(`/api/agenda/checklists/${third}`).set(auth(ana));
    const partial = await request(app).get(`/api/agenda/checklists/${second}`).set(auth(ana)).expect(200);
    const ticked = await request(app).post(`/api/agenda/checklists/${second}/items/t1/toggle`).set(auth(ana)).expect(200);
    const added = await request(app).post(`/api/agenda/checklists/${second}/items`).set(auth(ana)).send({ text: 'Otra' });
    const other = await request(app).post(`/api/agenda/checklists/${second}/items/t2/toggle`).set(auth(ana));
    // Assert
    expect(hidden.status).toBe(404);
    expect(partial.body.checklist.items.map((item: { id: string }) => item.id)).toEqual(['t1']);
    expect(ticked.body.checklist.items.map((item: { id: string }) => item.id)).toEqual(['t1']);
    expect(added.status).toBe(403);
    expect(other.status).toBe(404);
  });
});
