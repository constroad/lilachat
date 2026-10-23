import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { announceBirthdays } from '../src/birthdays.js';

/** Pending 17 (José, 20/10): birthdays in chats, on by chat, announced once a day. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const admin = new Types.ObjectId();
const carla = new Types.ObjectId();
const beto = new Types.ObjectId();
let group: Types.ObjectId;
let direct: Types.ObjectId;
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
// 13:30 UTC on 22/10 is 8:30 in Lima.
const morning = new Date('2026-10-22T13:30:00.000Z');

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_birthdays'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create([
    { _id: admin, phone: '900000001', name: 'Admin' },
    { _id: carla, phone: '900000002', name: 'Carla', birthday: { day: 22, month: 10, year: 1997 }, birthdayVisible: true },
    { _id: beto, phone: '900000003', name: 'Beto', birthday: { day: 22, month: 10 }, birthdayVisible: false },
  ]);
  group = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: admin, role: 'admin' }, { userId: carla, role: 'member' }, { userId: beto, role: 'member' }], lastSeq: 0 }))._id;
  direct = (await ChatModel.create({ kind: 'direct', members: [{ userId: carla, role: 'member' }, { userId: beto, role: 'member' }], lastSeq: 0 }))._id;
});

describe('PATCH /api/chats/:id/birthdays', () => {
  it('a group admin turns them on; a member cannot', async () => {
    await request(app).patch(`/api/chats/${group}/birthdays`).set(auth(carla)).send({ on: true }).expect(403);
    const { body } = await request(app).patch(`/api/chats/${group}/birthdays`).set(auth(admin)).send({ on: true }).expect(200);
    expect(body).toEqual({ ok: true, birthdaysOn: true });
    expect((await ChatModel.findById(group).lean())?.birthdaysOn).toBe(true);
  });

  it('in a 1:1 either of the two decides', async () => {
    await request(app).patch(`/api/chats/${direct}/birthdays`).set(auth(beto)).send({ on: true }).expect(200);
  });
});

describe('announceBirthdays', () => {
  it('at 8:00 in Lima: «Hoy cumple Carla · 29 años» in the chats that have them on, once', async () => {
    // Arrange
    await ChatModel.updateMany({}, { $set: { birthdaysOn: true } });
    // Act
    await announceBirthdays(morning);
    await announceBirthdays(morning);
    // Assert
    const notices = await MessageModel.find({ 'system.evento': 'cumpleanos' }).lean();
    expect(notices.map((notice) => [String(notice.chatId), String(notice.senderId), notice.body])).toEqual(
      expect.arrayContaining([[String(group), String(carla), '🎂 Hoy cumple Carla · 29 años'], [String(direct), String(carla), '🎂 Hoy cumple Carla · 29 años']])
    );
    expect(notices).toHaveLength(2);
  });

  it('nothing before 8:00, nothing in chats without them, nothing for a hidden birthday', async () => {
    await announceBirthdays(new Date('2026-10-22T12:00:00.000Z'));
    expect(await MessageModel.countDocuments({})).toBe(0);
    await announceBirthdays(morning);
    expect(await MessageModel.countDocuments({})).toBe(0);
  });
});
