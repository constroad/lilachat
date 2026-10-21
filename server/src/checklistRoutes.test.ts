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
