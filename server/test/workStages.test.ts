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

/** Pending 21 (José, 20/10): a channel as a job's file, with its checklist by stages. */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let outsider: Types.ObjectId;
let channelId: string;
let directId: string;
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
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ChecklistModel.deleteMany({})]);
  [ana, outsider] = (await UserModel.create([{ phone: '900000031', name: 'Ana' }, { phone: '900000032', name: 'Ajeno' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  channelId = String((await ChatModel.create({ kind: 'group', name: 'obra-miraflores', workspaceId: new Types.ObjectId(), members: [{ userId: ana }], lastSeq: 0 }))._id);
  directId = String((await ChatModel.create({ kind: 'group', name: 'Casa', members: [{ userId: ana }], lastSeq: 0 }))._id);
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

  it('only in a channel of a space, and only for its members', async () => {
    expect((await startPlan(ana, directId)).status).toBe(400);
    expect((await startPlan(outsider, channelId)).status).toBe(403);
    expect((await readPlan(outsider, channelId)).status).toBe(403);
  });

  it('the stages are not listed among the chat checklists of the info', async () => {
    await startPlan(ana, channelId);
    const list = await request(app).get(`/api/agenda/checklists?chatId=${channelId}`).set(jwtOf(ana));
    expect(list.body.checklists).toHaveLength(0);
  });
});
