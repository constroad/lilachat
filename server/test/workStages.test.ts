import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from '../src/testMongo.js';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { DEFAULT_WORK_STAGES } from '@lilachat/shared';
import { buildApp } from '../src/app.js';
import { UserModel } from '../src/models.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { ChecklistModel } from '../src/checklistModel.js';
import { configurarAvisoDeTarjeta } from '../src/avisoDeTarjeta.js';
import { signSession } from '../src/sessions.js';
import { ClientChannelModel } from '../src/bots/botClients.js';

/** Pending 21 (José, 20/10): a channel as a job's file, with its checklist by stages. */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let outsider: Types.ObjectId;
let channelId: string;
let directId: string;
let plainChannelId: string;
const app = buildApp();
const jwtOf = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: String(userId) })}` });
const startPlan = (who: Types.ObjectId, chatId: string) => request(app).post('/api/agenda/checklists/stages').set(jwtOf(who)).send({ chatId });
const readPlan = (who: Types.ObjectId, chatId: string) => request(app).get(`/api/agenda/checklists/stages?chatId=${chatId}`).set(jwtOf(who));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_work_stages'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ChecklistModel.deleteMany({}), ClientChannelModel.deleteMany({})]);
  [ana, outsider] = (await UserModel.create([{ phone: '900000031', name: 'Ana' }, { phone: '900000032', name: 'Ajeno' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  channelId = String((await ChatModel.create({ kind: 'group', name: 'obra-miraflores', workspaceId: new Types.ObjectId(), members: [{ userId: ana }], lastSeq: 0 }))._id);
  directId = String((await ChatModel.create({ kind: 'group', name: 'Casa', members: [{ userId: ana }], lastSeq: 0 }))._id);
  // José 29/10: only a client's channel has the job's plan.
  const space = (await ChatModel.findById(channelId).lean())!.workspaceId!;
  await ClientChannelModel.create({ workspaceId: space, appId: new Types.ObjectId(), clientId: 'cli-1', chatId: channelId, name: 'Constructora Vía Sur' });
  plainChannelId = String((await ChatModel.create({ kind: 'group', name: 'general', workspaceId: space, members: [{ userId: ana }], lastSeq: 0 }))._id);
  configurarAvisoDeTarjeta(() => undefined);
});

describe('the checklist by stages of a channel', () => {
  it('a member starts it with the seven stages, in order, without filling the chat with cards', async () => {
    const started = await startPlan(ana, channelId);

    expect(started.status).toBe(201);
    const plan = await readPlan(ana, channelId);
    expect(plan.body.stages.map((one: { title: string }) => one.title)).toEqual([...DEFAULT_WORK_STAGES]);
    expect(plan.body.stages.map((one: { stage: number }) => one.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await MessageModel.countDocuments({ chatId: channelId })).toBe(0);
  });

  it('starting it twice does not duplicate the stages', async () => {
    await startPlan(ana, channelId);
    const again = await startPlan(ana, channelId);

    expect(again.status).toBe(409);
    expect(await ChecklistModel.countDocuments({ chatId: channelId })).toBe(DEFAULT_WORK_STAGES.length);
  });

  it('a stage takes tasks and ticks like any checklist, and the plan brings them', async () => {
    await startPlan(ana, channelId);
    const [first] = (await readPlan(ana, channelId)).body.stages;
    const added = await request(app).post(`/api/agenda/checklists/${first._id}/items`).set(jwtOf(ana)).send({ text: 'Enviar cotización al cliente' });
    expect(added.status).toBeLessThan(300);
    const item = added.body.checklist.items[0];
    await request(app).post(`/api/agenda/checklists/${first._id}/items/${item.id}/toggle`).set(jwtOf(ana));

    const plan = await readPlan(ana, channelId);
    expect(plan.body.stages[0].items[0]).toMatchObject({ text: 'Enviar cotización al cliente', doneBy: String(ana) });
  });

  it('only in a client\'s channel (not any channel of the space), and only for its members', async () => {
    expect((await startPlan(ana, directId)).status).toBe(400);
    expect((await startPlan(ana, plainChannelId)).status).toBe(400);
    expect((await startPlan(outsider, channelId)).status).toBe(403);
    expect((await readPlan(outsider, channelId)).status).toBe(403);
  });

  it('the stages are not listed among the chat checklists of the info', async () => {
    await startPlan(ana, channelId);
    const list = await request(app).get(`/api/agenda/checklists?chatId=${channelId}`).set(jwtOf(ana));
    expect(list.body.checklists).toHaveLength(0);
  });
});

describe('the evidence of a task (design e2-18)', () => {
  const photoMessage = (seq: number, sender: Types.ObjectId, extra: Record<string, unknown> = {}) =>
    MessageModel.create({ chatId: channelId, seq, senderId: sender, clientKey: `k-${seq}`, kind: 'image', at: new Date('2026-10-23T15:14:00Z'), media: { mediaId: `m${seq}`, fileName: 'probeta.jpg', sizeBytes: 2048, url: `/media/apps/lilachat/${seq}.jpg`, thumbUrl: `/media/apps/lilachat/${seq}-t.jpg`, mime: 'image/jpeg' }, ...extra });
  const firstTask = async () => {
    await startPlan(ana, channelId);
    const [first] = (await readPlan(ana, channelId)).body.stages;
    const added = await request(app).post(`/api/agenda/checklists/${first._id}/items`).set(jwtOf(ana)).send({ text: 'Control de densidad' });
    return { stageId: first._id as string, itemId: added.body.checklist.items[0].id as string };
  };
  const link = (who: Types.ObjectId, stageId: string, itemId: string, seq: unknown) => request(app).post(`/api/agenda/checklists/${stageId}/items/${itemId}/evidence`).set(jwtOf(who)).send({ seq });

  it('links a photo of the channel to the task, and the plan brings it with absolute URLs and who made the task', async () => {
    const { stageId, itemId } = await firstTask();
    await photoMessage(5, ana);

    const linked = await link(ana, stageId, itemId, 5);

    expect(linked.status).toBe(200);
    const item = (await readPlan(ana, channelId)).body.stages[0].items[0];
    expect(item.addedBy).toBe(String(ana));
    expect(item.evidence).toHaveLength(1);
    expect(item.evidence[0]).toMatchObject({ seq: 5, kind: 'image', name: 'probeta.jpg', sizeBytes: 2048, by: String(ana) });
    expect(item.evidence[0].url).toMatch(/^https?:\/\/.+\/media\/apps\/lilachat\/5\.jpg$/);
  });

  it('the same message twice stays once', async () => {
    const { stageId, itemId } = await firstTask();
    await photoMessage(5, ana);

    await link(ana, stageId, itemId, 5);
    await link(ana, stageId, itemId, 5);

    expect((await readPlan(ana, channelId)).body.stages[0].items[0].evidence).toHaveLength(1);
  });

  it('refuses a message without a file, one of another chat, or one deleted for everyone', async () => {
    const { stageId, itemId } = await firstTask();
    await MessageModel.create({ chatId: channelId, seq: 6, senderId: ana, clientKey: 'k-6', kind: 'text', body: 'hola', at: new Date() });
    await MessageModel.create({ chatId: directId, seq: 7, senderId: ana, clientKey: 'k-7', kind: 'image', at: new Date(), media: { mediaId: 'm7', fileName: 'x.jpg', sizeBytes: 1, url: '/media/x.jpg', mime: 'image/jpeg' } });
    await photoMessage(8, ana, { deletedAt: new Date() });

    expect((await link(ana, stageId, itemId, 6)).status).toBe(400);
    expect((await link(ana, stageId, itemId, 7)).status).toBe(404);
    expect((await link(ana, stageId, itemId, 8)).status).toBe(404);
    expect((await link(ana, stageId, itemId, 'x')).status).toBe(400);
  });

  it('someone outside the channel cannot link nor read', async () => {
    const { stageId, itemId } = await firstTask();
    await photoMessage(5, ana);

    expect((await link(outsider, stageId, itemId, 5)).status).toBe(404);
  });

  it('who linked it unlinks it; the message stays in the chat', async () => {
    const { stageId, itemId } = await firstTask();
    await photoMessage(5, ana);
    await link(ana, stageId, itemId, 5);

    const removed = await request(app).delete(`/api/agenda/checklists/${stageId}/items/${itemId}/evidence/5`).set(jwtOf(ana));

    expect(removed.status).toBe(200);
    expect((await readPlan(ana, channelId)).body.stages[0].items[0].evidence).toEqual([]);
    expect(await MessageModel.countDocuments({ chatId: channelId, seq: 5 })).toBe(1);
  });
});

