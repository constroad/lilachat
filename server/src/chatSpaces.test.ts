import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { signSession } from './sessions.js';

/**
 * E2E 12/11: a /c/<chat> link of the Test space, opened in a browser that last showed Inframaq,
 * painted Inframaq and no conversation. The page asks which spaces the chat is seen from and goes there.
 */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let jwt: string;
const app = buildApp();
const testSpace = new Types.ObjectId();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ChatModel.deleteMany({})]);
  me = (await UserModel.create({ phone: '51902049935', name: 'José' }))._id;
  jwt = signSession({ userId: String(me), deviceId: 'd1', email: '51902049935' });
});

const spacesOf = (chatId: string) => request(app).get(`/api/chats/${chatId}/spaces`).set('Authorization', `Bearer ${jwt}`);

describe('GET /api/chats/:id/spaces — where a linked chat lives', () => {
  it('a space channel answers its space', async () => {
    // Arrange
    const channel = await ChatModel.create({ kind: 'group', name: 'Constructora Los Andes SAC', workspaceId: testSpace, channel: { visibility: 'private' }, members: [{ userId: me, role: 'admin' }], lastSeq: 0 });
    // Act
    const response = await spacesOf(String(channel._id)).expect(200);
    // Assert
    expect(response.body).toEqual({ spaceIds: [String(testSpace)] });
  });

  it('a personal chat answers no space', async () => {
    const ownChat = await ChatModel.create({ kind: 'group', name: 'Familia', members: [{ userId: me, role: 'admin' }], lastSeq: 0 });
    const response = await spacesOf(String(ownChat._id)).expect(200);
    expect(response.body).toEqual({ spaceIds: [] });
  });

  it('someone else\'s chat, or an id that is not one, is the same 404', async () => {
    const other = (await UserModel.create({ phone: '51999999999', name: 'Ana' }))._id;
    const theirs = await ChatModel.create({ kind: 'group', name: 'Privado', workspaceId: testSpace, members: [{ userId: other, role: 'admin' }], lastSeq: 0 });
    await spacesOf(String(theirs._id)).expect(404);
    await spacesOf('not-an-id').expect(404);
  });
});
