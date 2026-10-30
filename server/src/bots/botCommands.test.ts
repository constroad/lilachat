import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import type { CommandNotice } from '@lilachat/shared';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotCommandRunModel, BotDeliveryModel, BotInstallationModel, OAuthCodeModel } from './botModels.js';
import { configureCommands } from './botCommands.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';
import { openEveryItem } from './testItems.js';

/** Slash commands end to end (`specs/BOTS-API.spec.md` §c-bis): register, invoke, answer now or later. */
let mongo: MongoMemoryServer;
const app = buildApp({});
const REDIRECT = 'https://agentes.example.com/canales/lilachat/vuelta';
const SECRET = 'lcx_test-client-secret';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const ANSWER_TIMEOUT_MS = 300;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let channel: Types.ObjectId;
let humansDirect: Types.ObjectId;
const asUser = (userId: () => Types.ObjectId) => ({ get Authorization() { return `Bearer ${signSession({ userId: String(userId()), deviceId: `d-${userId()}`, email: 'x' })}`; } });
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const asBot = (token: string) => ({ Authorization: `Bearer ${token}` });

// The app's webhook: answers with whatever the test sets, and records what arrives.
type Received = { headers: IncomingMessage['headers']; body: string };
const received: Received[] = [];
let answer: (res: ServerResponse) => void = (res) => res.end();
let hook: Server;
let hookUrl = '';
const notices: { userId: string; notice: CommandNotice }[] = [];
const waitUntil = async (done: () => Promise<boolean>, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!(await done())) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
const json = (status: number, body: unknown) => (res: ServerResponse) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_commands'));
  hook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      answer(res);
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, '127.0.0.1', resolve));
  hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/v1/channels/lilachat/events`;
  configureCommands({ answerTimeoutMs: ANSWER_TIMEOUT_MS, notify: (userId, notice) => notices.push({ userId, notice }) });
});
afterAll(async () => {
  hook.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  received.length = 0;
  notices.length = 0;
  answer = (res) => res.end();
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, BotDeliveryModel, BotCommandRunModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '987654321', role: 'member', status: 'active' },
  ]);
  channel = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  humansDirect = (await ChatModel.create({ kind: 'direct', workspaceId: spaceId, members: [{ userId: jose, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  await BotAppModel.create({ clientId: 'lca_inframaq', clientSecretHash: sha256(SECRET), name: 'Inframaq', redirectUris: [REDIRECT], webhookUrl: hookUrl });
});

async function install(): Promise<{ token: string; signingSecret: string; appId: string }> {
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_inframaq', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const code = new URL(authorized.body.redirect).searchParams.get('code');
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: 'lca_inframaq', client_secret: SECRET, code_verifier: VERIFIER }).expect(200);
  const appId = String((await BotAppModel.findOne({ clientId: 'lca_inframaq' }).lean())!._id);
  return { token: token.body.access_token, signingSecret: token.body.signing_secret, appId };
}

async function installWithCommands() {
  const installed = await install();
  await request(app).put('/api/bots/commands').set(asBot(installed.token)).send({ commands: [{ command: 'clima', description: 'Clima de hoy en la planta', usage_hint: '[distrito]' }] }).expect(200);
  await openEveryItem();
  return installed;
}

// Not about permissions (`botItemAccess.test.ts`): what the app registered is on, as an admin would leave it.
const invoke = (chatId: Types.ObjectId, body: Record<string, unknown>, as = asAna) => ({
  expect: (status: number) => openEveryItem().then(() => request(app).post(`/api/chats/${chatId}/commands`).set(as).send(body).expect(status)),
});

describe('registering commands', () => {
  it('replaces the whole list and reads it back in the wire shape', async () => {
    const { token } = await install();
    const put = await request(app).put('/api/bots/commands').set(asBot(token)).send({ commands: [{ command: 'clima', description: 'Clima', usage_hint: '[distrito]' }, { command: 'tanques', description: 'Nivel' }] }).expect(200);
    expect(put.body.commands).toEqual([{ command: 'clima', description: 'Clima', usage_hint: '[distrito]' }, { command: 'tanques', description: 'Nivel' }]);
    await request(app).put('/api/bots/commands').set(asBot(token)).send({ commands: [{ command: 'tanques', description: 'Nivel' }] }).expect(200);
    expect((await request(app).get('/api/bots/commands').set(asBot(token)).expect(200)).body.commands).toEqual([{ command: 'tanques', description: 'Nivel' }]);
  });

  it('a bad list is refused with the contract error, and without a token nothing is registered', async () => {
    const { token } = await install();
    const bad = await request(app).put('/api/bots/commands').set(asBot(token)).send({ commands: [{ command: '/Clima', description: 'x' }] }).expect(400);
    expect(bad.body.error).toBe('invalid_request');
    await request(app).put('/api/bots/commands').send({ commands: [] }).expect(401);
  });

  it('a member sees the space apps with commands; someone outside the space sees nothing', async () => {
    const { appId } = await installWithCommands();
    const groups = await request(app).get(`/api/workspaces/${spaceId}/commands`).set(asAna).expect(200);
    expect(groups.body.groups).toEqual([{ appId, appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima de hoy en la planta', usageHint: '[distrito]' }], shortcuts: [] }]);
    const stranger = (await UserModel.create({ phone: '911111111', name: 'Otro' }))._id;
    await request(app).get(`/api/workspaces/${spaceId}/commands`).set(asUser(() => stranger)).expect(404);
  });

  it('an uninstalled app takes its commands with it', async () => {
    await installWithCommands();
    await BotInstallationModel.updateMany({}, { $set: { revokedAt: new Date() } });
    expect((await request(app).get(`/api/workspaces/${spaceId}/commands`).set(asAna).expect(200)).body.groups).toEqual([]);
  });
});

describe('invoking', () => {
  it('the app hears command.invoked signed, with the text and who asked; an ephemeral answer is not stored', async () => {
    const { appId, signingSecret } = await installWithCommands();
    answer = json(200, { text: 'Lurín: 24 °C, sin lluvia' });
    const outcome = await invoke(channel, { app_id: appId, command: 'clima', text: ' lurin ' }).expect(200);
    expect(outcome.body).toMatchObject({ appId, appName: 'Inframaq', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Lurín: 24 °C, sin lluvia' } });
    const event = received[0]!;
    expect(event.headers['x-lilachat-event']).toBe('command.invoked');
    expect(event.headers['x-lilachat-signature']).toBe(`v1=${createHmac('sha256', signingSecret).update(`${event.headers['x-lilachat-timestamp']}.${event.body}`).digest('hex')}`);
    const { data } = JSON.parse(event.body);
    expect(data).toMatchObject({ command_id: outcome.body.commandId, command: 'clima', text: 'lurin', channel: { id: String(channel), kind: 'channel', name: 'planta' }, user: { id: String(ana), name: 'Ana', phone: '51987654321' } });
    expect(await MessageModel.countDocuments({ chatId: channel })).toBe(0);
  });

  it('in_channel posts as the app in the channel', async () => {
    const { appId } = await installWithCommands();
    answer = json(200, { response_type: 'in_channel', card: { title: 'Clima de hoy', status: { label: 'Sin lluvia', tone: 'ok' } } });
    expect((await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.outcome).toBe('posted');
    const posted = await MessageModel.findOne({ chatId: channel }).lean();
    expect(posted?.card?.title).toBe('Clima de hoy');
  });

  it('in_channel in a 1:1 between people only reaches the asker', async () => {
    const { appId } = await installWithCommands();
    answer = json(200, { response_type: 'in_channel', text: 'Lurín: 24 °C' });
    expect((await invoke(humansDirect, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.outcome).toBe('ephemeral');
    expect(await MessageModel.countDocuments({ chatId: humansDirect })).toBe(0);
  });

  it('a broken app says so to the asker; an unknown command, a chat that is not mine or outside a space is 404', async () => {
    const { appId } = await installWithCommands();
    answer = json(500, { oops: true });
    const broken = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    expect(broken).toMatchObject({ outcome: 'failed', message: 'Inframaq no pudo responder.' });
    // The health is written without awaiting: wait for this one before the next, or they land in any order.
    await waitUntil(async () => (await BotInstallationModel.findOne({}).lean())?.lastDelivery?.error === 'HTTP 500');
    // The run keeps WHY, also after another delivery overwrites the installation's health (23/10).
    await waitUntil(async () => (await BotCommandRunModel.findById(broken.commandId).lean())?.failure?.error === 'HTTP 500');
    answer = json(200, { card: { title: 'Tanques', blocks: [{ type: 'tank', items: [{ label: 'sin nombre', level: 0.5 }] }] } });
    expect((await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.outcome).toBe('failed');
    await waitUntil(async () => Boolean((await BotInstallationModel.findOne({}).lean())?.lastDelivery?.error?.includes('inválida')));
    await invoke(channel, { app_id: appId, command: 'tanques', text: '' }).expect(404);
    const outsider = (await UserModel.create({ phone: '911111111', name: 'Otro' }))._id;
    await invoke(channel, { app_id: appId, command: 'clima', text: '' }, asUser(() => outsider)).expect(404);
    const outsideSpace = (await ChatModel.create({ kind: 'direct', members: [{ userId: jose, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await invoke(outsideSpace, { app_id: appId, command: 'clima', text: '' }).expect(404);
  });
});

describe('an app restarting in a deploy (agentes, 23/10: a 502 while it came back up)', () => {
  it('a 502 is tried once more with the same delivery, and the second answer counts', async () => {
    // Arrange: the first call finds the proxy without the app; the second, the app.
    const { appId } = await installWithCommands();
    let calls = 0;
    answer = (res) => (++calls === 1 ? json(502, { error: 'bad gateway' })(res) : json(200, { text: 'Lurín: 24 °C' })(res));
    // Act
    const outcome = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    // Assert
    expect(outcome).toMatchObject({ outcome: 'ephemeral', response: { text: 'Lurín: 24 °C' } });
    expect(received).toHaveLength(2);
    expect(received[1]!.headers['x-lilachat-delivery']).toBe(received[0]!.headers['x-lilachat-delivery']);
  });

  it('still down after the second try: «se está actualizando», not «no pudo responder»; a 500 is a broken app', async () => {
    const { appId } = await installWithCommands();
    answer = json(503, {});
    expect((await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body).toMatchObject({ outcome: 'failed', message: 'Inframaq se está actualizando: vuelve a intentarlo en unos segundos.' });
    expect(received).toHaveLength(2);
    received.length = 0;
    answer = json(500, {});
    expect((await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.message).toBe('Inframaq no pudo responder.');
    expect(received).toHaveLength(1);
  });

  it('a 502/503 with a `code` is the app answering, not a restart: one try, «no pudo responder» (agentes, 30/10)', async () => {
    // Arrange: agentes says it has no reader; a retry would come back 200 {ok:true} as a duplicate.
    const { appId } = await installWithCommands();
    answer = json(503, { error: 'Sin lector de Drive', code: 'not-configured' });
    // Act
    const outcome = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    // Assert
    expect(outcome.message).toBe('Inframaq no pudo responder.');
    expect(received).toHaveLength(1);
  });
});

describe('answering later', () => {
  it('an empty 200 or a slow app leaves it pending; /respond reaches only the asker', async () => {
    const { appId, token } = await installWithCommands();
    const pending = await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200);
    expect(pending.body.outcome).toBe('pending');
    answer = (res) => setTimeout(() => res.end(), ANSWER_TIMEOUT_MS * 3);
    expect((await invoke(channel, { app_id: appId, command: 'clima', text: '' }, asJose).expect(200)).body.outcome).toBe('pending');
    const reply = await request(app).post(`/api/bots/commands/${pending.body.commandId}/respond`).set(asBot(token)).send({ text: 'Ya está: 24 °C' }).expect(200);
    expect(reply.body).toEqual({ response_type: 'ephemeral' });
    expect(notices).toEqual([{ userId: String(ana), notice: { chatId: String(channel), commandId: pending.body.commandId, appId, appName: 'Inframaq', response: { responseType: 'ephemeral', text: 'Ya está: 24 °C' } } }]);
  });

  it('a late in_channel answer posts; five answers at most; after 15 minutes it is gone; another app cannot answer', async () => {
    const { appId, token } = await installWithCommands();
    const { commandId } = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    const respond = (body: Record<string, unknown>, bearer = token) => request(app).post(`/api/bots/commands/${commandId}/respond`).set(asBot(bearer)).send(body);
    expect((await respond({ response_type: 'in_channel', text: 'Clima de hoy: 24 °C' }).expect(200)).body).toEqual({ response_type: 'in_channel' });
    // The asker's «working…» card is told to go away (José, 23/10: it stayed frozen).
    expect(notices.some((one) => one.notice.commandId === commandId && one.notice.posted === true)).toBe(true);
    expect(await MessageModel.countDocuments({ chatId: channel })).toBe(1);
    for (let index = 0; index < 4; index++) await respond({ text: `vez ${index}` }).expect(200);
    expect((await respond({ text: 'una más' }).expect(409)).body.error).toBe('too_many_responses');
    await respond({}).expect(400);
    await BotCommandRunModel.updateOne({ _id: commandId }, { $set: { expiresAt: new Date(Date.now() - 1000), responses: 0 } });
    expect((await respond({ text: 'tarde' }).expect(410)).body.error).toBe('command_expired');
    await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: sha256(SECRET), name: 'Portal', redirectUris: [REDIRECT], webhookUrl: hookUrl });
    const other = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: 'lca_portal', redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
    const otherToken = (await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(other.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: 'lca_portal', client_secret: SECRET, code_verifier: VERIFIER }).expect(200)).body.access_token;
    expect((await respond({ text: 'no es mío' }, otherToken).expect(404)).body.error).toBe('command_not_found');
  });
});

describe('sharing an answer only I saw (José, 23/10: «no hay opción de enviar al canal»)', () => {
  const share = (chatId: Types.ObjectId, commandId: string, as = asAna) => request(app).post(`/api/chats/${chatId}/commands/${commandId}/share`).set(as).send({});

  it('the app posts it in the channel, saying who shared it; a second tap does not post it twice', async () => {
    // Arrange
    const { appId } = await installWithCommands();
    answer = json(200, { text: 'Lurín: 24 °C, sin lluvia' });
    const { commandId } = (await invoke(channel, { app_id: appId, command: 'clima', text: 'lurin' }).expect(200)).body;
    // Act
    const first = await share(channel, commandId).expect(200);
    const again = await share(channel, commandId).expect(200);
    // Assert
    expect(again.body.seq).toBe(first.body.seq);
    const posted = await MessageModel.find({ chatId: channel }).lean();
    expect(posted).toHaveLength(1);
    expect(posted[0]!.body).toBe('Lurín: 24 °C, sin lluvia');
    expect(posted[0]!.sharedBy).toMatchObject({ name: 'Ana', command: 'clima' });
    expect(String(posted[0]!.senderId)).not.toBe(String(ana));
  });

  it('a card goes as it came, with the line of who shared it; a late answer can be shared too', async () => {
    const { appId, token } = await installWithCommands();
    answer = (res) => res.end();
    const { commandId } = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    await request(app).post(`/api/bots/commands/${commandId}/respond`).set(asBot(token)).send({ card: { title: 'Clima de mañana', status: { label: 'Lluvia', tone: 'warn' } } }).expect(200);
    await share(channel, commandId).expect(200);
    const posted = await MessageModel.findOne({ chatId: channel }).lean();
    expect(posted?.card?.title).toBe('Clima de mañana');
    expect(posted?.sharedBy).toMatchObject({ name: 'Ana', command: 'clima' });
  });

  it('only who asked, only in a channel or group, only within the 15 minutes, and only with an answer', async () => {
    const { appId } = await installWithCommands();
    answer = json(200, { text: 'Lurín: 24 °C' });
    const { commandId } = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body;
    await share(channel, commandId, asJose).expect(404);
    const inDirect = (await invoke(humansDirect, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.commandId;
    expect((await share(humansDirect, inDirect).expect(409)).body.message).toMatch(/canal/);
    answer = (res) => res.end();
    const pending = (await invoke(channel, { app_id: appId, command: 'clima', text: '' }).expect(200)).body.commandId;
    await share(channel, pending).expect(409);
    await BotCommandRunModel.updateOne({ _id: commandId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await share(channel, commandId).expect(410);
    expect(await MessageModel.countDocuments({ chatId: channel })).toBe(0);
  });
});
