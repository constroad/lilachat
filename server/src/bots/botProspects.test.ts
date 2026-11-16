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
import { ProspectChannelModel } from './botProspects.js';
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

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_prospects'));
  configureDevelopers(['lca_dev_lila']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel, ProspectChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, outsider] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }, { phone: '51911111111', name: 'Otro' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
  ]);
  await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: 'http://127.0.0.1:9/events' });
});

async function installApp(key = 'dali', scopes: string[] = ['prospects:write', 'channels:history']): Promise<string> {
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key, name: 'Dali', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:9/events', scopes }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  return token.body.access_token;
}
const PROSPECT = 'dali:constroad:9f2c41';
const putProspect = (token: string, body: unknown, prospectId = PROSPECT) => request(app).put(`/api/bots/prospects/${encodeURIComponent(prospectId)}`).set(asBot(token)).send(body as object);
const post = (token: string, body: Record<string, unknown>) => request(app).post('/api/bots/messages').set(asBot(token)).send(body);
const now = () => new Date().toISOString();

/** Dali's prospects (BOTS-API §c-prospectos, José via agentes 16/11): a channel per prospect of a paid ad. */
describe('PUT /api/bots/prospects/:id', () => {
  it('creates a private channel with the bot and EVERY active member, named after the number', async () => {
    const token = await installApp();
    const created = await putProspect(token, { phone: '+51 949 123 824', last_activity_at: now(), source: { kind: 'ctwa', ad_title: 'Asfalto en caliente' } }).expect(201);
    expect(created.body.prospect).toMatchObject({ id: PROSPECT, attended_by: 'dali', channel: { name: 'Prospecto · +51 949 123 824' } });
    const chat = await ChatModel.findById(created.body.prospect.channel.id).lean();
    expect(chat).toMatchObject({ kind: 'group', channel: { visibility: 'private' }, prospectId: PROSPECT });
    const memberIds = chat!.members.map((member) => String(member.userId));
    expect(memberIds).toHaveLength(3);
    expect(memberIds).toEqual(expect.arrayContaining([String(jose), String(ana)]));
    expect(chat!.members.map((member) => String(member.userId))).not.toContain(String(outsider));
  });

  it('a later PUT renames the channel, keeps who attends and adds a member who joined since (200)', async () => {
    const token = await installApp();
    const created = await putProspect(token, { phone: '51949123824', last_activity_at: now() }).expect(201);
    await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: outsider, phone: '51911111111', role: 'member', status: 'active' });
    const again = await putProspect(token, { name: 'Carlos', phone: '51949123824', last_activity_at: now(), attended_by: 'human' }).expect(200);
    expect(again.body.prospect).toMatchObject({ attended_by: 'human', channel: { id: created.body.prospect.channel.id, name: 'Carlos' } });
    const chat = await ChatModel.findById(created.body.prospect.channel.id).lean();
    expect(chat!.name).toBe('Carlos');
    expect(chat!.members.map((member) => String(member.userId))).toContain(String(outsider));
  });

  it('refuses a bad id or body (400) and an app without prospects:write (403)', async () => {
    const token = await installApp();
    expect((await putProspect(token, { phone: '51949123824', last_activity_at: now() }, 'bad id').expect(400)).body.error).toBe('invalid_request');
    expect((await putProspect(token, { phone: '12', last_activity_at: now() }).expect(400)).body.message).toContain('phone');
    const other = await installApp('portal', []);
    expect((await putProspect(other, { phone: '51949123824', last_activity_at: now() }).expect(403)).body.error).toBe('missing_scope');
  });
});

describe('POST /api/bots/messages to a prospect', () => {
  it('as_contact stores the prospect as the author, with the hour they sent it and the ad', async () => {
    const token = await installApp();
    await putProspect(token, { name: 'Carlos', phone: '51949123824', last_activity_at: now(), source: { kind: 'ctwa', ad_title: 'Asfalto en caliente' } }).expect(201);
    const sentAt = '2026-11-17T14:02:00.000Z';
    const heard = await post(token, { prospect: PROSPECT, as_contact: true, sent_at: sentAt, text: 'Cuánto cuesta el m³?', idempotency_key: 'wamid.1' }).expect(201);
    const message = await MessageModel.findById(heard.body.message.id).lean();
    expect(message).toMatchObject({ body: 'Cuánto cuesta el m³?', prospect: { name: 'Carlos', phone: '51949123824', sentAt, adTitle: 'Asfalto en caliente' } });
    expect((await post(token, { prospect: PROSPECT, as_contact: true, text: 'otra vez', idempotency_key: 'wamid.1' }).expect(200)).body.message.id).toBe(heard.body.message.id);
  });

  it('without as_contact it is Dali speaking; an unknown prospect is 404', async () => {
    const token = await installApp();
    await putProspect(token, { phone: '51949123824', last_activity_at: now() }).expect(201);
    const said = await post(token, { prospect: PROSPECT, text: 'Hola, soy Dali', idempotency_key: 'dali-1' }).expect(201);
    expect((await MessageModel.findById(said.body.message.id).lean())!.prospect).toBeUndefined();
    expect((await post(token, { prospect: 'dali:constroad:otro', text: 'x', idempotency_key: 'k' }).expect(404)).body.error).toBe('prospect_not_found');
  });

  it('a prospect of another app is not found', async () => {
    const dali = await installApp();
    await putProspect(dali, { phone: '51949123824', last_activity_at: now() }).expect(201);
    const other = await installApp('otra', ['prospects:write']);
    expect((await post(other, { prospect: PROSPECT, text: 'x', idempotency_key: 'k' }).expect(404)).body.error).toBe('prospect_not_found');
  });
});
