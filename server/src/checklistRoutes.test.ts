import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { configurarAvisoDeTarjeta, type CambioDeTarjeta } from './avisoDeTarjeta.js';
import { signSession } from './sessions.js';

/** Backlog 8 (José, 21/10): «agrega el checklist al estilo de Telegram». */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let ajeno: Types.ObjectId;
let chatId: Types.ObjectId;
let changes: { userId: string; change: CambioDeTarjeta }[];
const app = buildApp();
const jwtOf = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: String(userId) })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_checklists'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ChecklistModel.deleteMany({})]);
  [ana, beto, ajeno] = (await UserModel.create([{ phone: '900000011', name: 'Ana' }, { phone: '900000012', name: 'Beto' }, { phone: '900000013', name: 'Ajeno' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: beto }], lastSeq: 0 }))._id;
  changes = [];
  configurarAvisoDeTarjeta((userId, change) => changes.push({ userId, change }));
});

const create = (who: Types.ObjectId, extra: object = {}) =>
  request(app)
    .post('/api/agenda/checklists')
    .set(jwtOf(who))
    .send({ chatId: String(chatId), title: 'Vaciado de losa', items: ['Pedido de concreto', 'Bomba reservada', ''], othersCanMark: true, othersCanAdd: false, ...extra });

describe('creating a checklist', () => {
  it('a member creates it and it is published in the chat as a card «Checklist: …»', async () => {
    const r = await create(ana);
    expect(r.status).toBe(201);
    const saved = await ChecklistModel.findById(r.body.id).lean();
    expect(saved?.items.map((item) => item.text)).toEqual(['Pedido de concreto', 'Bomba reservada']);
    const message = await MessageModel.findOne({ chatId }).lean();
    expect(message).toMatchObject({ kind: 'checklist', body: 'Checklist: Vaciado de losa', ref: { tipo: 'checklist', id: r.body.id } });
  });

  it('the same validation as the screen; someone else’s chat or a secret one is refused', async () => {
    expect((await create(ana, { items: [] })).body.message).toBe('Agrega al menos una tarea.');
    expect((await create(ajeno)).status).toBe(403);
    await ChatModel.updateOne({ _id: chatId }, { encrypted: true });
    expect((await create(ana)).status).toBe(403);
  });
});

describe('using it', () => {
  it('reads it (members only) and ticks a task with who and when; the chat hears about it live', async () => {
    const { body } = await create(ana);
    const read = await request(app).get(`/api/agenda/checklists/${body.id}`).set(jwtOf(beto));
    expect(read.status).toBe(200);
    expect(read.body.checklist.title).toBe('Vaciado de losa');
    expect((await request(app).get(`/api/agenda/checklists/${body.id}`).set(jwtOf(ajeno))).status).toBe(404);

    const itemId = read.body.checklist.items[0].id as string;
    const ticked = await request(app).post(`/api/agenda/checklists/${body.id}/items/${itemId}/toggle`).set(jwtOf(beto));
    expect(ticked.status).toBe(200);
    expect(ticked.body.checklist.items[0]).toMatchObject({ doneBy: String(beto) });
    // It goes out after answering, like the polls' votes.
    await vi.waitFor(() => expect(changes.map((entry) => entry.change)).toContainEqual({ chatId: String(chatId), tipo: 'checklist', id: body.id }));

    const unticked = await request(app).post(`/api/agenda/checklists/${body.id}/items/${itemId}/toggle`).set(jwtOf(ana));
    expect(unticked.body.checklist.items[0]).toMatchObject({ doneBy: null, doneAt: null });
  });

  it('the others tick and add only if it allows them; the author always', async () => {
    const { body } = await create(ana, { othersCanMark: false, othersCanAdd: false });
    const { body: read } = await request(app).get(`/api/agenda/checklists/${body.id}`).set(jwtOf(beto));
    const itemId = read.checklist.items[0].id as string;
    expect((await request(app).post(`/api/agenda/checklists/${body.id}/items/${itemId}/toggle`).set(jwtOf(beto))).status).toBe(403);
    expect((await request(app).post(`/api/agenda/checklists/${body.id}/items`).set(jwtOf(beto)).send({ text: 'Vibradora' })).status).toBe(403);
    const added = await request(app).post(`/api/agenda/checklists/${body.id}/items`).set(jwtOf(ana)).send({ text: ' Vibradora ' });
    expect(added.status).toBe(201);
    expect(added.body.checklist.items.map((item: { text: string }) => item.text)).toEqual(['Pedido de concreto', 'Bomba reservada', 'Vibradora']);
    expect((await request(app).post(`/api/agenda/checklists/${body.id}/items`).set(jwtOf(ana)).send({ text: 'vibradora' })).body.message).toBe('Esa tarea ya está.');
  });

  it('only the author deletes it, and its card says it is gone', async () => {
    const { body } = await create(ana);
    expect((await request(app).delete(`/api/agenda/checklists/${body.id}`).set(jwtOf(beto))).status).toBe(403);
    expect((await request(app).delete(`/api/agenda/checklists/${body.id}`).set(jwtOf(ana))).status).toBe(200);
    expect((await request(app).get(`/api/agenda/checklists/${body.id}`).set(jwtOf(ana))).status).toBe(404);
  });
});

/** Backlog 30 (José, 21/10): assignees and an ETA per task, and finding it without scrolling. */
describe('checklist, second round', () => {
  const itemsOf = async (id: string) => (await request(app).get(`/api/agenda/checklists/${id}`).set(jwtOf(ana))).body.checklist.items as { id: string; text: string; assignee: string | null; dueAt: string | null }[];

  it('a task gets an assignee (a member of the chat) and a date; both can be cleared', async () => {
    const { body } = await create(ana, { othersCanAdd: true });
    const [first] = await itemsOf(body.id);
    const dueAt = '2026-10-22T14:00:00.000Z';
    // Anyone may edit here (othersCanAdd); the next test covers a checklist where they may not.
    const set = await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(beto)).send({ assignee: String(beto), dueAt });
    expect(set.status).toBe(200);
    expect(set.body.checklist.items[0]).toMatchObject({ assignee: String(beto), dueAt });
    expect((await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana)).send({ assignee: String(ajeno) })).status).toBe(400);
    const cleared = await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana)).send({ assignee: null, dueAt: null });
    expect(cleared.body.checklist.items[0]).toMatchObject({ assignee: null, dueAt: null });
  });

  it('editing and removing tasks follows «los demás pueden agregar»; the last task stays', async () => {
    const { body } = await create(ana, { othersCanAdd: false });
    const [first, second] = await itemsOf(body.id);
    expect((await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(beto)).send({ text: 'Otra cosa' })).status).toBe(403);
    expect((await request(app).delete(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana))).status).toBe(200);
    expect((await request(app).delete(`/api/agenda/checklists/${body.id}/items/${second!.id}`).set(jwtOf(ana))).body.message).toBe('Un checklist lleva al menos una tarea.');
  });

  it('it is pinned in the chat when created (unless asked not to) and remembers its card', async () => {
    const pinned = await create(ana);
    const chat = await ChatModel.findById(chatId).lean();
    const card = await MessageModel.findOne({ chatId, 'ref.id': pinned.body.id }).lean();
    expect(chat?.fijados?.map((one) => one.seq)).toContain(card!.seq);
    expect((await ChecklistModel.findById(pinned.body.id).lean())?.cardSeq).toBe(card!.seq);
    const loose = await create(ana, { title: 'Sin fijar', pin: false });
    const looseCard = await MessageModel.findOne({ chatId, 'ref.id': loose.body.id }).lean();
    expect((await ChatModel.findById(chatId).lean())?.fijados?.map((one) => one.seq)).not.toContain(looseCard!.seq);
  });

  it('the chat lists its checklists with progress and overdue count (members only)', async () => {
    const { body } = await create(ana);
    const [first] = await itemsOf(body.id);
    await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana)).send({ dueAt: '2020-01-01T00:00:00.000Z' });
    const list = await request(app).get(`/api/agenda/checklists?chatId=${chatId}`).set(jwtOf(beto));
    expect(list.status).toBe(200);
    expect(list.body.checklists[0]).toMatchObject({ _id: body.id, title: 'Vaciado de losa', done: 0, total: 2, overdue: 1 });
    expect((await request(app).get(`/api/agenda/checklists?chatId=${chatId}`).set(jwtOf(ajeno))).status).toBe(403);
  });

  it('«Mis tareas»: the pending tasks assigned to me in all my chats, with their chat', async () => {
    const { body } = await create(ana);
    const [first, second] = await itemsOf(body.id);
    await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana)).send({ assignee: String(beto) });
    await request(app).patch(`/api/agenda/checklists/${body.id}/items/${second!.id}`).set(jwtOf(ana)).send({ assignee: String(ana) });
    const mine = await request(app).get('/api/agenda/checklists/mine').set(jwtOf(beto));
    expect(mine.status).toBe(200);
    expect(mine.body.checklists).toHaveLength(1);
    expect(mine.body.checklists[0].items.map((item: { text: string }) => item.text)).toEqual(['Pedido de concreto']);
  });

  it('a checklist can be created inside a thread', async () => {
    const root = await MessageModel.create({ chatId, seq: 50, senderId: ana, clientKey: 'raiz-50', kind: 'text', body: 'Vaciado', at: new Date() });
    await ChatModel.updateOne({ _id: chatId }, { lastSeq: 50 });
    const r = await create(ana, { hiloDe: root.seq, pin: false });
    expect(r.status).toBe(201);
    expect(await MessageModel.findOne({ chatId, 'ref.id': r.body.id }).lean()).toMatchObject({ hiloDe: 50 });
  });

  /** José, 21/10: «¿cómo edito un checklist? ¿cómo lo cancelo o lo elimino?». */
  it('its author changes the title and who may tick and add; the card in the chat reads the new title', async () => {
    const { body } = await create(ana);
    expect((await request(app).patch(`/api/agenda/checklists/${body.id}`).set(jwtOf(beto)).send({ title: 'Otro' })).status).toBe(403);
    expect((await request(app).patch(`/api/agenda/checklists/${body.id}`).set(jwtOf(ana)).send({ title: '  ' })).body.message).toBe('Escribe el título del checklist.');
    const edited = await request(app).patch(`/api/agenda/checklists/${body.id}`).set(jwtOf(ana)).send({ title: ' Vaciado del 4.º piso ', othersCanMark: false, othersCanAdd: true });
    expect(edited.status).toBe(200);
    expect(edited.body.checklist).toMatchObject({ title: 'Vaciado del 4.º piso', othersCanMark: false, othersCanAdd: true });
    expect((await MessageModel.findOne({ chatId, 'ref.id': body.id }).lean())?.body).toBe('Checklist: Vaciado del 4.º piso');
    expect(changes.some((one) => one.change.tipo === 'checklist' && String(one.change.id) === body.id)).toBe(true);
  });

  it('deleting it deletes its card for everyone, like a deleted message, and unpins it', async () => {
    const { body } = await create(ana);
    const card = await MessageModel.findOne({ chatId, 'ref.id': body.id }).lean();
    expect((await request(app).delete(`/api/agenda/checklists/${body.id}`).set(jwtOf(ana))).status).toBe(200);
    expect((await ChatModel.findById(chatId).lean())?.fijados?.map((one) => one.seq) ?? []).not.toContain(card!.seq);
    const gone = await MessageModel.findOne({ chatId, seq: card!.seq }).lean();
    expect(gone?.deletedAt).toBeTruthy();
    expect(gone?.body).toBeUndefined();
  });

  it('a checklist from before 0.1.122 (no cardSeq) finds its card and keeps it, so the info and «Mis tareas» jump to it', async () => {
    const { body } = await create(ana);
    const card = await MessageModel.findOne({ chatId, 'ref.id': body.id }).lean();
    await ChecklistModel.updateOne({ _id: body.id }, { $unset: { cardSeq: 1 } });
    const [first] = await itemsOf(body.id);
    await request(app).patch(`/api/agenda/checklists/${body.id}/items/${first!.id}`).set(jwtOf(ana)).send({ assignee: String(beto) });
    expect((await request(app).get('/api/agenda/checklists/mine').set(jwtOf(beto))).body.checklists[0].cardSeq).toBe(card!.seq);
    expect((await request(app).get(`/api/agenda/checklists?chatId=${chatId}`).set(jwtOf(beto))).body.checklists[0].cardSeq).toBe(card!.seq);
    expect((await ChecklistModel.findById(body.id).lean())?.cardSeq).toBe(card!.seq);
  });
});
