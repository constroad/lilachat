import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { reenviarMensaje } from './reenvio.js';

let mongo: MongoMemoryServer;
let ana: Types.ObjectId;
let beto: Types.ObjectId;
let from: Types.ObjectId;
let to: Types.ObjectId;

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
  [ana, beto] = (await UserModel.create([{ phone: '51900000801', name: 'Ana' }, { phone: '51900000802', name: 'Beto' }])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  from = (await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: ana }, { userId: beto }] }))._id;
  to = (await ChatModel.create({ kind: 'direct', members: [{ userId: ana }, { userId: beto }] }))._id;
});

describe('forwarding says «Reenviado», like WhatsApp (José 13/11)', () => {
  it('the copy in the other chat is marked; the original is not', async () => {
    // Arrange
    const original = await sendMessage({ chatId: String(from), senderId: beto, clientKey: 'o1', body: 'el vaciado es a las 7' });
    // Act
    const copy = await reenviarMensaje({ quien: ana, desde: String(from), seq: original.message.seq, hacia: String(to), clientKey: 'f1' });
    // Assert
    expect(copy.ok && copy.message).toMatchObject({ body: 'el vaciado es a las 7', forwarded: true });
    expect((await MessageModel.findOne({ chatId: from, seq: original.message.seq }).lean())?.forwarded).toBeUndefined();
  });
});
