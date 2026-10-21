import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startTestMongo } from './testMongo.js';
import mongoose, { Types } from 'mongoose';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { buildPushText } from './pushSender.js';
import request from 'supertest';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';
import { NudgeError, __resetNudges, ensureFunAllowed, setGroupFun } from './zumbido.js';

/** The MSN Messenger nudge (José, 20/10, backlog 3): it shakes the other person's chat. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  __resetNudges();
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({})]);
  [me, ana] = (await UserModel.create([{ phone: '902049935', name: 'José' }, { phone: '987654321', name: 'Ana' }])).map((u) => u._id) as [Types.ObjectId, Types.ObjectId];
});

describe('nudge', () => {
  it('goes in a 1:1, once every 10 seconds per person and chat', async () => {
    const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    await ensureFunAllowed(String(chat._id), me, 'zumbido', 0);
    await expect(ensureFunAllowed(String(chat._id), me, 'zumbido', 5_000)).rejects.toBeInstanceOf(NudgeError);
    await ensureFunAllowed(String(chat._id), ana, 'zumbido', 5_000);
    await ensureFunAllowed(String(chat._id), me, 'zumbido', 10_000);
  });

  it('in a group only when an admin allows it, and not for someone outside the chat', async () => {
    const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
    await expect(ensureFunAllowed(String(group._id), me, 'zumbido', 0)).rejects.toThrow('los admins no permiten');
    expect((await setGroupFun({ chatId: String(group._id), who: ana, allowed: true })).ok).toBe(false);
    expect((await setGroupFun({ chatId: String(group._id), who: me, allowed: true })).ok).toBe(true);
    await ensureFunAllowed(String(group._id), ana, 'zumbido', 0);
    const other = await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: new Types.ObjectId() }], lastSeq: 0 });
    await expect(ensureFunAllowed(String(other._id), me, 'zumbido', 0)).rejects.toBeInstanceOf(NudgeError);
  });

  it('is a message without content, also in a secret chat', async () => {
    const secret = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    const { message } = await sendMessage({ chatId: String(secret._id), senderId: me, clientKey: 'z1', kind: 'zumbido', body: 'ignored' });
    expect(message.kind).toBe('zumbido');
    expect(message.body).toBeUndefined();
  });

  it('the notification says it', () => {
    expect(buildPushText({ senderName: 'Ana', kind: 'zumbido' })).toEqual({ title: 'Ana', body: 'Te mandó un zumbido' });
  });
});

/** Winks (José, 21/10): a full-screen animation, like MSN's, with its own limit. */
describe('wink', () => {
  it('needs a wink of the catalog and has its own 10 seconds, apart from the nudge', async () => {
    const chat = await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    await expect(ensureFunAllowed(String(chat._id), me, 'guino', 0, 'chanchito')).rejects.toThrow('Ese guiño no existe');
    await ensureFunAllowed(String(chat._id), me, 'guino', 0, 'hearts');
    await ensureFunAllowed(String(chat._id), me, 'zumbido', 1_000);
    await expect(ensureFunAllowed(String(chat._id), me, 'guino', 5_000, 'party')).rejects.toThrow('otro guiño');
  });

  it('is stored with its id and no content, also in a secret chat', async () => {
    const secret = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    const { message } = await sendMessage({ chatId: String(secret._id), senderId: me, clientKey: 'g1', kind: 'guino', wink: 'hearts', body: 'ignored' });
    expect(message.kind).toBe('guino');
    expect(message.wink).toBe('hearts');
    expect(message.body).toBeUndefined();
  });

  it('the notification says it', () => {
    expect(buildPushText({ senderName: 'Ana', kind: 'guino' })).toEqual({ title: 'Ana', body: 'Te mandó un guiño' });
  });
});

describe('the group switch for nudges and winks (PATCH /api/chats/:id/fun)', () => {
  const app = buildApp({});
  const as = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x' })}` });

  it('an admin switches it on for everyone; a member cannot', async () => {
    const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 0 });
    const byMember = await request(app).patch(`/api/chats/${group._id}/fun`).set(as(ana)).send({ allowed: true });
    expect(byMember.status).toBe(403);
    const byAdmin = await request(app).patch(`/api/chats/${group._id}/fun`).set(as(me)).send({ allowed: true });
    // The status and the text in the message: a 21/10 run once got an empty body here and nothing said why.
    expect(byAdmin.status, `response ${byAdmin.status}: ${byAdmin.text}`).toBe(200);
    expect(byAdmin.body).toEqual({ ok: true, funAllowed: true });
    expect((await ChatModel.findById(group._id).lean())?.funAllowed).toBe(true);
    const detail = await request(app).get(`/api/chats/${group._id}/detail`).set(as(ana));
    expect(detail.body.funAllowed).toBe(true);
  });
});
