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
import { configureDevelopers } from './botApps.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';

/** «¿Dónde llega cada aviso?» (R160, design e-31; `specs/BOTS-API.spec.md` §c-quater). */
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
let general: Types.ObjectId;
let planta: Types.ObjectId;
let gerencia: Types.ObjectId;
const asJose = asUser(() => jose);
const asAna = asUser(() => ana);
const TOPICS = [
  { key: 'asistencia', name: 'Asistencia', description: 'Ingresos, refrigerio y salida', icon: 'attendance' },
  { key: 'caja', name: 'Caja', icon: 'cash' },
];

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_bot_topics'));
  configureDevelopers(['lca_dev_lila']);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetBots();
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, OAuthCodeModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'INFRAMAQ', ownerId: jose, joinCode: 'INFR-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
  ]);
  const admin = { userId: jose, role: 'admin' as const };
  const members = [admin, { userId: ana, role: 'member' as const }];
  [general, planta, gerencia] = (await ChatModel.create([
    { kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members, lastSeq: 0 },
    { kind: 'group', name: 'planta', workspaceId: spaceId, channel: { visibility: 'public' }, members, lastSeq: 0 },
    { kind: 'group', name: 'gerencia', workspaceId: spaceId, channel: { visibility: 'private' }, members: [admin], lastSeq: 0 },
  ])).map((chat) => chat._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  await BotAppModel.create({ clientId: 'lca_dev_lila', clientSecretHash: sha256('lcx_dev_secret'), name: 'Lila', redirectUris: [REDIRECT], webhookUrl: 'http://127.0.0.1:9/events' });
});

/** Inframaq through its manifest, installed in the space; its token and id. */
async function installInframaq(topics: readonly Record<string, unknown>[] = TOPICS): Promise<{ token: string; appId: string }> {
  const { body } = await request(app).post('/api/bots/apps').set(asLila).send({ key: 'inframaq', name: 'Inframaq', redirect_uri: REDIRECT, webhook_url: 'http://127.0.0.1:9/events', notice_topics: topics }).expect(201);
  const authorized = await request(app).post('/api/oauth/authorize').set(asJose).send({ client_id: body.client_id, redirect_uri: REDIRECT, state: 'state-0123456789abcdef', code_challenge: CHALLENGE, code_challenge_method: 'S256', space_id: String(spaceId), decision: 'approve' }).expect(200);
  const token = await request(app).post('/api/oauth/token').send({ grant_type: 'authorization_code', code: new URL(authorized.body.redirect).searchParams.get('code'), redirect_uri: REDIRECT, client_id: body.client_id, client_secret: body.client_secret, code_verifier: VERIFIER }).expect(200);
  return { token: token.body.access_token, appId: String((await BotAppModel.findOne({ clientId: body.client_id }).lean())!._id) };
}
const topicsPath = (appId: string) => `/api/workspaces/${spaceId}/apps/${appId}/topics`;
const post = (token: string, body: Record<string, unknown>) => request(app).post('/api/bots/messages').set(asBot(token)).send(body);

describe('where each topic lands', () => {
  it('a topic never touched goes to #general, so nothing changes until the admin says so', async () => {
    // Arrange
    const { token, appId } = await installInframaq();
    // Act
    const forBot = await request(app).get('/api/bots/topics').set(asBot(token)).expect(200);
    const forAna = await request(app).get(topicsPath(appId)).set(asAna).expect(200);
    // Assert
    expect(forBot.body.topics).toEqual([{ key: 'asistencia', name: 'Asistencia', channel: { id: String(general), name: 'general' } }, { key: 'caja', name: 'Caja', channel: { id: String(general), name: 'general' } }]);
    expect(forAna.body).toMatchObject({ canEdit: false, topics: [{ key: 'asistencia', icon: 'attendance', description: 'Ingresos, refrigerio y salida' }, { key: 'caja', icon: 'cash' }] });
    expect(forAna.body.channels.map((one: { name: string }) => one.name)).toEqual(['general', 'planta', 'gerencia']);
  });

  it('the admin picks a channel or «Sin canal»; a member cannot; the app posts by topic and lands there', async () => {
    // Arrange
    const { token, appId } = await installInframaq();
    await request(app).put(topicsPath(appId)).set(asAna).send({ channels: { asistencia: String(planta) } }).expect(403);
    // Act
    const saved = await request(app).put(topicsPath(appId)).set(asJose).send({ channels: { asistencia: String(planta), caja: null } }).expect(200);
    const posted = await post(token, { topic: 'asistencia', text: 'Ingreso: Ana Torres · 07:12', idempotency_key: 'a1' }).expect(201);
    const silenced = await post(token, { topic: 'caja', text: 'S/ 120', idempotency_key: 'c1' }).expect(409);
    // Assert
    expect(saved.body.topics.map((topic: { channel: unknown }) => topic.channel)).toEqual([{ id: String(planta), name: 'planta' }, null]);
    expect(posted.body.message.chat_id).toBe(String(planta));
    expect(silenced.body.error).toBe('topic_without_channel');
    await post(token, { topic: 'planilla', text: 'x', idempotency_key: 'p1' }).expect(404);
  });

  it('a topic declared with `default: null` waits in «Sin canal»: nothing is posted until an admin picks', async () => {
    // Arrange
    const { token, appId } = await installInframaq([...TOPICS, { key: 'planilla', name: 'Planilla', icon: 'cash', default: null }]);
    // Act
    const waiting = await post(token, { topic: 'planilla', text: 'S/ 4 820', idempotency_key: 'p1' }).expect(409);
    const forJose = (await request(app).get(topicsPath(appId)).set(asJose).expect(200)).body;
    await request(app).put(topicsPath(appId)).set(asJose).send({ channels: { planilla: String(gerencia) } }).expect(200);
    const posted = await post(token, { topic: 'planilla', text: 'S/ 4 820', idempotency_key: 'p2' }).expect(201);
    // Assert
    expect(waiting.body).toMatchObject({ error: 'topic_without_channel', message: expect.stringMatching(/canal privado/) });
    expect(forJose.topics[2]).toMatchObject({ key: 'planilla', noDefault: true, channel: null });
    expect(forJose.topics[0].channel).toEqual({ id: String(general), name: 'general' });
    expect(posted.body.message.chat_id).toBe(String(gerencia));
    expect(await MessageModel.countDocuments({ chatId: general })).toBe(0);
  });

  it('the app moves some topics with a partial map; the rest keep theirs; a private channel gets the bot as a member', async () => {
    const { token } = await installInframaq();
    await request(app).put('/api/bots/topics').set(asBot(token)).send({ caja: String(gerencia) }).expect(200);
    const topics = (await request(app).get('/api/bots/topics').set(asBot(token)).expect(200)).body.topics;
    expect(topics.map((topic: { channel: { name: string } }) => topic.channel.name)).toEqual(['general', 'gerencia']);
    expect((await post(token, { topic: 'caja', text: 'Cierre del día', idempotency_key: 'c2' }).expect(201)).body.message.chat_id).toBe(String(gerencia));
    expect((await request(app).put('/api/bots/topics').set(asBot(token)).send({ planilla: String(planta) }).expect(400)).body.message).toMatch(/planilla/);
    await request(app).put('/api/bots/topics').set(asBot(token)).send({ caja: String(new Types.ObjectId()) }).expect(404);
  });

  it('«Probar envío» posts one line per channel, saying which topics land there', async () => {
    const { appId } = await installInframaq();
    await request(app).put(topicsPath(appId)).set(asJose).send({ channels: { asistencia: String(planta) } }).expect(200);
    await request(app).post(`${topicsPath(appId)}/test`).set(asAna).expect(403);
    expect((await request(app).post(`${topicsPath(appId)}/test`).set(asJose).expect(200)).body).toEqual({ channels: 2 });
    const lines = await MessageModel.find({ chatId: { $in: [general, planta] } }).select('chatId body').lean();
    expect(lines.map((line) => [String(line.chatId), line.body]).sort()).toEqual([[String(general), 'Prueba de avisos: aquí llegan Caja.'], [String(planta), 'Prueba de avisos: aquí llegan Asistencia.']].sort());
  });
});
