import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { MENTION_ALL, MENTION_HERE } from '@lilachat/shared';
import { buildApp } from './app.js';
import { DeviceModel, UserModel } from './models.js';
import { ChatModel, ReceiptModel, type Message } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { notifyOffline, setPushSender } from './pushService.js';
import { __resetPresence, markOnline } from './presence.js';
import type { PushMessage } from './pushSender.js';
import { signSession } from './sessions.js';

/** E3b (20/10): group mentions and «everything / only mentions / nothing» per chat. */
let mongo: MongoMemoryServer;
const app = buildApp();
const sent: PushMessage[] = [];
let me: Types.ObjectId;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let carla: Types.ObjectId;
let groupId: Types.ObjectId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  sent.length = 0;
  __resetPresence();
  setPushSender({ send: async (message) => void sent.push(message), sendDatos: async () => undefined });
  await Promise.all([UserModel.deleteMany({}), DeviceModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  const users = await UserModel.create([
    { phone: '51902049935', name: 'José' },
    { phone: '51900000801', name: 'Ana' },
    { phone: '51900000802', name: 'Beto' },
    { phone: '51900000803', name: 'Carla' },
  ]);
  [me, ana, beto, carla] = users.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
  await DeviceModel.create([
    { deviceId: 'da', userId: ana, platform: 'android', pushToken: 'tok-ana' },
    { deviceId: 'db', userId: beto, platform: 'android', pushToken: 'tok-beto' },
    { deviceId: 'dc', userId: carla, platform: 'android', pushToken: 'tok-carla' },
  ]);
  groupId = (
    await ChatModel.create({
      kind: 'group',
      name: 'Obra',
      members: [{ userId: me, role: 'admin' }, { userId: ana, muted: true }, { userId: beto, muted: true, avisos: 'nada' }, { userId: carla }],
      lastSeq: 0,
    })
  )._id;
});

async function pushFor(body: string, menciones: { userId: string; desde: number; largo: number }[]): Promise<string[]> {
  const { message } = await sendMessage({ chatId: String(groupId), senderId: me, clientKey: `k-${body}`, body, menciones });
  await notifyOffline({ message: message as Message, members: [me, ana, beto, carla].map(String), senderId: String(me) });
  return sent.flatMap((push) => push.tokens).sort();
}

describe('who hears a group message', () => {
  it('without mentions only «todo» rings', async () => {
    expect(await pushFor('Buenos días', [])).toEqual(['tok-carla']);
  });

  it('@todos reaches «solo menciones» but not «nada»', async () => {
    expect(await pushFor('@todos a las 7', [{ userId: MENTION_ALL, desde: 0, largo: 6 }])).toEqual(['tok-ana', 'tok-carla']);
  });

  it('@aquí only reaches those online (the rest is quiet if they muted)', async () => {
    markOnline(String(ana));
    // Ana is online: the common push skips her (she got it live); Beto is offline and «nada».
    expect(await pushFor('@aquí alguien', [{ userId: MENTION_HERE, desde: 0, largo: 5 }])).toEqual(['tok-carla']);
  });

  it('a person mentioned by name with «solo menciones» rings', async () => {
    expect(await pushFor('@Ana mira', [{ userId: String(ana), desde: 0, largo: 4 }])).toEqual(['tok-ana', 'tok-carla']);
  });

  it('@todos is dropped in a 1:1', async () => {
    const direct = await ChatModel.create({ kind: 'direct', members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    const { message } = await sendMessage({ chatId: String(direct._id), senderId: me, clientKey: 'k-direct', body: '@todos hola', menciones: [{ userId: MENTION_ALL, desde: 0, largo: 6 }] });
    expect(message.menciones ?? []).toEqual([]);
  });
});

describe('PATCH /api/chats/:id/ajustes — avisos', () => {
  const jwt = () => signSession({ userId: String(me), deviceId: 'd1', email: '51902049935' });
  const level = async () => (await request(app).get(`/api/chats/${groupId}/detail`).set('Authorization', `Bearer ${jwt()}`).expect(200)).body;

  it('saves the three levels and keeps muted in step for older clients', async () => {
    for (const chosen of ['nada', 'menciones', 'todo'] as const) {
      await request(app).patch(`/api/chats/${groupId}/ajustes`).set('Authorization', `Bearer ${jwt()}`).send({ avisos: chosen }).expect(200);
      const detail = await level();
      expect(detail.avisos).toBe(chosen);
      expect(detail.muted).toBe(chosen !== 'todo');
    }
  });

  it('unmuting from an old client clears «nada»', async () => {
    await request(app).patch(`/api/chats/${groupId}/ajustes`).set('Authorization', `Bearer ${jwt()}`).send({ avisos: 'nada' }).expect(200);
    await request(app).patch(`/api/chats/${groupId}/ajustes`).set('Authorization', `Bearer ${jwt()}`).send({ muted: false }).expect(200);
    await request(app).patch(`/api/chats/${groupId}/ajustes`).set('Authorization', `Bearer ${jwt()}`).send({ muted: true }).expect(200);
    expect((await level()).avisos).toBe('menciones');
  });

  it('rejects an unknown level', async () => {
    await request(app).patch(`/api/chats/${groupId}/ajustes`).set('Authorization', `Bearer ${jwt()}`).send({ avisos: 'a veces' }).expect(400);
  });
});
