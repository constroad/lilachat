import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { notificationLevelsOf } from './pushService.js';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';

/** Pending 17 (design `automatizaciones`): a chat quiet on a schedule, and a note for the next time I talk to someone. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
let directId: string;
let groupId: string;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const ALWAYS = { days: [0, 1, 2, 3, 4, 5, 6], from: '00:00', to: '23:59', tz: 'America/Lima' };

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_routines_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({})]);
  [me, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  directId = String((await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id);
  groupId = String((await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id);
});

const put = (who: Types.ObjectId, chatId: string, body: object) => request(app).put(`/api/chats/${chatId}/routines`).set(auth(who)).send(body);

describe('routines', () => {
  it('quiet hours are mine only: the push to me goes quiet, not to the others', async () => {
    await put(me, groupId, { quietHours: ALWAYS }).expect(200);
    const levels = await notificationLevelsOf(groupId, [String(me), String(ana)]);
    expect(levels.get(String(me))).toBe('nada');
    expect(levels.get(String(ana))).toBe('todo');
  });

  it('a bad schedule, a note in a group, or a chat that is not mine is refused', async () => {
    expect((await put(me, groupId, { quietHours: { days: [], from: '18:00', to: '08:00', tz: 'America/Lima' } })).status).toBe(400);
    expect((await put(me, groupId, { contactNote: { text: 'hola' } })).status).toBe(400);
    expect((await put(me, groupId, {})).status).toBe(400);
    const stranger = (await UserModel.create({ phone: '987654322', name: 'Beto' }))._id;
    expect((await put(stranger, groupId, { quietHours: ALWAYS })).status).toBe(404);
  });

  it('the note for the next time I talk to Ana: only I see it, in the detail and the list; null clears it', async () => {
    await put(me, directId, { contactNote: { text: 'Preguntarle por la factura' } }).expect(200);
    expect((await request(app).get(`/api/chats/${directId}/detail`).set(auth(me)).expect(200)).body.routines).toEqual({ contactNote: { text: 'Preguntarle por la factura' } });
    expect((await request(app).get(`/api/chats/${directId}/detail`).set(auth(ana)).expect(200)).body.routines).toBeUndefined();
    await put(me, groupId, { quietHours: ALWAYS }).expect(200);
    const list = (await request(app).get('/api/routines').set(auth(me)).expect(200)).body.routines as { chatId: string; quietHours?: object; contactNote?: object }[];
    expect(list).toHaveLength(2);
    expect(list.find((one) => one.chatId === directId)).toMatchObject({ name: 'Ana', contactNote: { text: 'Preguntarle por la factura' } });
    expect(list.find((one) => one.chatId === groupId)).toMatchObject({ name: 'Obra', quietHours: ALWAYS });
    await put(me, directId, { contactNote: null }).expect(200);
    expect((await request(app).get('/api/routines').set(auth(me)).expect(200)).body.routines).toHaveLength(1);
  });
});
