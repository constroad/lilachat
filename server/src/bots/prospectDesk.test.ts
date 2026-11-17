import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from '../testMongo.js';
import { buildApp } from '../app.js';
import { UserModel } from '../models.js';
import { ChatModel, MessageModel, type Message } from '../chatModels.js';
import { ReminderModel } from '../eventModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../workspaceModels.js';
import { signSession } from '../sessions.js';
import { BotAppModel, BotDeliveryModel, BotInstallationModel } from './botModels.js';
import { ProspectChannelModel } from './botProspects.js';
import { forgetBots } from './botRegistry.js';
import { sha256 } from './botSecrets.js';
import { botsHearMessage } from './botTriggers.js';
import { configureProspectsAnnounce } from './prospectAnnounce.js';

/** Dali phase 2 (BOTS-API «Fase 2: contrato», 16/11): agentes' view in the PUT, the seller's decisions in Lilachat. */
let mongo: MongoMemoryServer;
let hook: Server;
let hookUrl = '';
let received: { type?: string; data?: Record<string, unknown> }[] = [];
let answers: Record<string, { status: number; body: unknown }> = {};
let announced: { userIds: string[]; workspaceId: string }[] = [];
const app = buildApp({});
const TOKEN = 'lcb_test_dali_0123456789';
const PROSPECT = 'dali:constroad:9f2c41';
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let hidden: Types.ObjectId;
let outsider: Types.ObjectId;
let botUser: Types.ObjectId;
let spaceId: Types.ObjectId;

const asUser = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const putProspect = (body: Record<string, unknown>) => request(app).put(`/api/bots/prospects/${encodeURIComponent(PROSPECT)}`).set({ Authorization: `Bearer ${TOKEN}` }).send(body);
const base = { phone: '51949123824', last_activity_at: '2026-11-17T14:02:00.000Z', name: 'Carmen Villanueva', source: { kind: 'ctwa', ad_title: 'Asfalto para condominios' } };
const desk = (userId: Types.ObjectId) => ({
  list: () => request(app).get(`/api/workspaces/${spaceId}/prospects`).set(asUser(userId)),
  one: () => request(app).get(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}`).set(asUser(userId)),
  change: (body: Record<string, unknown>) => request(app).patch(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}`).set(asUser(userId)).send(body),
  approve: (body: Record<string, unknown>) => request(app).post(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}/follow-up`).set(asUser(userId)).send(body),
  handBack: (body: Record<string, unknown>) => request(app).post(`/api/workspaces/${spaceId}/prospects/${encodeURIComponent(PROSPECT)}/handback`).set(asUser(userId)).send(body),
});

async function eventOf(type: string): Promise<Record<string, unknown>> {
  for (let tries = 0; tries < 40; tries += 1) {
    const found = received.find((event) => event.type === type);
    if (found?.data) return found.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`No llegó ${type}`);
}

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_prospect_desk'));
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
  forgetBots();
  received = [];
  announced = [];
  configureProspectsAnnounce((userIds, workspaceId) => announced.push({ userIds: [...userIds].sort(), workspaceId }));
  answers = {};
  await Promise.all([UserModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel, BotAppModel, BotInstallationModel, BotDeliveryModel, ProspectChannelModel, ReminderModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  [jose, ana, hidden, outsider, botUser] = (await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana Ríos' }, { phone: '51933333333', name: 'Oculto' }, { phone: '51911111111', name: 'Otro' }, { phone: 'bot-dali', name: 'Dali' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
  spaceId = (await WorkspaceModel.create({ name: 'Dali · Constroad', ownerId: jose, joinCode: 'DALI-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: ana, phone: '51987654321', role: 'member', status: 'active' },
    { workspaceId: spaceId, userId: hidden, phone: '51933333333', role: 'member', status: 'active', hidden: true },
  ]);
  const appDoc = await BotAppModel.create({ clientId: 'lca_dali', clientSecretHash: 'x', name: 'Dali', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: hookUrl });
  await BotInstallationModel.create({ appId: appDoc._id, workspaceId: spaceId, botUserId: botUser, tokenHash: sha256(TOKEN), signingSecret: 'secret', installedBy: jose, grantedScopes: ['prospects:write', 'channels:history'] });
});

describe('PUT /api/bots/prospects/:id (phase 2)', () => {
  it('keeps what agentes knows, leaves alone what does not come and clears what comes as null', async () => {
    await putProspect({ ...base, stage: 'to_quote', score: 86, service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, follow_up_draft: { text: 'Hola Carmen' } }).expect(201);
    await putProspect({ ...base, summary: 'Asfaltado de 450 m² en Ate', follow_up_draft: null }).expect(200);
    const stored = await ProspectChannelModel.findOne({ prospectId: PROSPECT }).lean();
    expect(stored).toMatchObject({ stage: 'to_quote', score: 86, service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, summary: 'Asfaltado de 450 m² en Ate' });
    expect(stored?.followUpDraft).toBeUndefined();
  });

  it('never blocks the channel for a wrong phase 2 field: keeps the rest and tells it back in ignored', async () => {
    await putProspect({ ...base, score: 40 }).expect(201);
    const kept = await putProspect({ ...base, name: 'Carmen V.', score: 140, summary: 'Quiere cotización' }).expect(200);
    expect(kept.body.ignored).toEqual([{ field: 'score', message: expect.stringContaining('score') }]);
    expect(await ProspectChannelModel.findOne({ prospectId: PROSPECT }).lean()).toMatchObject({ name: 'Carmen V.', score: 40, summary: 'Quiere cotización' });
  });
});

describe('a Dali space', () => {
  it('comes marked in my spaces list, so the clients draw its tabs; a space without Dali does not', async () => {
    const other = (await WorkspaceModel.create({ name: 'Test', ownerId: jose, joinCode: 'TEST-7K3P' }))._id;
    await WorkspaceMemberModel.create({ workspaceId: other, userId: jose, phone: '51902049935', role: 'owner', status: 'active' });
    const { body } = await request(app).get('/api/workspaces').set(asUser(jose)).expect(200);
    const byId = new Map((body.workspaces as { id: string; prospects?: boolean }[]).map((space) => [space.id, space]));
    expect(byId.get(String(spaceId))?.prospects).toBe(true);
    expect(byId.get(String(other))?.prospects).toBeUndefined();
  });

  it('marks each prospect channel in the space chat list, so the inbox lists it apart from the team chats', async () => {
    await putProspect(base).expect(201);
    const { body } = await request(app).get(`/api/chats?workspace=${spaceId}`).set(asUser(jose)).expect(200);
    const chats = body.chats as { name?: string; prospect?: boolean }[];
    expect(chats.find((chat) => chat.name === 'Carmen Villanueva')?.prospect).toBe(true);
    expect(chats.find((chat) => chat.name === 'general')?.prospect).toBeUndefined();
  });
});

describe('the space members desk', () => {
  beforeEach(async () => {
    await putProspect({ ...base, stage: 'quoted', score: 78, quote: { code: 'COT-2026-0318', amount: 20231.1, currency: 'PEN', sent_at: '2026-11-17T15:00:00.000Z' }, follow_up_draft: { text: 'Hola Carmen, ¿pudiste ver la cotización?' } }).expect(201);
  });

  it('lists the prospects to every active member, and the quote amount only to an admin', async () => {
    const forAdmin = await desk(jose).list().expect(200);
    expect(forAdmin.body).toMatchObject({ admin: true, enabled: true, me: String(jose) });
    expect(forAdmin.body.prospects[0]).toMatchObject({ id: PROSPECT, name: 'Carmen Villanueva', stage: 'quoted', score: 78, version: 0, quote: { code: 'COT-2026-0318', amount: 20231.1, currency: 'PEN' } });
    const forMember = await desk(ana).list().expect(200);
    expect(forMember.body.admin).toBe(false);
    expect(forMember.body.prospects[0].quote).toEqual({ code: 'COT-2026-0318', sentAt: '2026-11-17T15:00:00.000Z' });
    await desk(outsider).list().expect(404);
  });

  it('lets a seller take the prospect, tells agentes with the new version, and refuses a stale one', async () => {
    const taken = await desk(ana).change({ version: 0, assignee: 'me' }).expect(200);
    expect(taken.body.prospect).toMatchObject({ assignee: { id: String(ana), name: 'Ana Ríos' }, version: 1 });
    const event = await eventOf('prospect.updated');
    expect(event).toMatchObject({ prospect_id: PROSPECT, assignee: { id: String(ana), name: 'Ana Ríos' }, next_action: null, result: null, user: { id: String(ana), name: 'Ana Ríos' }, version: 1 });
    const late = await desk(jose).change({ version: 0, assignee: 'me' }).expect(409);
    expect(late.body).toMatchObject({ error: 'stale', prospect: { assignee: { id: String(ana) }, version: 1 } });
  });

  it('turns a next action into a reminder for whoever does it, and a result turns it off', async () => {
    const at = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const planned = await desk(ana).change({ version: 0, next_action: { kind: 'call', at, note: 'Preguntar por la fecha' } }).expect(200);
    expect(planned.body.prospect.nextAction).toEqual({ kind: 'call', at, assigneeId: String(ana), note: 'Preguntar por la fecha' });
    const reminder = await ReminderModel.findOne({ userId: ana }).lean();
    expect(reminder).toMatchObject({ title: 'Llamar · Carmen Villanueva', note: 'Preguntar por la fecha', active: true });
    expect(String(reminder?.prospectRef?.chatId)).toBe(planned.body.prospect.chatId);
    const lost = await desk(ana).change({ version: 1, result: { outcome: 'lost', reason: 'price', note: 'Le pareció caro' } }).expect(200);
    expect(lost.body.prospect).toMatchObject({ result: { outcome: 'lost', reason: 'price', note: 'Le pareció caro', by: { id: String(ana) } }, version: 2 });
    expect(lost.body.prospect.nextAction).toBeUndefined();
    expect((await ReminderModel.findById(reminder?._id).lean())?.active).toBe(false);
  });

  it('gives the next action to another member only if they are an active member', async () => {
    const at = new Date(Date.now() + 60 * 60_000).toISOString();
    await desk(ana).change({ version: 0, next_action: { kind: 'visit', at, assignee_id: String(outsider) } }).expect(400);
    await desk(ana).change({ version: 0, next_action: { kind: 'visit', at, assignee_id: String(jose) } }).expect(200);
    expect(await ReminderModel.countDocuments({ userId: jose, active: true })).toBe(1);
  });

  it('sends the follow-up a seller approved, edited, and clears the draft', async () => {
    const approved = await desk(ana).approve({ version: 0, text: 'Hola Carmen, ¿te llamo hoy?' }).expect(200);
    expect(approved.body.prospect.followUpDraft).toBeUndefined();
    expect(await eventOf('prospect.follow_up.approved')).toMatchObject({ prospect_id: PROSPECT, text: 'Hola Carmen, ¿te llamo hoy?', user: { id: String(ana) }, version: 1 });
    const again = await desk(ana).approve({ version: 1, text: 'Otra vez' }).expect(409);
    expect(again.body.error).toBe('no_draft');
  });

  it('hands the prospect back to Dali', async () => {
    await putProspect({ ...base, attended_by: 'human' }).expect(200);
    const back = await desk(jose).handBack({ version: 0 }).expect(200);
    expect(back.body.prospect).toMatchObject({ attendedBy: 'dali', version: 1 });
    expect(await eventOf('prospect.handback')).toMatchObject({ prospect_id: PROSPECT, user: { id: String(jose) }, version: 1 });
  });

  it('lets a hidden member read but not decide', async () => {
    await desk(hidden).list().expect(200);
    const refused = await desk(hidden).change({ version: 0, assignee: 'me' }).expect(403);
    expect(refused.body.error).toBe('incognito');
  });

  it('notes when the prospect wrote, when Dali answered and when a person answered', async () => {
    const chatId = (await ProspectChannelModel.findOne({ prospectId: PROSPECT }).lean())!.chatId;
    const posted = (body: Record<string, unknown>) => request(app).post('/api/bots/messages').set({ Authorization: `Bearer ${TOKEN}` }).send(body).expect((res) => expect(res.status).toBeLessThan(300));
    const wrote = new Date(Date.now() - 60_000).toISOString();
    await posted({ prospect: PROSPECT, as_contact: true, sent_at: wrote, text: 'Hola, vi su anuncio', idempotency_key: 'wa-1' });
    await posted({ prospect: PROSPECT, text: '¡Hola! ¿En qué distrito?', idempotency_key: 'dali-1' });
    const reply = await MessageModel.create({ chatId, seq: 99, senderId: ana, clientKey: 'web-reply-1', kind: 'text', body: 'Te llamo en 5 min', at: new Date() });
    const chat = await ChatModel.findById(chatId).lean();
    await botsHearMessage(reply.toObject() as Message, chat!.members.map((member) => String(member.userId)));
    const stored = await ProspectChannelModel.findOne({ prospectId: PROSPECT }).lean();
    expect(stored?.firstContactAt?.toISOString()).toBe(wrote);
    expect(stored?.lastContactAt?.toISOString()).toBe(wrote);
    expect(stored?.firstDaliReplyAt).toBeInstanceOf(Date);
    expect(String(stored?.firstTeamReply?.userId)).toBe(String(ana));
    expect(stored?.lastTeamReplyAt).toBeInstanceOf(Date);
  });

  it('tells the members\' inbox to read again when agentes, a seller or the first answer change a prospect', async () => {
    const members = [String(jose), String(ana), String(hidden)].sort();
    const wait = async (count: number) => {
      for (let tries = 0; tries < 40 && announced.length < count; tries += 1) await new Promise((resolve) => setTimeout(resolve, 25));
      return announced.length;
    };
    expect(await wait(1)).toBeGreaterThanOrEqual(1);
    expect(announced[0]).toEqual({ userIds: members, workspaceId: String(spaceId) });
    announced = [];
    await desk(ana).change({ version: 0, assignee: 'me' }).expect(200);
    expect(await wait(1)).toBe(1);
    announced = [];
    const chatId = (await ProspectChannelModel.findOne({ prospectId: PROSPECT }).lean())!.chatId;
    const reply = await MessageModel.create({ chatId, seq: 98, senderId: ana, clientKey: 'web-reply-2', kind: 'text', body: 'Te llamo', at: new Date() });
    const chat = await ChatModel.findById(chatId).lean();
    await botsHearMessage(reply.toObject() as Message, chat!.members.map((member) => String(member.userId)));
    expect(await wait(1)).toBe(1);
  });
});

describe('what Dali knows', () => {
  const knowledge = {
    services: [{ key: 'venta_mezcla', name: 'Venta de mezcla', questions: ['¿Cuántos m³?'], price_policy: { visible: true, basis: 'puesto en planta (Cajamarquilla), sin transporte, más IGV' } }],
    catalog: [{ service_key: 'venta_mezcla', name: 'Mezcla asfáltica en caliente', unit: 'm³', price: 480 }],
    faqs: [{ id: 'faq-1', question: '¿Dónde está la planta?', answer: 'En Cajamarquilla.' }],
    zone: 'Lima y alrededores',
    hours: 'Lunes a sábado',
    edit_url: 'https://agentes.constroad.com/dali/servicios',
  };

  it('asks agentes and shows prices only to an admin', async () => {
    answers['dali.knowledge.requested'] = { status: 200, body: knowledge };
    const forAdmin = await request(app).get(`/api/workspaces/${spaceId}/dali/knowledge`).set(asUser(jose)).expect(200);
    expect(forAdmin.body.knowledge.catalog[0].price).toBe(480);
    expect(forAdmin.body.knowledge.services[0].pricePolicy.basis).toContain('Cajamarquilla');
    const forMember = await request(app).get(`/api/workspaces/${spaceId}/dali/knowledge`).set(asUser(ana)).expect(200);
    expect(forMember.body.knowledge.catalog[0]).toEqual({ serviceKey: 'venta_mezcla', name: 'Mezcla asfáltica en caliente', unit: 'm³' });
    expect(forMember.body.knowledge.services[0].pricePolicy).toBeUndefined();
    expect(received.filter((event) => event.type === 'dali.knowledge.requested')[1]?.data).toMatchObject({ user: { id: String(ana), name: 'Ana Ríos' } });
  });

  it('says so when agentes does not answer', async () => {
    answers['dali.knowledge.requested'] = { status: 500, body: { error: 'boom' } };
    const failed = await request(app).get(`/api/workspaces/${spaceId}/dali/knowledge`).set(asUser(ana)).expect(502);
    expect(failed.body.message).toContain('Dali');
  });

  it('teaches Dali one answer, once per key', async () => {
    answers['dali.faq.add'] = { status: 200, body: { faq: { id: 'faq-9' } } };
    const added = await request(app).post(`/api/workspaces/${spaceId}/dali/faqs`).set(asUser(ana)).send({ question: '¿Hacen bacheo en Huaral?', answer: 'Sí, desde 200 m².', idempotency_key: 'teach-0123456789' }).expect(200);
    expect(added.body.faq).toEqual({ id: 'faq-9' });
    expect(await eventOf('dali.faq.add')).toMatchObject({ question: '¿Hacen bacheo en Huaral?', answer: 'Sí, desde 200 m².', idempotency_key: 'teach-0123456789', user: { id: String(ana) } });
    await request(app).post(`/api/workspaces/${spaceId}/dali/faqs`).set(asUser(ana)).send({ question: '', answer: 'x', idempotency_key: 'teach-0123456789' }).expect(400);
  });
});

describe('the weekly review', () => {
  it('shows the latest review card Dali posted in #general, or none yet', async () => {
    const general = await ChatModel.create({ kind: 'group', name: 'general', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: jose, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
    await WorkspaceModel.updateOne({ _id: spaceId }, { $set: { generalChatId: general._id } });
    expect((await request(app).get(`/api/workspaces/${spaceId}/dali/review`).set(asUser(ana)).expect(200)).body).toEqual({ review: null });
    const posted = (key: string, title: string) => request(app).post('/api/bots/messages').set({ Authorization: `Bearer ${TOKEN}` }).send({ channel_id: String(general._id), card: { title }, idempotency_key: key }).expect((res) => expect(res.status).toBeLessThan(300));
    await posted('review:2026-W46', 'Revisión de la semana 46');
    await posted('aviso-1', 'Otra tarjeta');
    await posted('review:2026-W47', 'Revisión de la semana 47');
    const shown = await request(app).get(`/api/workspaces/${spaceId}/dali/review`).set(asUser(ana)).expect(200);
    expect(shown.body.review).toMatchObject({ chatId: String(general._id), seq: 3, card: { title: 'Revisión de la semana 47' } });
  });
});

