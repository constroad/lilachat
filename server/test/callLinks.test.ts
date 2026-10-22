import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { EventModel } from '../src/eventModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';
import { readCallLink, signCallLink } from '../src/callLinks.js';

/** Pending 42 (José, 22/10): a call link and a scheduled call, like WhatsApp. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
const stranger = new Types.ObjectId();
let direct: Types.ObjectId;
let group: Types.ObjectId;
const auth = (userId: Types.ObjectId = me) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_call_links'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({}), EventModel.deleteMany({})]);
  await UserModel.create([{ _id: me, phone: '900000001', name: 'José' }, { _id: ana, phone: '900000002', name: 'Ana' }]);
  direct = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  group = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
});

describe('call link tokens', () => {
  it('a signed token reads back its chat and kind', () => {
    const token = signCallLink({ chatId: String(direct), video: true }, 'secret');
    expect(readCallLink(token, 'secret')).toEqual({ chatId: String(direct), video: true });
  });

  it('a changed token or another secret reads as nothing', () => {
    const token = signCallLink({ chatId: String(direct), video: false }, 'secret');
    expect(readCallLink(token.replace('-a-', '-v-'), 'secret')).toBeNull();
    expect(readCallLink(token, 'other')).toBeNull();
    expect(readCallLink('garbage', 'secret')).toBeNull();
  });
});

describe('POST /api/chats/:id/call-link and GET /api/call-links/:token', () => {
  it('makes a link in a 1:1 chat that the other person can open', async () => {
    // Arrange
    const { body } = await request(app).post(`/api/chats/${direct}/call-link`).set(auth()).send({ video: true }).expect(201);
    const token = body.url.split('/llamada/')[1];
    // Act
    const opened = await request(app).get(`/api/call-links/${token}`).set(auth(ana)).expect(200);
    // Assert
    expect(body.url).toMatch(/^https:\/\/lilachat\.constroad\.com\/llamada\//);
    expect(opened.body).toMatchObject({ chatId: String(direct), video: true, name: 'José' });
  });

  it('a group has no calls yet: no link', async () => {
    const { body } = await request(app).post(`/api/chats/${group}/call-link`).set(auth()).send({}).expect(400);
    expect(body.message).toBe('Las llamadas son solo en chats de dos personas.');
  });

  it('someone outside the chat cannot make or open one', async () => {
    await request(app).post(`/api/chats/${direct}/call-link`).set(auth(stranger)).send({}).expect(403);
    const { body } = await request(app).post(`/api/chats/${direct}/call-link`).set(auth()).send({}).expect(201);
    const denied = await request(app).get(`/api/call-links/${body.url.split('/llamada/')[1]}`).set(auth(stranger)).expect(403);
    expect(denied.body.message).toBe('Este enlace es de una conversación en la que no estás.');
  });

  it('a link that is not valid says so', async () => {
    const { body } = await request(app).get('/api/call-links/nope').set(auth()).expect(404);
    expect(body.message).toBe('Este enlace de llamada no es válido.');
  });
});

describe('scheduled call (an event with call)', () => {
  const startsAt = new Date(Date.now() + 3_600_000).toISOString();

  it('in a 1:1 it is saved with call and its line says so', async () => {
    const { body } = await request(app).post('/api/agenda/events').set(auth()).send({ chatId: String(direct), title: 'Videollamada con Ana', startsAt, call: { video: true }, remindMinutesBefore: 5 }).expect(201);
    const event = await EventModel.findById(body.id).lean();
    const line = await MessageModel.findOne({ chatId: direct }).lean();
    expect(event?.call).toEqual({ video: true });
    expect(line?.body).toBe('Llamada programada: Videollamada con Ana');
  });

  it('in a group it is refused', async () => {
    const { body } = await request(app).post('/api/agenda/events').set(auth()).send({ chatId: String(group), title: 'Llamada', startsAt, call: { video: false } }).expect(400);
    expect(body.message).toBe('Las llamadas son solo en chats de dos personas.');
  });
});
