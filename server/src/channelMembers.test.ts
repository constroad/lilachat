import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { signSession } from './sessions.js';
import { BotInstallationModel } from './bots/botModels.js';

/**
 * Adding someone to a channel of a space (Agentes, 25/10/2026): only the space's active
 * members can be added (and the installed apps, which have their own way in), and only a
 * member of that channel who is active in the space can add them. The picker already offers
 * just that; the API now enforces it, so a modified client cannot get a stranger in.
 */
let mongo: MongoMemoryServer;
const app = buildApp({});
type Who = 'jose' | 'ana' | 'beto' | 'carla' | 'dani' | 'luis' | 'portal' | 'old';
const users = {} as Record<Who, Types.ObjectId>;
let spaceId: Types.ObjectId;
let privateChannel: Types.ObjectId;
const jwt = (who: Who) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;
const add = (chatId: Types.ObjectId, caller: Who, target: Who) => request(app).post(`/api/chats/${chatId}/members`).set('Authorization', jwt(caller)).send({ userId: String(users[target]) });
const membersOf = async (chatId: Types.ObjectId) => ((await ChatModel.findById(chatId).lean())?.members ?? []).map((member) => String(member.userId));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_channel_members'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel, ChatModel, WorkspaceModel, WorkspaceMemberModel, BotInstallationModel].map((model) => (model as unknown as mongoose.Model<unknown>).deleteMany({})));
  const created = await UserModel.create([
    { phone: '51902049935', name: 'José' },
    { phone: '51987654321', name: 'Ana' },
    { phone: '51976543210', name: 'Beto (fuera del espacio)' },
    { phone: '51965432109', name: 'Carla (desactivada)' },
    { phone: '51954321098', name: 'Dani (pendiente)' },
    { phone: '51943210987', name: 'Luis (activo, fuera del canal)' },
    { phone: '51900000001', name: 'Portal' },
    { phone: '51900000002', name: 'App retirada' },
  ]);
  (['jose', 'ana', 'beto', 'carla', 'dani', 'luis', 'portal', 'old'] as const).forEach((who, index) => {
    users[who] = created[index]!._id;
  });
  spaceId = (await WorkspaceModel.create({ name: 'CONSTROAD', ownerId: users.jose, joinCode: 'CONS-7K3P' }))._id;
  await WorkspaceMemberModel.create([
    { workspaceId: spaceId, userId: users.jose, phone: '51902049935', role: 'owner', status: 'active' },
    { workspaceId: spaceId, userId: users.ana, phone: '51987654321', role: 'member', status: 'active' },
    { workspaceId: spaceId, userId: users.carla, phone: '51965432109', role: 'member', status: 'deactivated' },
    { workspaceId: spaceId, userId: users.dani, phone: '51954321098', role: 'member', status: 'pending' },
    { workspaceId: spaceId, userId: users.luis, phone: '51943210987', role: 'member', status: 'active' },
  ]);
  privateChannel = (await ChatModel.create({ kind: 'group', name: 'gerencia', workspaceId: spaceId, channel: { visibility: 'private' }, members: [{ userId: users.jose, role: 'admin' }], lastSeq: 0 }))._id;
  const installation = (botUser: Types.ObjectId, token: string, extra: Record<string, unknown> = {}) => ({ appId: new Types.ObjectId(), workspaceId: spaceId, botUserId: botUser, tokenHash: token, signingSecret: `secret-${token}`, installedBy: users.jose, ...extra });
  await BotInstallationModel.create([installation(users.portal, 'hash-portal'), installation(users.old, 'hash-old', { revokedAt: new Date() })]);
});

describe('POST /api/chats/:id/members in a channel of a space', () => {
  it('an active member of the space is added by a member of the channel', async () => {
    // Act
    await add(privateChannel, 'jose', 'ana').expect(200);
    // Assert
    expect(await membersOf(privateChannel)).toContain(String(users.ana));
  });

  it('someone outside the space is refused with 403 and stays out', async () => {
    // Act
    const response = await add(privateChannel, 'jose', 'beto').expect(403);
    // Assert
    expect(response.body.message).toMatch(/espacio/i);
    expect(await membersOf(privateChannel)).not.toContain(String(users.beto));
  });

  it('a deactivated or a pending member of the space is refused with 403 too', async () => {
    await add(privateChannel, 'jose', 'carla').expect(403);
    await add(privateChannel, 'jose', 'dani').expect(403);
    expect(await membersOf(privateChannel)).toEqual([String(users.jose)]);
  });

  it('an app installed in the space can be added (the way it comes back after an admin took it out)', async () => {
    await add(privateChannel, 'jose', 'portal').expect(200);
    expect(await membersOf(privateChannel)).toContain(String(users.portal));
  });

  it('an app whose installation was revoked is refused with 403', async () => {
    await add(privateChannel, 'jose', 'old').expect(403);
    expect(await membersOf(privateChannel)).not.toContain(String(users.old));
  });

  it('who is not in the channel cannot add anyone to it, even being an active member of the space', async () => {
    // Act
    const response = await add(privateChannel, 'luis', 'ana').expect(403);
    // Assert
    expect(response.body.message).toMatch(/canal/i);
    expect(await membersOf(privateChannel)).not.toContain(String(users.ana));
  });

  it('who left the space (deactivated) cannot add anyone, even if the channel still lists them', async () => {
    // Arrange: the chat still lists Carla (a stale row), but her place in the space is deactivated.
    await ChatModel.updateOne({ _id: privateChannel }, { $push: { members: { userId: users.carla, role: 'member' } } });
    // Act
    await add(privateChannel, 'carla', 'ana').expect(403);
    // Assert
    expect(await membersOf(privateChannel)).not.toContain(String(users.ana));
  });

  it('a group outside any space keeps adding whoever the member picks', async () => {
    // Arrange
    const personal = await ChatModel.create({ kind: 'group', name: 'Familia', members: [{ userId: users.jose, role: 'admin' }], lastSeq: 0 });
    // Act
    await add(personal._id, 'jose', 'beto').expect(200);
    // Assert
    expect(await membersOf(personal._id)).toContain(String(users.beto));
  });
});
