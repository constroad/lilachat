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
import { WhatsappChannelModel } from './botWhatsapp.js';
import { configureDevelopers } from './botApps.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';
import { configureChannelNotices } from '../workspaceNotices.js';

/** WhatsApp groups mirrored into Dali's Chats tab (fase 1, agentes 20/11): no fixed author, visible to the whole space. */
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
let spaceId: Types.ObjectId;
const asJose = asUser(() => jose);

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_whatsapp'));
  configureDevelopers(['lca_dev_lila']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, WhatsappChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
  ]);
  await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: 'http://127.0.0.1:9/events' });
});

async function installApp(key = 'dali'): Promise<string> {
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key, name: 'Dali', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:9/events' }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  return token.body.access_token;
}
const GROUP = '120363012345678901@g.us';
const putWhatsapp = (token: string, body: unknown, waId = GROUP) => request(app).put(`/api/bots/whatsapp/${encodeURIComponent(waId)}`).set(asBot(token)).send(body as object);
const post = (token: string, body: Record<string, unknown>) => request(app).post('/api/bots/messages').set(asBot(token)).send(body);

describe('PUT /api/bots/whatsapp/:waId', () => {
  it('creates a private channel with the bot and EVERY active member of the space (José: visible a todo el espacio)', async () => {
    const token = await installApp();
    const created = await putWhatsapp(token, { title: 'Obra Lomas', is_group: true }).expect(201);
    expect(created.body.whatsapp).toMatchObject({ whatsapp_id: GROUP, channel: { name: 'Obra Lomas' } });
    const chat = await ChatModel.findById(created.body.whatsapp.channel.id).lean();
    expect(chat).toMatchObject({ kind: 'group', channel: { visibility: 'private' }, whatsappId: GROUP });
    const memberIds = chat!.members.map((member) => String(member.userId));
    expect(memberIds).toEqual(expect.arrayContaining([String(jose), String(ana)]));
    // GET /api/chats marks it `whatsapp: true` (fase 1): Dali's Chats tab sections it apart, without a second fetch.
    const listed = await request(app).get(`/api/chats?workspace=${spaceId}`).set(asJose).expect(200);
    expect(listed.body.chats.find((one: { id: string }) => one.id === created.body.whatsapp.channel.id)).toMatchObject({ whatsapp: true });
  });

  it('a later PUT with a new title renames the channel and does nothing else (200)', async () => {
    const token = await installApp();
    const created = await putWhatsapp(token, { title: 'Obra Lomas' }).expect(201);
    const again = await putWhatsapp(token, { title: 'Obra Lomas - Fase 2' }).expect(200);
    expect(again.body.whatsapp.channel.id).toBe(created.body.whatsapp.channel.id);
    expect((await ChatModel.findById(created.body.whatsapp.channel.id).lean())!.name).toBe('Obra Lomas - Fase 2');
    expect(await ChatModel.countDocuments({ whatsappId: GROUP })).toBe(1);
  });

  it('a member who joined the space after the channel was born enters with the next PUT', async () => {
    const token = await installApp();
    const created = await putWhatsapp(token, { title: 'Obra Lomas' }).expect(201);
    const later = (await UserModel.create({ phone: '51911111111', name: 'Luis' }))._id;
    await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: later, phone: '51911111111', role: 'member', status: 'active' });
    await putWhatsapp(token, { title: 'Obra Lomas' }).expect(200);
    const chat = await ChatModel.findById(created.body.whatsapp.channel.id).lean();
    expect(chat!.members.map((member) => String(member.userId))).toContain(String(later));
  });

  it('tells the admin so the new channel shows without reloading', async () => {
    const token = await installApp();
    const told: [string, string][] = [];
    configureChannelNotices((userId, chatId) => told.push([userId, chatId]));
    const created = await putWhatsapp(token, { title: 'Obra Lomas' }).expect(201);
    configureChannelNotices(() => undefined);
    expect(told.map(([userId]) => userId)).toContain(String(jose));
    expect(told.map(([, chatId]) => chatId)).toContain(created.body.whatsapp.channel.id);
  });

  it('refuses a bad jid or a missing title with 400', async () => {
    const token = await installApp();
    expect((await putWhatsapp(token, { title: 'x' }, 'no-es-un-jid').expect(400)).body.error).toBe('invalid_request');
    expect((await putWhatsapp(token, { title: '' }).expect(400)).body.error).toBe('invalid_request');
  });
});

describe('POST /api/bots/messages to a WhatsApp group', () => {
  it('as_contact stores who wrote THIS message (no fixed identity on the channel)', async () => {
    const token = await installApp();
    await putWhatsapp(token, { title: 'Obra Lomas' }).expect(201);
    const sent1 = await post(token, { whatsapp: GROUP, as_contact: { name: 'Juan Pérez', phone: '51987654321' }, text: 'Buenos días', idempotency_key: 'wamid.1' }).expect(201);
    const sent2 = await post(token, { whatsapp: GROUP, as_contact: { name: 'Ana López' }, text: 'Hola a todos', idempotency_key: 'wamid.2' }).expect(201);
    const first = await MessageModel.findById(sent1.body.message.id).lean();
    const second = await MessageModel.findById(sent2.body.message.id).lean();
    expect(first).toMatchObject({ body: 'Buenos días', prospect: { name: 'Juan Pérez', phone: '51987654321' } });
    expect(second).toMatchObject({ body: 'Hola a todos', prospect: { name: 'Ana López' } });
    expect(second!.prospect).not.toHaveProperty('phone');
  });

  it('without as_contact the message has no author override; a group never sent is 404', async () => {
    const token = await installApp();
    await putWhatsapp(token, { title: 'Obra Lomas' }).expect(201);
    const said = await post(token, { whatsapp: GROUP, text: 'Aviso del sistema', idempotency_key: 'k1' }).expect(201);
    expect((await MessageModel.findById(said.body.message.id).lean())!.prospect).toBeUndefined();
    expect((await post(token, { whatsapp: '0000@g.us', text: 'x', idempotency_key: 'k2' }).expect(404)).body.error).toBe('whatsapp_not_found');
  });

  it('a WhatsApp channel of another app is not found', async () => {
    const dali = await installApp();
    await putWhatsapp(dali, { title: 'Obra Lomas' }).expect(201);
    const other = await installApp('otra');
    expect((await post(other, { whatsapp: GROUP, text: 'x', idempotency_key: 'k' }).expect(404)).body.error).toBe('whatsapp_not_found');
  });
});
