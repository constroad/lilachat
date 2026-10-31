import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { setDisappearing, sweepDisappeared } from './disappearingMessages.js';
import { signSession } from './sessions.js';

/** R31/10-B6: disappearing messages, 24 hours, 7 days or 90 days. */
let mongo: MongoMemoryServer;
const app = buildApp();
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let direct: Types.ObjectId;
let group: Types.ObjectId;
const DAY_MS = 86_400_000;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '51900000901', name: 'Ana' },
    { phone: '51900000902', name: 'Beto' },
    { phone: '51900000903', name: 'Carla' },
  ]);
  [ana, beto, carla] = users.map((user) => user._id as Types.ObjectId) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const chats = await ChatModel.create([
    { kind: 'direct', members: [{ userId: ana }, { userId: beto }] },
    { kind: 'group', name: 'Obra', members: [{ userId: ana, role: 'admin' }, { userId: beto, role: 'member' }], memberPermissions: { editInfo: false } },
  ]);
  [direct, group] = chats.map((chat) => chat._id as Types.ObjectId) as [Types.ObjectId, Types.ObjectId];
});

const send = (chatId: Types.ObjectId, from: Types.ObjectId, key: string) => sendMessage({ chatId: String(chatId), senderId: from, clientKey: key, body: key });

describe('the timer of a chat', () => {
  it('either member of a 1:1 turns it on; the route writes the notice and the chat keeps its seconds', async () => {
    // Arrange
    const token = signSession({ userId: String(beto), deviceId: 'd-beto', email: '51900000902' });
    // Act
    const response = await request(app).put(`/api/chats/${direct}/disappearing`).set('Authorization', `Bearer ${token}`).send({ key: '7d' });
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, key: '7d' });
    expect((await ChatModel.findById(direct).lean())?.disappearSeconds).toBe(604_800);
    const notice = await MessageModel.findOne({ chatId: direct, kind: 'system' }).lean();
    expect(notice?.system).toMatchObject({ evento: 'temporales', valor: '7d' });
  });

  it('refuses an unknown key, a stranger, a member without «Editar la info» and a channel', async () => {
    // Arrange
    const asCarla = signSession({ userId: String(carla), deviceId: 'd-carla', email: '51900000903' });
    const channel = await ChatModel.create({ kind: 'group', name: 'general', channel: { visibility: 'public' }, members: [{ userId: ana, role: 'admin' }] });
    // Act
    const unknown = await request(app).put(`/api/chats/${direct}/disappearing`).set('Authorization', `Bearer ${signSession({ userId: String(ana), deviceId: 'd-ana', email: '51900000901' })}`).send({ key: '1y' });
    const stranger = await request(app).put(`/api/chats/${direct}/disappearing`).set('Authorization', `Bearer ${asCarla}`).send({ key: '24h' });
    const member = await setDisappearing({ chatId: String(group), userId: beto, key: '24h' });
    const inChannel = await setDisappearing({ chatId: String(channel._id), userId: ana, key: '24h' });
    // Assert
    expect(unknown.status).toBe(400);
    expect(stranger.status).toBe(404);
    expect(member).toMatchObject({ ok: false, status: 403 });
    expect(inChannel).toMatchObject({ ok: false, status: 409 });
  });

  it('setting the same value again changes nothing and writes no second notice', async () => {
    // Act
    await setDisappearing({ chatId: String(group), userId: ana, key: '24h' });
    const again = await setDisappearing({ chatId: String(group), userId: ana, key: '24h' });
    const off = await setDisappearing({ chatId: String(group), userId: ana, key: 'off' });
    // Assert
    expect(again).toMatchObject({ ok: true, changed: false });
    expect(off).toMatchObject({ ok: true, changed: true });
    expect((await ChatModel.findById(group).lean())?.disappearSeconds).toBeUndefined();
  });
});

describe('sending and sweeping', () => {
  it('stamps only the messages sent while it is on, and moves the chat to the soonest end', async () => {
    // Arrange
    const before = await send(direct, ana, 'antes');
    await setDisappearing({ chatId: String(direct), userId: ana, key: '24h' });
    // Act
    const during = await send(direct, beto, 'durante');
    // Assert
    expect(before.message.disappearsAt).toBeUndefined();
    const end = during.message.disappearsAt!.getTime();
    expect(Math.abs(end - (during.message.at.getTime() + DAY_MS))).toBeLessThan(1_000);
    expect((await ChatModel.findById(direct).lean())?.nextDisappearAt?.getTime()).toBe(end);
  });

  it('the sweep empties what is due, keeps its end so devices hide it, and leaves the rest', async () => {
    // Arrange
    await setDisappearing({ chatId: String(direct), userId: ana, key: '24h' });
    const first = await send(direct, ana, 'uno');
    const second = await send(direct, beto, 'dos');
    await MessageModel.updateOne({ chatId: direct, seq: second.message.seq }, { $set: { disappearsAt: new Date(Date.now() + 3 * DAY_MS) } });
    // Act
    const swept = await sweepDisappeared(new Date(Date.now() + 2 * DAY_MS));
    // Assert
    expect(swept).toBe(1);
    const gone = await MessageModel.findOne({ chatId: direct, seq: first.message.seq }).lean();
    expect(gone?.deletedAt).toBeDefined();
    expect(gone?.body).toBeUndefined();
    expect(gone?.disappearsAt).toBeDefined();
    expect((await MessageModel.findOne({ chatId: direct, seq: second.message.seq }).lean())?.body).toBe('dos');
    expect((await ChatModel.findById(direct).lean())?.nextDisappearAt?.getTime()).toBeGreaterThan(Date.now() + 2 * DAY_MS);
  });

  it('turning it off keeps the ends already stamped: those still go', async () => {
    // Arrange
    await setDisappearing({ chatId: String(direct), userId: ana, key: '24h' });
    await send(direct, ana, 'uno');
    await setDisappearing({ chatId: String(direct), userId: ana, key: 'off' });
    const after = await send(direct, ana, 'después');
    // Act
    const swept = await sweepDisappeared(new Date(Date.now() + 2 * DAY_MS));
    // Assert
    expect(swept).toBe(1);
    expect(after.message.disappearsAt).toBeUndefined();
    expect((await ChatModel.findById(direct).lean())?.nextDisappearAt).toBeUndefined();
  });
});
