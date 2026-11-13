import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { HiddenMessagesModel } from './hiddenMessages.js';
import { signSession } from './sessions.js';

/**
 * «Eliminar para mí» on every device of the person (José, 13/11: two computers
 * with the web, he deleted in one and kept seeing them in the other). The
 * server keeps which `seq` each person hid in each chat; nobody else is told.
 */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let wilson: Types.ObjectId;
let outsider: Types.ObjectId;
let chatId: Types.ObjectId;
const withJwt = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });
const app = buildApp({});

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_hidden_messages'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), HiddenMessagesModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '900000001', name: 'José' }, { phone: '900000002', name: 'Wilson' }, { phone: '900000003', name: 'Otro' }]);
  [me, wilson, outsider] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  chatId = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: wilson, role: 'member' }], lastSeq: 9 }))._id;
});

describe('«Eliminar para mí» kept on the server', () => {
  it('what I hide comes back to my other device, once per seq, and not to the other member', async () => {
    // Arrange / Act
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: [3, 5] }).expect(200);
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: [5, 7] }).expect(200);
    // Assert
    const mine = await request(app).get(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).expect(200);
    expect([...mine.body.seqs].sort((a: number, b: number) => a - b)).toEqual([3, 5, 7]);
    const his = await request(app).get(`/api/chats/${chatId}/ocultos`).set(withJwt(wilson)).expect(200);
    expect(his.body.seqs).toEqual([]);
  });

  it('someone outside the chat can neither hide nor read', async () => {
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(outsider)).send({ seqs: [3] }).expect(403);
    await request(app).get(`/api/chats/${chatId}/ocultos`).set(withJwt(outsider)).expect(403);
  });

  it('a list that is not positive whole seqs, or too long, is refused', async () => {
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: [] }).expect(400);
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: ['3'] }).expect(400);
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: [-1] }).expect(400);
    await request(app).post(`/api/chats/${chatId}/ocultos`).set(withJwt(me)).send({ seqs: Array.from({ length: 501 }, (_, index) => index + 1) }).expect(400);
  });

  it('a bad chat id is a 403, not a crash', async () => {
    await request(app).get('/api/chats/nope/ocultos').set(withJwt(me)).expect(403);
  });
});
