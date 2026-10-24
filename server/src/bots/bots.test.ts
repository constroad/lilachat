import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel, type Message } from '../chatModels.js';
import { ChecklistModel } from '../checklistModel.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotDeliveryModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { configureBotDeliveries } from './botEvents.js';
import { forgetBots } from './botRegistry.js';
import { botsHearMessage } from './botTriggers.js';
import { sha256 } from './botSecrets.js';

/** The bots API, end to end (`specs/BOTS-API.spec.md`): install by OAuth + PKCE, publish, hear signed events, uninstall. */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const SECRET = 'lcx_test-client-secret';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
let privateChannel: Types.ObjectId;
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);

// The app's webhook: a real HTTP server that records what arrives, failing the first N on request.
type Received = { headers: Record<string, string | string[] | undefined>; body: string };
const received: Received[] = [];
let failNext = 0;
let hook: Server;
let hookUrl = '';
const waitFor = async <T>(read: () => T | undefined, timeoutMs = 3000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) throw new Error('timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const waitUntil = async (done: () => Promise<boolean>, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!(await done())) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const eventOf = (type: string) => waitFor(() => received.find((one) => one.headers['x-lilachat-event'] === type));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bots'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.statusCode = failNext > 0 ? (failNext--, 500) : 200;
      res.end();
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/v1/channels/lilachat/events`;
  configureBotDeliveries({ retryDelaysMs: [50, 50] });
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  failNext = 0;
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, ChecklistModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, BotDeliveryModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, beto] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }, { phone: '976543210', name: 'Beto' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active', title: 'Residente' },
  ]);
  channel = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  privateChannel = (await ChatModel.create({ kind: 'group', name: 'gerencia', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: jose, role: 'admin' }], lastSeq: 0 }))._id;
  await BotAppModel.create({ clientId: 'lca_lila', clientSecretHash: sha256(SECRET), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: hookUrl });
});

async function install(): Promise<{ token: string; signingSecret: string; installationId: string; botUserId: string }> {
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_lila', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const url = new URL(authorized.body.redirect);
  expect(url.origin + url.pathname).toBe(REDIRECT);
  expect(url.searchParams.get('state')).toBe('state-0123456789abcdef');
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT, client_id: 'lca_lila', client_secret: SECRET, code_verifier: VERIFIER }).expect(200);
  return { token: token.body.access_token, signingSecret: token.body.signing_secret, installationId: token.body.installation_id, botUserId: token.body.bot_user_id };
}
const asBot = (token: string) => ({ Authorization: `Bearer ${token}` });
const signatureOk = (one: Received, secret: string) => one.headers['x-lilachat-signature'] === `v1=${createHmac('sha256', secret).update(`${one.headers['x-lilachat-timestamp']}.${one.body}`).digest('hex')}`;

describe('installing (§a)', () => {
  it('the consent page sees the app and only the spaces I manage', async () => {
    const consent = await request(app).get(`/api/oauth/app?client_id=lca_lila&redirect_uri=${encodeURIComponent(REDIRECT)}`).set(asJose).expect(200);
    expect(consent.body).toMatchObject({ app: { name: 'Lila' }, spaces: [{ id: String(spaceId), name: 'CONSTROAD' }] });
    expect((await request(app).get(`/api/oauth/app?client_id=lca_lila&redirect_uri=${encodeURIComponent(REDIRECT)}`).set(asAna).expect(200)).body.spaces).toEqual([]);
  });

  it('a redirect the app did not register, letter by letter, is refused and never followed', async () => {
    await request(app).get(`/api/oauth/app?client_id=lca_lila&redirect_uri=${encodeURIComponent(`${REDIRECT}/`)}`).set(asJose).expect(400);
  });

  it('code + PKCE: token, space, bot user and signing secret; the bot is in the public channel, not the private one', async () => {
    const installed = await install();
    expect(installed.token).toMatch(/^lcb_/);
    expect(installed.signingSecret).toMatch(/^lcs_/);
    const bot = await UserModel.findById(installed.botUserId).lean();
    expect(bot).toMatchObject({ name: 'Lila', app: { workspaceId: spaceId } });
    expect((await ChatModel.findById(channel).lean())!.members.map((member) => String(member.userId))).toContain(installed.botUserId);
    expect((await ChatModel.findById(privateChannel).lean())!.members.map((member) => String(member.userId))).not.toContain(installed.botUserId);
    expect(await BotInstallationModel.findOne({ tokenHash: sha256(installed.token) }).lean()).not.toBeNull();
  });

  it('denying sends access_denied back; a member who is not admin cannot approve', async () => {
    const denied = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_lila', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', decision: 'deny' }).expect(200);
    expect(new URL(denied.body.redirect).searchParams.get('error')).toBe('access_denied');
    await request(app).post('/api/oauth/authorize').set(asAna).send({ client_id: 'lca_lila', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(403);
  });

  it('the code works once, only with its verifier and the client secret', async () => {
    const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_lila', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' });
    const code = new URL(authorized.body.redirect).searchParams.get('code');
    const trade = (extra: Record<string, string>) => request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: 'lca_lila', client_secret: SECRET, code_verifier: VERIFIER, ...extra });
    expect((await trade({ client_secret: 'lcx_wrong' })).body.error).toBe('invalid_client');
    expect((await trade({ code_verifier: 'w'.repeat(64) })).body.error).toBe('invalid_grant');
    // The failed verifier burned it: a code is used once, right or wrong.
    expect((await trade({})).body.error).toBe('invalid_grant');
  });

  it('reinstalling replaces the token: the old one stops working', async () => {
    const first = await install();
    const second = await install();
    expect(second.botUserId).toBe(first.botUserId);
    await request(app).get('/api/bots/me').set(asBot(first.token)).expect(401);
    await request(app).get('/api/bots/me').set(asBot(second.token)).expect(200);
  });
});

describe('the bot publishes (§b) and reads (§d)', () => {
  it('a text to a channel, once per idempotency key', async () => {
    const { token, botUserId } = await install();
    const first = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), text: 'Pedido 1024 listo', idempotency_key: 'k1' }).expect(201);
    const again = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), text: 'Pedido 1024 listo', idempotency_key: 'k1' }).expect(200);
    expect(again.body.message).toEqual(first.body.message);
    expect(await MessageModel.find({ chatId: channel }).lean()).toMatchObject([{ senderId: new Types.ObjectId(botUserId), body: 'Pedido 1024 listo' }]);
  });

  it('a 1:1 with a member by phone; someone outside the space is not found', async () => {
    const { token } = await install();
    const sent = await request(app).post('/api/bots/messages').set(asBot(token)).send({ user: { phone: '51987654321' }, text: 'Hola Ana', idempotency_key: 'k2' }).expect(201);
    expect(await ChatModel.findById(sent.body.message.chat_id).lean()).toMatchObject({ kind: 'direct', workspaceId: spaceId });
    expect((await request(app).post('/api/bots/messages').set(asBot(token)).send({ user: { phone: '51976543210' }, text: 'x', idempotency_key: 'k3' }).expect(404)).body.error).toBe('user_not_found');
  });

  it('a private channel without the bot is refused', async () => {
    const { token } = await install();
    expect((await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(privateChannel), text: 'x', idempotency_key: 'k4' }).expect(403)).body.error).toBe('not_in_channel');
  });

  it('an admin takes the app out of a channel and it does not come back on its own; adding it again lets it in (pending 91)', async () => {
    // Arrange: the app posts once, so it is in the channel.
    const { token, botUserId } = await install();
    await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), text: 'Hola', idempotency_key: 'r1' }).expect(201);
    // Act: José (an admin of the channel) takes it out.
    await request(app).delete(`/api/chats/${channel}/members/${botUserId}`).set(asJose).expect(200);
    const refused = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), text: 'Otra vez', idempotency_key: 'r2' }).expect(403);
    // Assert
    expect(refused.body).toMatchObject({ error: 'not_in_channel', message: expect.stringMatching(/sacó/) });
    expect((await ChatModel.findById(channel).lean())!.members.some((member) => String(member.userId) === botUserId)).toBe(false);
    await request(app).post(`/api/chats/${channel}/members`).set(asJose).send({ userId: botUserId }).expect(200);
    await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), text: 'De regreso', idempotency_key: 'r3' }).expect(201);
  });

  it('a card keeps its actions; the bot closes it with PATCH', async () => {
    const { token } = await install();
    const card = { title: '¿Confirmas el pedido 1024?', status: { label: 'Por confirmar', tone: 'warn' }, fields: [{ label: 'm³', value: '12' }], actions: [{ id: 'confirm', label: 'Confirmar', style: 'primary', value: 'p-77' }] };
    const sent = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), card, idempotency_key: 'k5' }).expect(201);
    expect(await MessageModel.findById(sent.body.message.id).lean()).toMatchObject({ body: '¿Confirmas el pedido 1024? · Por confirmar', card: { actions: [{ id: 'confirm', value: 'p-77' }] } });
    await request(app).patch(`/api/bots/messages/${sent.body.message.id}`).set(asBot(token)).send({ card: { title: 'Pedido 1024', status: { label: 'Confirmado por José', tone: 'ok' } } }).expect(200);
    const closed = await MessageModel.findById(sent.body.message.id).lean<Message>();
    expect(closed!.card).toMatchObject({ status: { label: 'Confirmado por José' } });
    expect(closed!.card!.actions).toBeUndefined();
  });

  it('a checklist with its person by phone; someone outside the space is refused', async () => {
    const { token } = await install();
    await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), idempotency_key: 'k6', checklist: { title: 'Despacho 1024', items: [{ text: 'Cargar tolva', assignee_phone: '51987654321' }] } }).expect(201);
    expect(await ChecklistModel.findOne({ chatId: channel }).lean()).toMatchObject({ title: 'Despacho 1024', items: [{ text: 'Cargar tolva', assignee: ana }] });
    const refused = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), idempotency_key: 'k7', checklist: { title: 'Otro', items: [{ text: 'x', assignee_phone: '51976543210' }] } }).expect(400);
    expect(refused.body).toMatchObject({ error: 'assignee_not_member', phone: '51976543210' });
  });

  it('me, the channels with is_member, and the active members with their phone', async () => {
    const { token, installationId } = await install();
    expect((await request(app).get('/api/bots/me').set(asBot(token)).expect(200)).body).toMatchObject({ installation_id: installationId, space: { name: 'CONSTROAD' } });
    expect((await request(app).get('/api/bots/channels').set(asBot(token)).expect(200)).body.channels).toEqual([{ id: String(channel), name: 'planta', visibility: 'public', is_member: true }]);
    expect((await request(app).get('/api/bots/members').set(asBot(token)).expect(200)).body.members).toEqual(expect.arrayContaining([{ id: String(ana), name: 'Ana', phone: '51987654321', role: 'member', title: 'Residente' }]));
  });

  it('a new public channel has the bot in it', async () => {
    const { token, botUserId } = await install();
    const created = await request(app).post(`/api/workspaces/${spaceId}/channels`).set(asJose).send({ name: 'flota', visibility: 'public' }).expect(201);
    expect((await ChatModel.findById(created.body.channel.id).lean())!.members.map((member) => String(member.userId))).toContain(botUserId);
    expect(token).toBeTruthy();
  });
});

describe('the bot hears signed events (§c)', () => {
  it('a tap on its card: button.click, signed per installation, with the person and her phone', async () => {
    const { token, signingSecret, installationId } = await install();
    const sent = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), card: { title: '¿Confirmas?', actions: [{ id: 'confirm', label: 'Confirmar', value: 'p-77' }] }, idempotency_key: 'k8' }).expect(201);
    await request(app).post(`/api/chats/${channel}/card-actions`).set(asAna).send({ seq: sent.body.message.seq, action_id: 'confirm' }).expect(202);
    const event = await eventOf('button.click');
    expect(signatureOk(event, signingSecret)).toBe(true);
    expect(event.headers['x-lilachat-installation']).toBe(installationId);
    expect(JSON.parse(event.body)).toMatchObject({ type: 'button.click', installation_id: installationId, data: { action: { id: 'confirm', value: 'p-77' }, user: { id: String(ana), name: 'Ana', phone: '51987654321' } } });
    expect(JSON.parse(event.body).event_id).toBe(event.headers['x-lilachat-delivery']);
  });

  it('message.created: everything in its 1:1, and in a channel only what names it', async () => {
    const { botUserId } = await install();
    const members = [String(jose), String(ana), botUserId];
    const plain = (await MessageModel.create({ chatId: channel, seq: 1, senderId: ana, clientKey: 'c1', kind: 'text', body: 'sin mención' })).toObject();
    expect(await botsHearMessage(plain, members)).toBe(false);
    const typed = (await MessageModel.create({ chatId: channel, seq: 2, senderId: ana, clientKey: 'c2', kind: 'text', body: '@Lila hazme un pedido de 12 m³' })).toObject();
    expect(await botsHearMessage(typed, members)).toBe(true);
    const event = JSON.parse((await eventOf('message.created')).body);
    expect(event.data).toMatchObject({ channel: { id: String(channel), kind: 'channel', name: 'planta' }, message: { seq: 2, text: '@Lila hazme un pedido de 12 m³', mentions_bot: true }, author: { phone: '51987654321' } });
  });

  it('a task of its checklist: checklist.item.toggled with who marked it', async () => {
    const { token } = await install();
    await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), idempotency_key: 'k9', checklist: { title: 'Despacho', items: [{ text: 'Cargar tolva', assignee_phone: '51987654321' }] } }).expect(201);
    const checklist = await ChecklistModel.findOne({ chatId: channel }).lean();
    await request(app).post(`/api/agenda/checklists/${checklist!._id}/items/${checklist!.items[0]!.id}/toggle`).set(asAna).expect(200);
    const event = JSON.parse((await eventOf('checklist.item.toggled')).body);
    expect(event.data).toMatchObject({ checklist: { title: 'Despacho' }, item: { text: 'Cargar tolva', done: true, assignee_phone: '51987654321' }, user: { id: String(ana) } });
  });

  it('a failed delivery is retried with the same delivery id and body', async () => {
    const { token } = await install();
    failNext = 1;
    const sent = await request(app).post('/api/bots/messages').set(asBot(token)).send({ channel_id: String(channel), card: { title: 'T', actions: [{ id: 'ok', label: 'Ok', value: '1' }] }, idempotency_key: 'k10' }).expect(201);
    await request(app).post(`/api/chats/${channel}/card-actions`).set(asAna).send({ seq: sent.body.message.seq, action_id: 'ok' }).expect(202);
    const both = await waitFor(() => (received.length >= 2 ? received : undefined));
    expect(both[1]!.headers['x-lilachat-delivery']).toBe(both[0]!.headers['x-lilachat-delivery']);
    expect(both[1]!.body).toBe(both[0]!.body);
    await waitUntil(async () => (await BotDeliveryModel.findOne({}).lean())?.status === 'delivered');
    expect(await BotDeliveryModel.findOne({}).lean()).toMatchObject({ status: 'delivered', attempts: 2 });
  });

  it('uninstalling from Integraciones: app.uninstalled, the token dies and the bot leaves the channel', async () => {
    const { token, botUserId } = await install();
    expect((await request(app).get(`/api/workspaces/${spaceId}/apps`).set(asJose).expect(200)).body.apps).toMatchObject([{ name: 'Lila', installedBy: 'José' }]);
    await request(app).get(`/api/workspaces/${spaceId}/apps`).set(asAna).expect(403);
    const installationId = (await BotInstallationModel.findOne({}).lean())!._id;
    await request(app).delete(`/api/workspaces/${spaceId}/apps/${installationId}`).set(asJose).expect(204);
    expect(JSON.parse((await eventOf('app.uninstalled')).body).data).toMatchObject({ by: { id: String(jose), phone: '51902049935' } });
    await request(app).get('/api/bots/me').set(asBot(token)).expect(401);
    expect((await ChatModel.findById(channel).lean())!.members.map((member) => String(member.userId))).not.toContain(botUserId);
  });

  it('the directory offers the apps to install, with where to go and this space, and says which is already in (agentes, 23/10)', async () => {
    await BotAppModel.updateOne({ clientId: 'lca_lila' }, { $set: { installUrl: 'https://agentes.example.com/canales/lilachat/instalar' } });
    const before = (await request(app).get(`/api/workspaces/${spaceId}/available-apps`).set(asJose).expect(200)).body.apps;
    expect(before).toEqual([{ id: expect.any(String), name: 'Lila', installUrl: `https://agentes.example.com/canales/lilachat/instalar?space=${spaceId}&login_hint=902049935`, installed: false }]);
    await request(app).get(`/api/workspaces/${spaceId}/available-apps`).set(asAna).expect(403);
    await install();
    expect((await request(app).get(`/api/workspaces/${spaceId}/available-apps`).set(asJose).expect(200)).body.apps[0]).toMatchObject({ installed: true });
  });

  it('the directory (design e-24): installed first with who and where; the install address only for admins (José, 23/10)', async () => {
    await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: sha256(SECRET), name: 'Portal', redirectUris: [REDIRECT], webhookUrl: hookUrl, installUrl: 'https://agentes.example.com/instalar?app=portal', description: 'Pedidos, despachos y caja', features: ['Crea pedidos'], developer: 'Agentes ConstRoad', category: 'operacion' });
    const { botUserId } = await install();
    const lila = await BotAppModel.findOne({ clientId: 'lca_lila' }).lean();
    const asMember = (await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asAna).expect(200)).body;
    expect(asMember.canInstall).toBe(false);
    expect(asMember.apps.map((one: { name: string }) => one.name)).toEqual(['Lila', 'Portal']);
    expect(asMember.apps[0]).toEqual({ appId: String(lila!._id), clientId: 'lca_lila', name: 'Lila', features: [], commands: [], installation: { installationId: expect.any(String), botUserId, installedBy: 'José', installedAt: expect.any(String), channels: 1, directs: 0 } });
    expect(asMember.apps[1]).toEqual({ appId: expect.any(String), clientId: expect.any(String), name: 'Portal', description: 'Pedidos, despachos y caja', features: ['Crea pedidos'], developer: 'Agentes ConstRoad', category: 'operacion', commands: [] });
    const asOwner = (await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asJose).expect(200)).body;
    expect(asOwner.apps[1].installUrl).toBe(`https://agentes.example.com/instalar?app=portal&space=${spaceId}&login_hint=902049935`);
    await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asUser(() => beto)).expect(404);
    // An installed app can be installed again by an admin (agentes, 23/10: like Slack's «Reinstall»).
    await BotAppModel.updateOne({ clientId: 'lca_lila' }, { $set: { installUrl: 'https://agentes.example.com/instalar?app=lila' } });
    const again = (await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asJose).expect(200)).body.apps[0];
    expect(again).toMatchObject({ name: 'Lila', installUrl: expect.stringContaining('app=lila'), installation: expect.any(Object) });
    expect((await request(app).get(`/api/workspaces/${spaceId}/app-directory`).set(asAna).expect(200)).body.apps[0]).not.toHaveProperty('installUrl');
  });

  it('opening an app from «Apps» gives the same 1:1 with its bot every time; an app not installed is 404', async () => {
    const { botUserId } = await install();
    const lila = await BotAppModel.findOne({ clientId: 'lca_lila' }).lean();
    const first = (await request(app).post(`/api/workspaces/${spaceId}/apps/${lila!._id}/chat`).set(asAna).expect(200)).body;
    const again = (await request(app).post(`/api/workspaces/${spaceId}/apps/${lila!._id}/chat`).set(asAna).expect(200)).body;
    expect(again).toEqual(first);
    expect(first.botUserId).toBe(botUserId);
    const chat = await ChatModel.findById(first.chatId).lean();
    expect(chat).toMatchObject({ kind: 'direct', workspaceId: spaceId });
    expect(chat!.members.map((member) => String(member.userId)).sort()).toEqual([String(ana), botUserId].sort());
    await request(app).post(`/api/workspaces/${spaceId}/apps/${new Types.ObjectId()}/chat`).set(asAna).expect(404);
    await request(app).post(`/api/workspaces/${spaceId}/apps/${lila!._id}/chat`).set(asUser(() => beto)).expect(404);
  });

  it('revoking from agentes: the token dies, no event', async () => {
    const { token } = await install();
    await request(app).post('/api/oauth/revoke').set(asBot(token)).expect(200);
    await request(app).get('/api/bots/me').set(asBot(token)).expect(401);
    expect(received).toEqual([]);
  });
});
