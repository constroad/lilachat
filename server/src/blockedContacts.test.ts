import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { contactIdsOf } from './presenceModes.js';
import { isBlockedChat } from './blockedContacts.js';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';

/** Pending 9: blocked contacts, like WhatsApp. The 1:1 closes both ways; groups stay as they are. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let directId: string;
let groupId: string;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_blocked_contacts_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [me, ana, beto] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }, { phone: '987654322', name: 'Beto' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const direct = await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 0 });
  const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }, { userId: beto, role: 'member' }], lastSeq: 0 });
  directId = String(direct._id);
  groupId = String(group._id);
});

const block = (who: Types.ObjectId, userId: unknown) => request(app).post('/api/me/blocked').set(auth(who)).send({ userId });
const unblock = (who: Types.ObjectId, userId: Types.ObjectId) => request(app).delete(`/api/me/blocked/${userId}`).set(auth(who));

describe('blocked contacts', () => {
  it('blocks a person once, lists them, and refuses myself or nobody', async () => {
    // Arrange + Act
    expect((await block(me, ana)).status).toBe(200);
    expect((await block(me, ana)).status).toBe(200);
    // Assert
    const list = (await request(app).get('/api/me/blocked').set(auth(me)).expect(200)).body.blocked as { id: string; name: string | null }[];
    expect(list).toEqual([expect.objectContaining({ id: String(ana), name: 'Ana' })]);
    expect((await block(me, me)).status).toBe(400);
    expect((await block(me, 'nada')).status).toBe(400);
    expect((await block(me, new Types.ObjectId())).status).toBe(404);
  });

  it('a blocked 1:1 refuses both sides, each with its own words; the group still goes', async () => {
    await block(me, ana).expect(200);
    await expect(sendMessage({ chatId: directId, senderId: me, clientKey: 'm1', body: 'hola' })).rejects.toThrow('Desbloquea este contacto para escribirle.');
    await expect(sendMessage({ chatId: directId, senderId: ana, clientKey: 'a1', body: 'hola' })).rejects.toThrow('No se pudo entregar el mensaje.');
    await sendMessage({ chatId: groupId, senderId: ana, clientKey: 'g1', body: 'en el grupo sí' });
    expect(await MessageModel.countDocuments({ chatId: directId })).toBe(0);
    expect(await MessageModel.countDocuments({ chatId: groupId })).toBe(1);
  });

  it('the detail tells me I blocked them, and never tells them', async () => {
    await block(me, ana).expect(200);
    expect((await request(app).get(`/api/chats/${directId}/detail`).set(auth(me)).expect(200)).body.blockedByMe).toBe(true);
    expect((await request(app).get(`/api/chats/${directId}/detail`).set(auth(ana)).expect(200)).body.blockedByMe).toBe(false);
  });

  it('unblocking opens the 1:1 again, but not while the other one still blocks me', async () => {
    await block(me, ana).expect(200);
    await block(ana, me).expect(200);
    await unblock(me, ana).expect(200);
    await expect(sendMessage({ chatId: directId, senderId: me, clientKey: 'm1', body: 'hola' })).rejects.toThrow('No se pudo entregar el mensaje.');
    await unblock(ana, me).expect(200);
    await sendMessage({ chatId: directId, senderId: me, clientKey: 'm2', body: 'hola' });
    expect((await request(app).get('/api/me/blocked').set(auth(me)).expect(200)).body.blocked).toEqual([]);
  });

  it('a 1:1 opened after the block is born closed', async () => {
    await block(beto, me).expect(200);
    const created = await request(app).post('/api/chats').set(auth(me)).send({ kind: 'direct', memberIds: [String(beto)] }).expect(201);
    await expect(sendMessage({ chatId: created.body.chatId, senderId: me, clientKey: 'm1', body: 'hola' })).rejects.toThrow('No se pudo entregar el mensaje.');
  });

  it('a call offer in the blocked 1:1 rings nobody; the group still can', async () => {
    expect(await isBlockedChat(directId)).toBe(false);
    await block(ana, me).expect(200);
    expect(await isBlockedChat(directId)).toBe(true);
    expect(await isBlockedChat(groupId)).toBe(false);
  });

  it('presence goes to neither side of a block', async () => {
    await block(me, ana).expect(200);
    expect(await contactIdsOf(me)).toEqual([String(beto)]);
    expect(await contactIdsOf(ana)).toEqual([String(beto)]);
  });
});
