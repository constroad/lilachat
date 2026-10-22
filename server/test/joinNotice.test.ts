import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestMongo } from '../src/testMongo.js';
import type { AuthClient, AuthOutcome } from '../src/authClient.js';
import { buildApp } from '../src/app.js';
import { DeviceModel, InvitationModel, UserModel } from '../src/models.js';
import { ChatModel, MessageModel } from '../src/chatModels.js';
import { signSession } from '../src/sessions.js';

/** José, 21/10: «si alguien que invité se crea su cuenta, debería llegarme un aviso: se unió a Lilachat, salúdala», like Telegram. */
const ok = <T>(valor: T): Promise<AuthOutcome<T>> => Promise.resolve({ ok: true, valor });
const authClient: AuthClient = { requestCode: () => ok({ canal: 'whatsapp' }), verifyCode: () => ok({ secreto: 's' }), validateDevice: () => ok({ companyId: 'constroad', identidad: 'x', app: 'lilachat' }) };
const app = buildApp({ authClient });
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;

const verify = (phone: string, name?: string) => request(app).post('/api/auth/otp/verify').send({ phone, code: '123456', deviceId: `d-${phone}`, ...(name ? { name } : {}) }).expect(200);
const noticesFor = async (phone: string) => {
  const user = await UserModel.findOne({ phone }).lean();
  if (!user) return [];
  return MessageModel.find({ senderId: user._id, kind: 'system', 'system.evento': 'se-unio' }).lean();
};
const waitFor = async <T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 3000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() - start > timeoutMs) return value;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
};

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_join'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), InvitationModel.deleteMany({}), DeviceModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  jose = (await UserModel.create({ phone: '902049935', name: 'José' }))._id;
  await InvitationModel.create({ phone: '987654321', invitedBy: String(jose), status: 'invited' });
});

describe('«se unió a Lilachat»', () => {
  it('the person I invited signs up: a notice in our 1:1, from her, said by the server with her name', async () => {
    await verify('987654321', 'Aracely');
    const notices = await waitFor(() => noticesFor('987654321'), (list) => list.length > 0);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ body: 'Aracely se unió a Lilachat', system: { evento: 'se-unio', quien: { name: 'Aracely', phone: '987654321' } } });
    const chat = await ChatModel.findById(notices[0]!.chatId).lean();
    expect(chat).toMatchObject({ kind: 'direct' });
    expect(chat!.workspaceId).toBeUndefined();
    expect(chat!.members.map((member) => String(member.userId)).sort()).toEqual([String(jose), String(notices[0]!.senderId)].sort());
  });

  it('without a name yet it waits; setting the name announces once', async () => {
    await verify('987654321');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await noticesFor('987654321')).toHaveLength(0);
    const user = await UserModel.findOne({ phone: '987654321' }).lean();
    const auth = { Authorization: `Bearer ${signSession({ userId: String(user!._id), deviceId: 'd', email: 'x' })}` };
    await request(app).put('/api/me/perfil').set(auth).send({ name: 'Aracely' }).expect(200);
    await waitFor(() => noticesFor('987654321'), (list) => list.length > 0);
    await request(app).put('/api/me/perfil').set(auth).send({ name: 'Aracely G.' }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await noticesFor('987654321')).toHaveLength(1);
  });

  it('an account that already existed signs in on a new phone: no notice', async () => {
    await UserModel.create({ phone: '976543210', name: 'Beto' });
    await InvitationModel.create({ phone: '976543210', invitedBy: String(jose), status: 'invited' });
    await verify('976543210', 'Beto');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await noticesFor('976543210')).toHaveLength(0);
  });

  it('nobody invited her: no notice and no chat', async () => {
    await verify('955555555', 'Carla');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await noticesFor('955555555')).toHaveLength(0);
    expect(await ChatModel.countDocuments({})).toBe(0);
  });
});
