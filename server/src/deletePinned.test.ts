import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { deleteMessage, sendMessage } from './chatService.js';

/** The pins travel with the chat list: whoever has the chat open learns of a deleted pin only if the delete says so. */
let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let group: Types.ObjectId;

const send = async (body: string) => (await sendMessage({ chatId: String(group), senderId: ana, body, clientKey: body })).message.seq;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({})]);
  ana = (await UserModel.create({ phone: '51900000911', name: 'Ana' }))._id as Types.ObjectId;
  group = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: ana, role: 'admin' }] }))._id as Types.ObjectId;
});

describe('deleting a pinned message', () => {
  it('takes the pin off and says so', async () => {
    const seq = await send('fijado');
    await ChatModel.updateOne({ _id: group }, { $push: { fijados: { seq, por: ana, en: new Date() } } });

    const deleted = await deleteMessage({ chatId: String(group), seq, userId: ana });

    expect(deleted).toMatchObject({ ok: true, unpinned: true });
    expect((await ChatModel.findById(group).lean())?.fijados ?? []).toHaveLength(0);
  });

  it('says nothing for a message that was not pinned, so a delete does not reload every list', async () => {
    const pinnedSeq = await send('fijado');
    const seq = await send('suelto');
    await ChatModel.updateOne({ _id: group }, { $push: { fijados: { seq: pinnedSeq, por: ana, en: new Date() } } });

    const deleted = await deleteMessage({ chatId: String(group), seq, userId: ana });

    expect(deleted).toMatchObject({ ok: true, unpinned: false });
    expect((await ChatModel.findById(group).lean())?.fijados?.map((pin) => pin.seq)).toEqual([pinnedSeq]);
  });
});
