import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';

/** Pending 11: live location, 15 min / 1 h / 8 h, like WhatsApp. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
let chatId: Types.ObjectId;
const auth = (userId: Types.ObjectId = me) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const start = (body: Record<string, unknown> = {}) => request(app).post(`/api/chats/${chatId}/locations`).set(auth()).send({ clientKey: `k-${Math.random()}`, lat: -12.0464, lng: -77.0428, liveMinutes: 15, ...body });
const move = (seq: number, who: Types.ObjectId = me) => request(app).put(`/api/chats/${chatId}/locations/${seq}`).set(auth(who)).send({ lat: -12.05, lng: -77.04, accuracy: 8 });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_live_location'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
});

describe('live location', () => {
  it('starts with an end time from the chosen duration; a duration that is not offered is refused', async () => {
    const before = Date.now();
    const { body } = await start().expect(201);
    const until = new Date(body.message.location.liveUntil).getTime();
    expect(until - before).toBeGreaterThanOrEqual(15 * 60_000 - 1_000);
    expect(until - before).toBeLessThanOrEqual(15 * 60_000 + 5_000);
    await start({ liveMinutes: 7 }).expect(400);
  });

  it('its author moves the point while it lasts; nobody else can', async () => {
    const { body } = await start().expect(201);
    const seq = body.message.seq;

    await move(seq, ana).expect(403);
    const moved = await move(seq).expect(200);
    expect(moved.body.location).toMatchObject({ lat: -12.05, lng: -77.04, accuracy: 8 });
    expect((await MessageModel.findOne({ chatId, seq }).lean())?.location).toMatchObject({ lat: -12.05, lng: -77.04 });
  });

  it('stopping ends it, and then a move answers 410 so the phone stops sending', async () => {
    const { body } = await start().expect(201);
    const seq = body.message.seq;

    await request(app).post(`/api/chats/${chatId}/locations/${seq}/stop`).set(auth()).expect(200);
    expect((await MessageModel.findOne({ chatId, seq }).lean())?.location?.endedAt).toBeInstanceOf(Date);
    await move(seq).expect(410);
  });

  it('past its end time it does not move either', async () => {
    const { body } = await start().expect(201);
    await MessageModel.updateOne({ chatId, seq: body.message.seq }, { $set: { 'location.liveUntil': new Date(Date.now() - 1_000) } });
    await move(body.message.seq).expect(410);
  });

  it('a fixed location is not moved', async () => {
    const { body } = await start({ liveMinutes: undefined }).expect(201);
    expect(body.message.location.liveUntil).toBeUndefined();
    await move(body.message.seq).expect(410);
  });
});
