import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** Pending 9 (José, 20/10): sharing a contact in the chat, like WhatsApp. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
let chatId: Types.ObjectId;
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
const share = (body: Record<string, unknown>, chat: Types.ObjectId = chatId) => request(app).post(`/api/chats/${chat}/contacts`).set(auth()).send({ clientKey: `k-${Math.random()}`, ...body });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_contact_share'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create({ _id: ana, phone: '987654321', name: 'Ana' });
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
});

describe('POST /api/chats/:chatId/contacts', () => {
  it('a contact on Lilachat goes with its user, and the body reads as text', async () => {
    const { body } = await share({ name: 'Ana López', phone: '+51 987 654 321' }).expect(201);
    expect(body.message).toMatchObject({ kind: 'contact', body: 'Contacto: Ana López', contact: { name: 'Ana López', phone: '987654321', userId: String(ana) } });
  });

  it('a contact who is not on Lilachat goes without a user', async () => {
    const { body } = await share({ name: 'Pepe', phone: '912345678' }).expect(201);
    expect(body.message.contact).toEqual({ name: 'Pepe', phone: '912345678' });
  });

  it('a retry with the same key does not duplicate', async () => {
    await share({ name: 'Pepe', phone: '912345678', clientKey: 'same' }).expect(201);
    const again = await share({ name: 'Pepe', phone: '912345678', clientKey: 'same' }).expect(201);
    expect(again.body.duplicate).toBe(true);
    await expect(MessageModel.countDocuments({ chatId })).resolves.toBe(1);
  });

  it('without a name or phone it says why; a secret chat and someone else’s chat are refused', async () => {
    expect((await share({ name: '', phone: '912345678' }).expect(400)).body.message).toBe('El contacto no tiene nombre.');
    const secret = (await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await share({ name: 'Pepe', phone: '912345678' }, secret).expect(400);
    const foreign = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }], lastSeq: 0 }))._id;
    await share({ name: 'Pepe', phone: '912345678' }, foreign).expect(404);
  });
});
