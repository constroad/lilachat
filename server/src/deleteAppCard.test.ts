import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { deleteMessage, sendMessage } from './chatService.js';

/** José 13/11: an app cannot delete what it posted, so a space or channel admin deletes its card for everyone. */
let mongo: MongoMemoryServer;
let channelAdmin: Types.ObjectId;
let spaceAdmin: Types.ObjectId;
let member: Types.ObjectId;
let bot: Types.ObjectId;
let channel: Types.ObjectId;
const space = new Types.ObjectId();

const post = async (senderId: Types.ObjectId, body: string) => (await sendMessage({ chatId: String(channel), senderId, body, clientKey: `bot:x:${body}` })).message.seq;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), MessageModel.deleteMany({}), WorkspaceMemberModel.deleteMany({})]);
  const person = async (phone: string, name: string) => (await UserModel.create({ phone, name }))._id as Types.ObjectId;
  channelAdmin = await person('51900000921', 'Ana');
  spaceAdmin = await person('51900000922', 'Beto');
  member = await person('51900000923', 'Caro');
  bot = (await UserModel.create({ phone: 'app:inframaq', name: 'Inframaq', app: { appId: new Types.ObjectId(), installationId: new Types.ObjectId(), workspaceId: space } }))._id as Types.ObjectId;
  channel = (await ChatModel.create({ kind: 'group', name: 'planta', workspaceId: space, members: [{ userId: channelAdmin, role: 'admin' }, { userId: spaceAdmin, role: 'member' }, { userId: member, role: 'member' }, { userId: bot, role: 'member' }] }))._id as Types.ObjectId;
  await WorkspaceMemberModel.create([{ workspaceId: space, userId: spaceAdmin, phone: '51900000922', role: 'admin', status: 'active' }, { workspaceId: space, userId: member, phone: '51900000923', role: 'member', status: 'active' }]);
});

describe('deleting an app card for everyone', () => {
  it('a channel admin deletes it and a tombstone stays', async () => {
    // Arrange
    const seq = await post(bot, 'cubicaje');
    // Act
    const deleted = await deleteMessage({ chatId: String(channel), seq, userId: channelAdmin });
    // Assert
    expect(deleted).toMatchObject({ ok: true });
    expect((await MessageModel.findOne({ chatId: channel, seq }).lean())?.deletedAt).toBeInstanceOf(Date);
  });

  it("an admin of the app's space deletes it too", async () => {
    const seq = await post(bot, 'cubicaje');
    expect(await deleteMessage({ chatId: String(channel), seq, userId: spaceAdmin })).toMatchObject({ ok: true });
  });

  it('a plain member cannot, and the card stays', async () => {
    const seq = await post(bot, 'cubicaje');
    expect(await deleteMessage({ chatId: String(channel), seq, userId: member })).toEqual({ ok: false, motivo: 'Solo puedes eliminar tus propios mensajes.' });
    expect((await MessageModel.findOne({ chatId: channel, seq }).lean())?.deletedAt).toBeUndefined();
  });

  it("an admin still cannot delete a person's message", async () => {
    const seq = await post(member, 'hola');
    expect(await deleteMessage({ chatId: String(channel), seq, userId: channelAdmin })).toMatchObject({ ok: false });
  });
});
