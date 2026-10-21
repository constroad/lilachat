import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { buildPushText } from './pushSender.js';
import { NudgeError, __resetNudges, ensureNudgeAllowed } from './zumbido.js';

/** The MSN Messenger nudge (José, 20/10, backlog 3): it shakes the other person's chat. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
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
    await ensureNudgeAllowed(String(chat._id), me, 0);
    await expect(ensureNudgeAllowed(String(chat._id), me, 5_000)).rejects.toBeInstanceOf(NudgeError);
    await ensureNudgeAllowed(String(chat._id), ana, 5_000);
    await ensureNudgeAllowed(String(chat._id), me, 10_000);
  });

  it('not in a group, and not for someone outside the chat', async () => {
    const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me }, { userId: ana }], lastSeq: 0 });
    await expect(ensureNudgeAllowed(String(group._id), me, 0)).rejects.toThrow('solo para chats de dos personas');
    const other = await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: new Types.ObjectId() }], lastSeq: 0 });
    await expect(ensureNudgeAllowed(String(other._id), me, 0)).rejects.toBeInstanceOf(NudgeError);
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
