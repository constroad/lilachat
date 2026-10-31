import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { signSession } from './sessions.js';
import { readAll } from './readAll.js';

/** R31/10-B9: «Leer todo» in the chat list. */
let mongo: MongoMemoryServer;
const app = buildApp();
let ana: Types.ObjectId;
let beto: Types.ObjectId;
const space = new Types.ObjectId();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  const users = await UserModel.create([{ phone: '51900000931', name: 'Ana' }, { phone: '51900000932', name: 'Beto' }]);
  [ana, beto] = users.map((user) => user._id as Types.ObjectId) as [Types.ObjectId, Types.ObjectId];
});

const readSeqOf = async (chatId: Types.ObjectId) => (await ReceiptModel.findOne({ chatId, userId: ana }).lean())?.readSeq ?? 0;

describe('«Leer todo»', () => {
  it('reads every personal chat to its end and clears my «no leído» mark; a space chat stays', async () => {
    // Arrange
    const [unread, marked, read, inSpace] = await ChatModel.create([
      { kind: 'direct', members: [{ userId: ana }, { userId: beto }], lastSeq: 5 },
      { kind: 'direct', members: [{ userId: ana, markedUnread: true }, { userId: beto }], lastSeq: 2 },
      { kind: 'direct', members: [{ userId: ana }, { userId: beto }], lastSeq: 3 },
      { kind: 'group', name: 'Obra', workspaceId: space, members: [{ userId: ana }, { userId: beto }], lastSeq: 9 },
    ]);
    await ReceiptModel.create([{ chatId: marked!._id, userId: ana, readSeq: 2, deliveredSeq: 2 }, { chatId: read!._id, userId: ana, readSeq: 3, deliveredSeq: 3 }]);
    // Act
    const changed = await readAll(ana, null);
    // Assert
    expect(changed).toBe(2);
    expect(await readSeqOf(unread!._id as Types.ObjectId)).toBe(5);
    expect((await ChatModel.findById(marked!._id).lean())?.members.find((member) => String(member.userId) === String(ana))?.markedUnread).toBe(false);
    expect(await readSeqOf(inSpace!._id as Types.ObjectId)).toBe(0);
  });

  it('the route reads a space only for an active member, and refuses a bad id', async () => {
    // Arrange
    const token = signSession({ userId: String(ana), deviceId: 'd-ana', email: '51900000931' });
    // Act
    const stranger = await request(app).post('/api/chats/read-all').set('Authorization', `Bearer ${token}`).send({ workspaceId: String(space) });
    const bad = await request(app).post('/api/chats/read-all').set('Authorization', `Bearer ${token}`).send({ workspaceId: 'x' });
    const personal = await request(app).post('/api/chats/read-all').set('Authorization', `Bearer ${token}`).send({});
    // Assert
    expect(stranger.status).toBe(404);
    expect(bad.status).toBe(400);
    expect(personal.body).toEqual({ ok: true, chats: 0 });
  });
});
