import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';

/** Pending 11: sharing where I am in the chat, like WhatsApp (the fixed location first). */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
let chatId: Types.ObjectId;
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
const share = (body: Record<string, unknown>, chat: Types.ObjectId = chatId) => request(app).post(`/api/chats/${chat}/locations`).set(auth()).send({ clientKey: `k-${Math.random()}`, ...body });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_location_share'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
});

describe('POST /api/chats/:chatId/locations', () => {
  it('saves the point and its accuracy, and the body reads as text', async () => {
    const { body } = await share({ lat: -12.0463741, lng: -77.0427934, accuracy: 12.4 }).expect(201);
    expect(body.message).toMatchObject({ kind: 'location', body: 'Ubicación', location: { lat: -12.046374, lng: -77.042793, accuracy: 12 } });
    const saved = await MessageModel.findOne({ chatId }).lean();
    expect(saved?.location).toEqual({ lat: -12.046374, lng: -77.042793, accuracy: 12 });
  });

  it('a retry with the same key does not duplicate', async () => {
    await share({ lat: 1, lng: 2, clientKey: 'same' }).expect(201);
    const again = await share({ lat: 1, lng: 2, clientKey: 'same' }).expect(201);
    expect(again.body.duplicate).toBe(true);
    await expect(MessageModel.countDocuments({ chatId })).resolves.toBe(1);
  });

  it('an invalid point says why; a secret chat and someone else’s chat are refused', async () => {
    expect((await share({ lat: 120, lng: 2 }).expect(400)).body.message).toBe('Esa ubicación no es válida.');
    const secret = (await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    expect((await share({ lat: 1, lng: 2 }, secret).expect(400)).body.message).toBe('En un chat secreto todavía no se comparte la ubicación.');
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await share({ lat: 1, lng: 2 }, foreign).expect(404);
  });
});
