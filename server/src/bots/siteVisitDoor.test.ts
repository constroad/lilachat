import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { NEW_VISIT, VISIT_WITH_ID } from '../../../shared/src/siteVisit.fixture.js';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotCommandRunModel, BotInstallationModel } from './botModels.js';
import { VisitDraftModel } from './siteVisitDoor.js';
import { itemKey, SITE_VISIT_SHORTCUT } from '@lilachat/shared';

/** A technical visit from the phone (José 13/11; contract with agentes 14/11, BOTS-API c-visitas). */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl = '';
let answers: Record<string, { status: number; body: unknown }> = {};
let received: { type?: string; data?: Record<string, unknown> }[] = [];
let ana: Types.ObjectId;
let spaceId: Types.ObjectId;
let visitsChannel: Types.ObjectId;
let general: Types.ObjectId;
let direct: Types.ObjectId;
const app = buildApp();
const VISIT = '65f0000000000000000000a1';
const ENTRY = '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b';
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const draftOf = (body: Record<string, unknown>) => request(app).post(`/api/workspaces/${spaceId}/visits/draft`).set(auth(ana)).send(body);
const openOf = (body: Record<string, unknown>) => request(app).post(`/api/workspaces/${spaceId}/visits/forms`).set(auth(ana)).send(body);
const point = { kind: 'point', visit_id: VISIT, entry_id: ENTRY, type: 'BACHE', lat: -12.0217, lng: -76.8817, precision_m: 6, source: 'apk' };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_site_visit_test'));
  hook = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const event = JSON.parse(raw) as { type?: string; data?: Record<string, unknown> };
      received.push({ type: event.type, data: event.data });
      const answer = answers[event.type ?? ''] ?? { status: 200, body: {} };
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
  answers = { 'visit.draft.requested': { status: 200, body: { document: VISIT_WITH_ID } }, 'form.submitted': { status: 200, body: { response_type: 'ephemeral', text: 'Punto marcado.' } } };
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotCommandRunModel, VisitDraftModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  ana = (await UserModel.create({ phone: '51922222222', name: 'Ana' }))._id as Types.ObjectId;
  spaceId = (await WorkspaceModel.create({ name: 'Test', ownerId: ana, joinCode: 'TEST-7K3P' }))._id;
  await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: ana, phone: '51922222222', role: 'owner', status: 'active' });
  const botUser = (await UserModel.create({ phone: 'bot-portal', name: 'Portal' }))._id as Types.ObjectId;
  const appDoc = await BotAppModel.create({ clientId: 'lca_portal', clientSecretHash: 'x', name: 'Portal', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl, shortcuts: [{ key: SITE_VISIT_SHORTCUT, name: 'Visita técnica' }] });
  const channelOf = async (name: string) => (await ChatModel.create({ kind: 'group', name, workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: ana, role: 'admin' }, { userId: botUser, role: 'member' }] }))._id as Types.ObjectId;
  general = await channelOf('general');
  visitsChannel = await channelOf('visitas-tecnicas');
  direct = (await ChatModel.create({ kind: 'direct', workspaceId: spaceId, members: [{ userId: ana, role: 'member' }, { userId: botUser, role: 'member' }] }))._id as Types.ObjectId;
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: 'h1', signingSecret: 'secret', installedBy: ana, itemsV2: true, itemSettings: { [itemKey('shortcut', SITE_VISIT_SHORTCUT)]: { channels: [String(visitsChannel)], direct: true, who: { kind: 'everyone' } } } });
});

describe('the visit\'s door', () => {
  it('from the visits channel, asks agentes as the person, with the channel and the place, and answers the document', async () => {
    // Act
    const answered = await draftOf({ chat_id: String(visitsChannel), visit_id: VISIT }).expect(200);
    // Assert
    expect(received[0]).toMatchObject({ type: 'visit.draft.requested', data: { visita_id: VISIT, channel_id: String(visitsChannel), channel: { id: String(visitsChannel), kind: 'group' }, place: 'channel', user: { id: String(ana), name: 'Ana' } } });
    expect(answered.body.document).toMatchObject({ id: VISIT, code: 'VIS-2026-0003', figures: { points: 1 } });
  });
  it('from the 1:1 with the app the place is «direct»; a new visit brings the open ones', async () => {
    answers['visit.draft.requested'] = { status: 200, body: NEW_VISIT };
    const answered = await draftOf({ chat_id: String(direct) }).expect(200);
    // Agentes knows the 1:1 only by `channel.kind` (14/11).
    expect(received[0]?.data).toMatchObject({ place: 'direct', channel_id: String(direct), channel: { id: String(direct), kind: 'direct' } });
    expect(received[0]?.data).not.toHaveProperty('visita_id');
    expect(answered.body.visits).toEqual([expect.objectContaining({ id: VISIT })]);
  });
  it('while the screens are not lv01–lv04 the chat is told no door, and agentes is not asked', async () => {
    const doorOf = (chatId: Types.ObjectId) => request(app).get(`/api/workspaces/${spaceId}/visits/door`).query({ chat_id: String(chatId) }).set(auth(ana)).expect(200);
    expect((await doorOf(visitsChannel)).body).toEqual({ open: false });
    expect((await doorOf(direct)).body).toEqual({ open: false });
    expect(received).toHaveLength(0);
  });
  it('any other channel is no door: 404 and nothing reaches agentes', async () => {
    await draftOf({ chat_id: String(general) }).expect(404);
    expect(received).toHaveLength(0);
  });
  it('the space admin decides: untouched it is off everywhere, and «who» leaves out the rest', async () => {
    // Arrange
    const bea = (await UserModel.create({ phone: '51933333333', name: 'Bea' }))._id as Types.ObjectId;
    await WorkspaceMemberModel.create({ workspaceId: spaceId, userId: bea, phone: '51933333333', role: 'member', status: 'active' });
    await ChatModel.updateOne({ _id: visitsChannel }, { $push: { members: { userId: bea, role: 'member' } } });
    const draftFor = (userId: Types.ObjectId) => request(app).post(`/api/workspaces/${spaceId}/visits/draft`).set(auth(userId)).send({ chat_id: String(visitsChannel) });
    // Act + Assert: only Ana is chosen
    await BotInstallationModel.updateOne({}, { $set: { [`itemSettings.${itemKey('shortcut', SITE_VISIT_SHORTCUT)}.who`]: { kind: 'people', userIds: [String(ana)] } } });
    await draftFor(bea).expect(404);
    // Untouched: off in every channel
    await BotInstallationModel.updateOne({}, { $set: { itemSettings: {} } });
    await draftFor(ana).expect(404);
    expect(received).toHaveLength(0);
  });
  it('a door, not a command: the ⚡ and «/» do not offer it', async () => {
    const offered = await request(app).get(`/api/workspaces/${spaceId}/commands`).query({ chat: String(visitsChannel) }).set(auth(ana)).expect(200);
    expect(JSON.stringify(offered.body)).not.toContain(SITE_VISIT_SHORTCUT);
  });
  it('Portal\'s refusal: its own text reaches the person', async () => {
    answers['visit.draft.requested'] = { status: 200, body: { error: 'visitas_apagadas', message: 'Las visitas técnicas desde Lilachat están apagadas: se encienden en Empresa › Lila.' } };
    const answered = await draftOf({ chat_id: String(visitsChannel) }).expect(200);
    expect(answered.body).toEqual({ error: 'visitas_apagadas', message: 'Las visitas técnicas desde Lilachat están apagadas: se encienden en Empresa › Lila.' });
  });
});

describe('a visit\'s writes', () => {
  it('a point opens as a run with everything as context; sent, it carries the channel and the place beside the values', async () => {
    // Arrange
    await draftOf({ chat_id: String(visitsChannel), visit_id: VISIT }).expect(200);
    // Act
    const opened = await openOf({ chat_id: String(visitsChannel), ...point }).expect(200);
    await request(app).post(`/api/chats/${visitsChannel}/commands/${opened.body.commandId}/form`).set(auth(ana)).send({ values: {} }).expect(200);
    // Assert
    expect(opened.body.response.form).toMatchObject({ id: 'marcar_punto_de_visita', title: 'Punto 2' });
    const submitted = received.find((event) => event.type === 'form.submitted')!;
    expect(submitted.data).toMatchObject({ form_id: 'marcar_punto_de_visita', channel_id: String(visitsChannel), place: 'channel', values: { visitaId: VISIT, entradaId: ENTRY, tipo: 'BACHE', lat: -12.0217, lng: -76.8817, precisionM: 6, fuente: 'apk' } });
  });
  it('a point without GPS, without type or without its key is refused before reaching agentes', async () => {
    await draftOf({ chat_id: String(visitsChannel), visit_id: VISIT }).expect(200);
    expect((await openOf({ chat_id: String(visitsChannel), ...point, lat: undefined }).expect(400)).body.message).toBe('Falta la ubicación del GPS.');
    expect((await openOf({ chat_id: String(visitsChannel), ...point, type: 'HUECO' }).expect(400)).body.message).toBe('Elige qué es.');
    await openOf({ chat_id: String(visitsChannel), ...point, entry_id: 'x' }).expect(400);
  });
  it('the interview opens with Portal\'s schema and its saved answers; a new visit\'s details take the phone\'s place', async () => {
    await draftOf({ chat_id: String(visitsChannel), visit_id: VISIT }).expect(200);
    const interview = await openOf({ chat_id: String(visitsChannel), kind: 'section', section: 'entrevista', visit_id: VISIT }).expect(200);
    expect(interview.body.response.form.schema.properties.r01).toMatchObject({ default: 'no' });
    answers['visit.draft.requested'] = { status: 200, body: NEW_VISIT };
    await draftOf({ chat_id: String(visitsChannel) }).expect(200);
    const start = await openOf({ chat_id: String(visitsChannel), kind: 'section', section: 'datos', lat: -12.1, lng: -77, precision_m: 8 }).expect(200);
    // Portal's guardar_visita requires an entry key on every section: one per opened form, so a resend does not duplicate.
    const context = (await BotCommandRunModel.findById(start.body.commandId).lean())?.context;
    expect(context).toEqual({ seccion: 'datos', lat: -12.1, lng: -77, precisionM: 8, entradaId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect((await BotCommandRunModel.findById(interview.body.commandId).lean())?.context).toMatchObject({ visitaId: VISIT, seccion: 'entrevista', entradaId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });
  it('finishing and the PDF are forms with nothing to fill; outside the door nothing opens', async () => {
    const finish = await openOf({ chat_id: String(visitsChannel), kind: 'finish', visit_id: VISIT }).expect(200);
    expect(finish.body.response.form).toMatchObject({ id: 'terminar_visita', schema: { properties: {} } });
    await openOf({ chat_id: String(general), kind: 'finish', visit_id: VISIT }).expect(404);
  });
});
