import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';

/** Pending 8 (design permisos-admin): what the members of a group may do, set by its admins. */
let mongo: MongoMemoryServer;
let admin: Types.ObjectId;
let member: Types.ObjectId;
let outsider: Types.ObjectId;
let groupId: string;
const app = buildApp();
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_group_permissions_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  [admin, member, outsider] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }, { phone: '987654322', name: 'Beto' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
  const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: admin, role: 'admin' }, { userId: member, role: 'member' }], lastSeq: 0 });
  groupId = String(group._id);
});

const setPermissions = (who: Types.ObjectId, body: object) => request(app).patch(`/api/chats/${groupId}/permissions`).set(auth(who)).send(body);

describe('group permissions', () => {
  it('only an admin changes them; the detail and the list carry them', async () => {
    expect((await setPermissions(member, { sendMessages: false })).status).toBe(403);
    expect((await setPermissions(admin, { nada: true })).status).toBe(400);
    const changed = await setPermissions(admin, { sendMessages: false, pinMessages: true });
    expect(changed.status).toBe(200);
    expect(changed.body.memberPermissions).toEqual({ editInfo: true, sendMessages: false, addMembers: true, pinMessages: true });
    const list = (await request(app).get('/api/chats').set(auth(member)).expect(200)).body.chats as { id: string; memberPermissions?: object }[];
    expect(list.find((chat) => chat.id === groupId)?.memberPermissions).toMatchObject({ sendMessages: false });
  });

  it('«send messages» off: a member cannot write, an admin can, and a bot reply still goes', async () => {
    await setPermissions(admin, { sendMessages: false }).expect(200);
    await expect(sendMessage({ chatId: groupId, senderId: member, clientKey: 'm1', body: 'hola' })).rejects.toThrow('Solo los admins pueden enviar mensajes en este grupo.');
    await sendMessage({ chatId: groupId, senderId: admin, clientKey: 'a1', body: 'aviso' });
    await sendMessage({ chatId: groupId, senderId: member, clientKey: 'b1', body: 'del bot', skipMemberPermissions: true });
    expect(await MessageModel.countDocuments({ chatId: groupId })).toBe(2);
  });

  it('«edit info» and «add members» off: a member is refused with the reason; an admin can', async () => {
    await setPermissions(admin, { editInfo: false, addMembers: false }).expect(200);
    const rename = await request(app).patch(`/api/chats/${groupId}`).set(auth(member)).send({ name: 'Otro' });
    expect(rename.status).toBe(400);
    expect(rename.body.message).toBe('Solo los admins pueden cambiar la info de este grupo.');
    const add = await request(app).post(`/api/chats/${groupId}/members`).set(auth(member)).send({ userId: String(outsider) });
    expect(add.status).toBe(403);
    expect(add.body.message).toBe('Solo los admins pueden agregar miembros a este grupo.');
    await request(app).patch(`/api/chats/${groupId}`).set(auth(admin)).send({ name: 'Obra Norte' }).expect(200);
    await request(app).post(`/api/chats/${groupId}/members`).set(auth(admin)).send({ userId: String(outsider) }).expect(200);
  });

  it('«pin messages» on lets a member pin; off by default, as before', async () => {
    const { message } = await sendMessage({ chatId: groupId, senderId: admin, clientKey: 'p1', body: 'importante' });
    const pin = () => request(app).post(`/api/chats/${groupId}/fijados`).set(auth(member)).send({ seq: message.seq, duracion: '24h' });
    expect((await pin()).status).toBe(403);
    await setPermissions(admin, { pinMessages: true }).expect(200);
    expect((await pin()).status).toBe(200);
  });
});
