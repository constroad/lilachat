import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { ChecklistModel } from '../src/checklistModel.js';
import { EventModel, PollModel, ReminderModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** Backlog 36 (José, 21/10): what is pending for me in a chat, derived, never an inbox. */
const app = buildApp();
const HOUR = 3_600_000;
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
let chat: Types.ObjectId;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);
const task = (text: string, change: Record<string, unknown>) => ({ id: text, text, addedBy: ana, doneBy: null, doneAt: null, ...change });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_queue'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel, ChatModel, MessageModel, ChecklistModel, EventModel, PollModel, ReminderModel].map((model) => (model as typeof UserModel).deleteMany({})));
  [me, ana] = (await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Ana' }])).map((user) => user._id);
  chat = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'admin' }], lastSeq: 9 }))._id;
});

describe('GET /api/agenda/queue', () => {
  it('my late tasks, polls I did not vote, events I did not answer and reminders that rang today, with their cards', async () => {
    const checklist = await ChecklistModel.create({
      chatId: chat,
      createdBy: ana,
      title: 'Vaciado de losa',
      othersCanMark: true,
      othersCanAdd: false,
      cardSeq: 5,
      items: [
        task('Acero', { assignee: me, dueAt: ago(16) }),
        task('Encofrado', { assignee: me, dueAt: new Date(Date.now() + 5 * HOUR) }),
        task('Curado', { assignee: ana, dueAt: ago(5) }),
        task('Bomba', { assignee: me, dueAt: ago(3), doneBy: me, doneAt: new Date() }),
      ],
    });
    const poll = await PollModel.create({ chatId: chat, question: '¿Turno de noche?', options: [{ text: 'Sí', votes: [] }, { text: 'No', votes: [ana] }], allowMultiple: false, anonymous: false, createdBy: ana });
    await PollModel.create({ chatId: chat, question: 'Ya voté', options: [{ text: 'Sí', votes: [me] }], allowMultiple: false, anonymous: false, createdBy: ana });
    const event = await EventModel.create({ chatId: chat, title: 'Vaciado del cuarto piso', startsAt: new Date(Date.now() + 4 * HOUR), createdBy: ana, attendees: [{ userId: me }, { userId: ana, rsvp: 'yes' }], remindMinutesBefore: 30, remindGuests: true, guestsCanInvite: false });
    const reminder = await ReminderModel.create({ userId: ana, chatId: chat, title: 'Pedir el mixer', startsAt: ago(2), recurrence: 'once', active: false });
    await ReminderModel.create({ userId: ana, chatId: chat, title: 'De anteayer', startsAt: ago(50), recurrence: 'once', active: false });
    await MessageModel.create([
      { chatId: chat, seq: 6, senderId: ana, clientKey: 'p', kind: 'poll', body: '', at: new Date(), ref: { tipo: 'encuesta', id: String(poll._id) } },
      { chatId: chat, seq: 7, senderId: ana, clientKey: 'e', kind: 'event', body: '', at: new Date(), ref: { tipo: 'evento', id: String(event._id) } },
    ]);

    const { items } = (await request(app).get('/api/agenda/queue').query({ chatId: String(chat) }).set(auth(me)).expect(200)).body;
    expect(items).toEqual([
      expect.objectContaining({ kind: 'task', title: 'Acero', context: 'Vaciado de losa', checklistId: String(checklist._id), itemId: 'Acero', canPostpone: false, seq: 5 }),
      expect.objectContaining({ kind: 'event', title: 'Vaciado del cuarto piso', eventId: String(event._id), seq: 7 }),
      expect.objectContaining({ kind: 'poll', title: '¿Turno de noche?', pollId: String(poll._id), seq: 6 }),
      expect.objectContaining({ kind: 'reminder', title: 'Pedir el mixer', reminderId: String(reminder._id) }),
    ]);
    // The key carries the date: a task moved to another day comes back after being dismissed.
    expect(items[0].key).toContain(items[0].at);
  });

  it('nothing pending, an empty queue; outside the chat, 403; without a session, 401', async () => {
    expect((await request(app).get('/api/agenda/queue').query({ chatId: String(chat) }).set(auth(me)).expect(200)).body).toEqual({ items: [] });
    const stranger = (await UserModel.create({ phone: '900000003', name: 'Otro' }))._id;
    await request(app).get('/api/agenda/queue').query({ chatId: String(chat) }).set(auth(stranger)).expect(403);
    await request(app).get('/api/agenda/queue').query({ chatId: 'nope' }).set(auth(me)).expect(403);
    await request(app).get('/api/agenda/queue').query({ chatId: String(chat) }).expect(401);
  });

  it('the author of the checklist (or one that lets others add) can postpone; my own poll and event do not queue', async () => {
    await ChecklistModel.create({ chatId: chat, createdBy: me, title: 'Mío', othersCanMark: true, othersCanAdd: false, items: [task('Revisar', { assignee: me, dueAt: ago(1) })] });
    await PollModel.create({ chatId: chat, question: 'La mía', options: [{ text: 'Sí', votes: [] }], allowMultiple: false, anonymous: false, createdBy: me });
    const { items } = (await request(app).get('/api/agenda/queue').query({ chatId: String(chat) }).set(auth(me)).expect(200)).body;
    expect(items).toEqual([expect.objectContaining({ kind: 'task', title: 'Revisar', canPostpone: true })]);
  });
});
