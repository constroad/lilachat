import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { DeviceModel, UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { ChecklistModel } from './checklistModel.js';
import { ReminderModel } from './eventModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { configurarAvisoDeTarjeta } from './avisoDeTarjeta.js';
import { runReminderTick, setReminderPushSender } from './reminderCron.js';
import { signSession } from './sessions.js';

/** José 06/11: «a las tareas agrega que se puedan agregar recordatorios x tiempo antes». */
const HOUR_MS = 3_600_000;
let mongo: MongoMemoryServer;
let lead: Types.ObjectId;
let worker: Types.ObjectId;
let spaceId: Types.ObjectId;
let chatId: Types.ObjectId;
let checklistId: string;
let sent: { title: string; body: string }[];
const app = buildApp();
const jwtOf = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: String(userId) })}` });
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();
const patchTask = (body: object, who = lead) => request(app).patch(`/api/agenda/checklists/${checklistId}/items/t1`).set(jwtOf(who)).send(body);
const reminders = () => ReminderModel.find({ 'taskRef.itemId': 't1' }).lean();
const settled = (check: () => Promise<void>) => vi.waitFor(check, { timeout: 2000, interval: 25 });
const noticesOn = () => WorkspaceModel.updateOne({ _id: spaceId }, { $set: { taskNotices: true } });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_task_reminders'));
  setReminderPushSender({ send: async (message) => void sent.push({ title: message.title, body: message.body }) });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), ChecklistModel.deleteMany({}), ReminderModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  sent = [];
  [lead, worker] = (await UserModel.create([{ phone: '900000051', name: 'Lead' }, { phone: '900000052', name: 'Worker' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  await DeviceModel.create({ userId: worker, deviceId: 'phone-worker', pushToken: 'token-worker' });
  spaceId = (await WorkspaceModel.create({ name: 'Obra', ownerId: lead, joinCode: 'OBRA-1234' }))._id;
  chatId = (await ChatModel.create({ kind: 'group', name: 'Canal Vía Sur', workspaceId: spaceId, members: [{ userId: lead }, { userId: worker }], lastSeq: 0 }))._id;
  const checklist = await ChecklistModel.create({ chatId, createdBy: lead, title: 'Ejecución', othersCanMark: true, othersCanAdd: true, items: [{ id: 't1', text: 'Tren de imprimación', addedBy: lead, doneBy: null, doneAt: null }, { id: 't2', text: 'Combustible', addedBy: lead, doneBy: null, doneAt: null }] });
  checklistId = String(checklist._id);
  configurarAvisoDeTarjeta(() => undefined);
});

describe('the reminder of a task', () => {
  it('a task with person, date and its own advance gets one reminder for that person, even with the space off', async () => {
    // Arrange and Act
    const saved = await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60, 15] });
    // Assert
    expect(saved.status).toBe(200);
    expect(saved.body.checklist.items[0].advance).toEqual([60, 15]);
    await settled(async () => expect(await reminders()).toHaveLength(1));
    const [reminder] = await reminders();
    expect(String(reminder!.userId)).toBe(String(worker));
    expect(reminder!.chatId).toBeUndefined();
    await settled(async () => expect((await ChecklistModel.findById(checklistId).lean())?.items[0]?.reminderId).toBeDefined());
  });

  it('moving the date moves the same reminder and it can ring again', async () => {
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60] });
    await settled(async () => expect((await ChecklistModel.findById(checklistId).lean())?.items[0]?.reminderId).toBeDefined());
    const later = inHours(9);

    await patchTask({ dueAt: later });

    await settled(async () => expect((await reminders())[0]?.startsAt.toISOString()).toBe(later));
    expect(await reminders()).toHaveLength(1);
  });

  it('without its own advance it depends on the space: off rings nobody, on gives two hours', async () => {
    await patchTask({ assignee: String(worker), dueAt: inHours(5) });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await reminders()).toHaveLength(0);

    await noticesOn();
    await patchTask({ dueAt: inHours(6) });

    await settled(async () => expect((await reminders())[0]?.advance).toEqual([120]));
  });

  it('choosing none with the space on leaves it without a reminder', async () => {
    await noticesOn();
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await reminders()).toHaveLength(0);
  });

  it('ticking it turns the reminder off and reopening turns it on', async () => {
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60] });
    await settled(async () => expect((await ChecklistModel.findById(checklistId).lean())?.items[0]?.reminderId).toBeDefined());
    const toggle = () => request(app).post(`/api/agenda/checklists/${checklistId}/items/t1/toggle`).set(jwtOf(worker));

    await toggle();
    await settled(async () => expect((await reminders())[0]?.active).toBe(false));
    await toggle();
    await settled(async () => expect((await reminders())[0]?.active).toBe(true));
  });

  it('deleting the task takes its reminder away', async () => {
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60] });
    await settled(async () => expect((await ChecklistModel.findById(checklistId).lean())?.items[0]?.reminderId).toBeDefined());

    await request(app).delete(`/api/agenda/checklists/${checklistId}/items/t1`).set(jwtOf(lead));

    await settled(async () => expect((await reminders())[0]?.active).toBe(false));
  });

  it('rings before it is due, says it is due, and at its hour it ends without ringing', async () => {
    // Arrange
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60] });
    await settled(async () => expect(await reminders()).toHaveLength(1));
    const due = (await reminders())[0]!.startsAt;
    // Act
    await runReminderTick(new Date(due.getTime() - HOUR_MS + 30_000));
    await runReminderTick(new Date(due.getTime() + 10_000));
    // Assert
    expect(sent).toHaveLength(1);
    expect(sent[0]?.title).toBe('Tren de imprimación');
    expect(sent[0]?.body).toContain('Vence en 1 h');
    expect((await reminders())[0]?.active).toBe(false);
  });

  it('it stays out of the person\'s reminder lists', async () => {
    await patchTask({ assignee: String(worker), dueAt: inHours(5), advance: [60] });
    await settled(async () => expect(await reminders()).toHaveLength(1));

    const list = await request(app).get('/api/agenda/reminders').set(jwtOf(worker));

    expect(list.body.mine).toEqual([]);
  });
});

describe('the notice of an assignment', () => {
  it('the space off sends nothing', async () => {
    await patchTask({ assignee: String(worker) });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sent).toEqual([]);
  });

  it('the space on tells the new person once, and nobody for their own assignment', async () => {
    await noticesOn();
    await patchTask({ assignee: String(worker) });
    await settled(async () => expect(sent).toEqual([{ title: 'Canal Vía Sur', body: 'Te asignaron: Tren de imprimación' }]));

    await patchTask({ text: 'Tren de imprimación y regado' });
    await patchTask({ assignee: String(lead) });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sent).toHaveLength(1);
  });
});
