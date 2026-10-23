import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import { buildApp } from '../src/app.js';
import { ChatModel } from '../src/chatModels.js';
import { UserModel } from '../src/models.js';
import { signSession } from '../src/sessions.js';

/** Pending 45 (José, 22/10): lists of chats of one's own, like Telegram's folders. */
const app = buildApp({});
let mongo: MongoMemoryServer;
const me = new Types.ObjectId();
const ana = new Types.ObjectId();
let mine: Types.ObjectId;
let notMine: Types.ObjectId;
const auth = () => ({ Authorization: `Bearer ${signSession({ userId: String(me), deviceId: 'd-me', email: 'x' })}` });
const create = (body: Record<string, unknown>) => request(app).post('/api/chat-lists').set(auth()).send(body);

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_chat_lists'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), UserModel.deleteMany({})]);
  await UserModel.create([{ _id: me, phone: '900000001' }, { _id: ana, phone: '900000002' }]);
  mine = (await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 }))._id;
  notMine = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana, role: 'member' }, { userId: new Types.ObjectId(), role: 'member' }], lastSeq: 0 }))._id;
});

describe('/api/chat-lists', () => {
  it('creates a list with my chats and reads it back', async () => {
    // Arrange / Act
    const { body } = await create({ name: ' Familia ', chatIds: [String(mine)] }).expect(201);
    const listed = await request(app).get('/api/chat-lists').set(auth()).expect(200);
    // Assert
    expect(body.list).toMatchObject({ name: 'Familia', chatIds: [String(mine)] });
    expect(listed.body.lists).toEqual([body.list]);
  });

  it('a chat I am not in never goes into my list', async () => {
    const { body } = await create({ name: 'Amigos', chatIds: [String(mine), String(notMine), 'not-an-id'] }).expect(201);
    expect(body.list.chatIds).toEqual([String(mine)]);
  });

  it('refuses a repeated or empty name with the reason', async () => {
    await create({ name: 'Familia' }).expect(201);
    const repeated = await create({ name: 'familia' }).expect(400);
    const empty = await create({ name: '' }).expect(400);
    expect(repeated.body.message).toBe('Ya tienes una sección con ese nombre.');
    expect(empty.body.message).toBe('Escribe un nombre para la sección.');
  });

  it('renames, adds and removes chats', async () => {
    const { body: created } = await create({ name: 'Obra' }).expect(201);
    const { body: added } = await request(app).patch(`/api/chat-lists/${created.list.id}`).set(auth()).send({ name: 'Obra Miraflores', add: [String(mine)] }).expect(200);
    const { body: removed } = await request(app).patch(`/api/chat-lists/${created.list.id}`).set(auth()).send({ remove: [String(mine)] }).expect(200);
    expect(added.list).toMatchObject({ name: 'Obra Miraflores', chatIds: [String(mine)] });
    expect(removed.list.chatIds).toEqual([]);
  });

  it('deletes a list', async () => {
    const { body } = await create({ name: 'Temporal' }).expect(201);
    await request(app).delete(`/api/chat-lists/${body.list.id}`).set(auth()).expect(200);
    const listed = await request(app).get('/api/chat-lists').set(auth()).expect(200);
    expect(listed.body.lists).toEqual([]);
  });

  it('someone else\'s list or a made-up id is not found', async () => {
    await request(app).patch(`/api/chat-lists/${new Types.ObjectId()}`).set(auth()).send({ name: 'X' }).expect(404);
    await request(app).delete('/api/chat-lists/nope').set(auth()).expect(404);
  });

  it('puts the lists in the order given', async () => {
    const first = (await create({ name: 'Uno' })).body.list.id;
    const second = (await create({ name: 'Dos' })).body.list.id;
    const { body } = await request(app).put('/api/chat-lists/order').set(auth()).send({ ids: [second, first] }).expect(200);
    expect(body.lists.map((list: { name: string }) => list.name)).toEqual(['Dos', 'Uno']);
  });

  it('stops at 20 lists', async () => {
    await UserModel.updateOne({ _id: me }, { $set: { chatLists: Array.from({ length: 20 }, (_, index) => ({ name: `L${index}`, chatIds: [] })) } });
    const { body } = await create({ name: 'Una más' }).expect(400);
    expect(body.message).toBe('Puedes tener hasta 20 secciones.');
  });

  it('without a session there is nothing', async () => {
    await request(app).get('/api/chat-lists').expect(401);
  });
});
