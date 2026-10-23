import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { signSession } from './sessions.js';

/** Pending 62 (José, 23/10): the lists are Slack's sections, so a chat is in one only. */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let chats: string[];
const app = buildApp();
const jwtOf = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: String(userId) })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_chat_lists'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({})]);
  const [first, second] = await UserModel.create([{ phone: '900000021', name: 'Ana' }, { phone: '900000022', name: 'Beto' }]);
  ana = first!._id;
  const created = await ChatModel.create([0, 1, 2].map(() => ({ kind: 'direct', members: [{ userId: ana }, { userId: second!._id }], lastSeq: 0 })));
  chats = created.map((chat) => String(chat._id));
});

const createList = (name: string, chatIds: string[]) => request(app).post('/api/chat-lists').set(jwtOf(ana)).send({ name, chatIds });

describe('a chat lives in one section (pending 62)', () => {
  it('adding a chat to a section takes it out of the one it was in, and the answer brings every section', async () => {
    const obra = (await createList('Obra', [chats[0]!, chats[1]!])).body.list;
    const familia = (await createList('Familia', [])).body.list;
    const moved = await request(app).patch(`/api/chat-lists/${familia.id}`).set(jwtOf(ana)).send({ add: [chats[0]] });
    expect(moved.status).toBe(200);
    expect(moved.body.lists.map((list: { name: string; chatIds: string[] }) => [list.name, list.chatIds])).toEqual([['Obra', [chats[1]]], ['Familia', [chats[0]]]]);
    const saved = (await request(app).get('/api/chat-lists').set(jwtOf(ana))).body.lists;
    expect(saved.find((list: { id: string }) => list.id === obra.id).chatIds).toEqual([chats[1]]);
  });

  it('a new section with chats takes them from the others too', async () => {
    await createList('Obra', [chats[0]!, chats[2]!]);
    const created = await createList('Proveedores', [chats[2]!]);
    expect(created.status).toBe(201);
    expect(created.body.lists.map((list: { chatIds: string[] }) => list.chatIds)).toEqual([[chats[0]], [chats[2]]]);
  });

  it('renaming only, without chats, touches no other section', async () => {
    await createList('Obra', [chats[0]!]);
    const familia = (await createList('Familia', [chats[1]!])).body.list;
    const renamed = await request(app).patch(`/api/chat-lists/${familia.id}`).set(jwtOf(ana)).send({ name: 'Casa' });
    expect(renamed.body.lists.map((list: { name: string; chatIds: string[] }) => [list.name, list.chatIds])).toEqual([['Obra', [chats[0]]], ['Casa', [chats[1]]]]);
  });
});
