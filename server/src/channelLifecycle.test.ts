import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { ClientChannelModel } from './bots/botClients.js';
import { signSession } from './sessions.js';

/**
 * José 30/10 asked how to delete a channel (there was no way) and, when someone is
 * added to a channel or group, whether they see what was said before.
 */
let mongo: MongoMemoryServer;
const app = buildApp({});
type Who = 'jose' | 'ana' | 'luis';
const users = {} as Record<Who, Types.ObjectId>;
let spaceId: Types.ObjectId;
let channelId: Types.ObjectId;
const auth = (who: Who) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;
const remove = (chatId: Types.ObjectId, who: Who) => request(app).delete(`/api/workspaces/${spaceId}/channels/${chatId}`).set('Authorization', auth(who));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_channel_lifecycle'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, ClientChannelModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  const created = await UserModel.create([{ phone: '51902049935', name: 'José' }, { phone: '51987654321', name: 'Ana' }, { phone: '51943210987', name: 'Luis' }]);
  (['jose', 'ana', 'luis'] as const).forEach((who, index) => {
    users[who] = created[index]!._id;
  });
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: users.jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: users.jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: users.ana, phone: '51987654321', role: 'member', status: 'active' },
    { workspaceId: spaceId, userId: users.luis, phone: '51943210987', role: 'member', status: 'active' },
  ]);
  channelId = (await ChatModel.create({ kind: 'group', name: 'obras', workspaceId: spaceId, channel: { visibility: 'public' }, members: [{ userId: users.jose, role: 'admin' }, { userId: users.ana, role: 'member' }], lastSeq: 12 }))._id;
});

describe('DELETE /api/workspaces/:id/channels/:chatId', () => {
  it('a space admin deletes it: nobody is in it, it is no longer a channel, and what it was is kept', async () => {
    // Act
    await remove(channelId, 'jose').expect(200);
    // Assert
    const chat = await ChatModel.findById(channelId).lean();
    expect(chat?.members).toEqual([]);
    expect(chat?.channel).toBeUndefined();
    expect(chat?.deletedChannel).toMatchObject({ name: 'obras', visibility: 'public', deletedBy: users.jose });
    expect(chat?.deletedChannel?.members.map((member) => String(member.userId))).toEqual([String(users.jose), String(users.ana)]);
    const listed = await request(app).get(`/api/workspaces/${spaceId}/channels`).set('Authorization', auth('ana')).expect(200);
    expect(listed.body.channels.map((one: { name: string }) => one.name)).not.toContain('obras');
  });

  it('a member who is not an admin of the space cannot (403) and the channel stays', async () => {
    const response = await remove(channelId, 'ana').expect(403);
    expect(response.body.message).toMatch(/admin/i);
    expect((await ChatModel.findById(channelId).lean())?.members).toHaveLength(2);
  });

  it('#general and a client channel are not deleted; an unknown id is a 404', async () => {
    await WorkspaceModel.updateOne({ _id: spaceId }, { $set: { generalChatId: channelId } });
    expect((await remove(channelId, 'jose').expect(400)).body.message).toMatch(/general/);
    const client = (await ChatModel.create({ kind: 'group', name: 'carceli', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: users.jose, role: 'admin' }], lastSeq: 0 }))._id;
    await ClientChannelModel.create({ workspaceId: spaceId, appId: new Types.ObjectId(), clientId: 'cli-1', chatId: client, name: 'CARCELI', services: [] });
    expect((await remove(client, 'jose').expect(400)).body.message).toMatch(/Portal/);
    await remove(new Types.ObjectId(), 'jose').expect(404);
  });
});

describe('adding someone: with or without the history', () => {
  const add = (history: boolean | undefined) => request(app).post(`/api/chats/${channelId}/members`).set('Authorization', auth('jose')).send({ userId: String(users.luis), ...(history === undefined ? {} : { history }) });
  const luisFloor = async () => (await ChatModel.findById(channelId).lean())?.members.find((member) => member.userId.equals(users.luis))?.borradoHasta;

  it('without history: what was said before stays out of sight (up to the last message)', async () => {
    await add(false).expect(200);
    expect(await luisFloor()).toBe(12);
  });

  it('with history, or when the app does not say: everything shows, as before', async () => {
    await add(true).expect(200);
    expect(await luisFloor()).toBeUndefined();
  });
});
