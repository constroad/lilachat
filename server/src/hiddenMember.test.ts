import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { startTestMongo } from './testMongo.js';
import { buildApp } from './app.js';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { sendMessage } from './chatService.js';
import { signSession } from './sessions.js';
import { hiddenInChat } from './hiddenMembers.js';
import { invitationsOf, inviteByEmail } from './workspaceEmailInvites.js';
import type { SpaceInvitationMail } from './authClient.js';

/**
 * José, 12/11/2026: he supports Globofast for about a week as its superadmin, and the people who
 * join must not see him there. A `hidden` member is left out of what everyone ELSE sees of the
 * space; he still sees the space whole, himself included. A 1:1 always shows the other person.
 */
describe('hiddenInChat', () => {
  const hidden = new Map([['space-a', new Set(['jose'])]]);

  it('drops the hidden member for someone else in a group or channel of that space', () => {
    // Arrange
    const chat = { workspaceId: 'space-a', kind: 'group' };
    // Act
    const dropped = hiddenInChat(hidden, chat, 'ana');
    // Assert
    expect([...dropped]).toEqual(['jose']);
  });

  it('drops nobody for the hidden member himself, in a 1:1, in another space or in a personal chat', () => {
    // Arrange
    const cases = [
      hiddenInChat(hidden, { workspaceId: 'space-a', kind: 'group' }, 'jose'),
      hiddenInChat(hidden, { workspaceId: 'space-a', kind: 'direct' }, 'ana'),
      hiddenInChat(hidden, { workspaceId: 'space-b', kind: 'group' }, 'ana'),
      hiddenInChat(hidden, { kind: 'group' }, 'ana'),
    ];
    // Assert
    expect(cases.map((dropped) => dropped.size)).toEqual([0, 0, 0, 0]);
  });
});

let mongo: MongoMemoryServer;
const app = buildApp();
const users: Record<'jose' | 'ana' | 'beto' | 'carla', Types.ObjectId> = {} as never;
const jwt = (who: keyof typeof users) => `Bearer ${signSession({ userId: String(users[who]), deviceId: `d-${who}`, email: `${who}@qa.local` })}`;
const get = async (who: keyof typeof users, path: string) => (await request(app).get(path).set('Authorization', jwt(who)).expect(200)).body;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), WorkspaceModel.deleteMany({}), WorkspaceMemberModel.deleteMany({}), ChatModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  const created = await UserModel.create([
    { phone: '902049935', name: 'José Zamora' },
    { phone: '987654321', name: 'Ana Torres' },
    { phone: '976543210', name: 'Beto Ramos' },
    { phone: '965432109', name: 'Carla Díaz' },
  ]);
  [users.jose, users.ana, users.beto, users.carla] = created.map((user) => user._id) as [Types.ObjectId, Types.ObjectId, Types.ObjectId, Types.ObjectId];
});

/** José creates the space, adds Ana and Beto, and is then hidden in it. */
async function spaceWithHiddenOwner() {
  const space = (await request(app).post('/api/workspaces').set('Authorization', jwt('jose')).send({ name: 'Globofast', joinPolicy: 'approval' }).expect(201)).body.workspace as { id: string; joinCode: string };
  for (const phone of ['987654321', '976543210']) await request(app).post(`/api/workspaces/${space.id}/members`).set('Authorization', jwt('jose')).send({ phone }).expect(201);
  await WorkspaceMemberModel.updateOne({ workspaceId: space.id, userId: users.jose }, { $set: { hidden: true } });
  const general = await WorkspaceModel.findById(space.id).select('generalChatId').lean();
  return { ...space, generalId: String(general!.generalChatId) };
}

const userIdsOf = (members: { userId?: string; id?: string }[]) => members.map((member) => member.userId ?? member.id).sort();

describe('a hidden member of a space', () => {
  it('is not in the directory nor in the counts of the others, and is in his own', async () => {
    const space = await spaceWithHiddenOwner();

    // Beto as the admin his sister will be: her full list («Miembros y roles») leaves him out too.
    await WorkspaceMemberModel.updateOne({ workspaceId: space.id, userId: users.beto }, { $set: { role: 'admin' } });
    expect(userIdsOf((await get('beto', `/api/workspaces/${space.id}/members?status=all`)).members)).toEqual([String(users.ana), String(users.beto)].sort());
    expect(userIdsOf((await get('ana', `/api/workspaces/${space.id}/members`)).members)).toEqual([String(users.ana), String(users.beto)].sort());
    expect(userIdsOf((await get('jose', `/api/workspaces/${space.id}/members`)).members)).toContain(String(users.jose));
    expect((await get('ana', '/api/workspaces')).workspaces).toEqual([expect.objectContaining({ id: space.id, members: 2 })]);
    expect((await get('jose', '/api/workspaces')).workspaces).toEqual([expect.objectContaining({ id: space.id, members: 3, role: 'owner' })]);
    expect((await get('carla', `/api/workspaces/preview/${space.joinCode}`)).members).toBe(2);
  });

  it('is not among the people of #general, its count, the chat list nor the people to add', async () => {
    const space = await spaceWithHiddenOwner();

    const channels = (await get('ana', `/api/workspaces/${space.id}/channels`)).channels as { id: string; members: number }[];
    expect(channels.find((channel) => channel.id === space.generalId)?.members).toBe(2);
    expect(userIdsOf((await get('ana', `/api/chats/${space.generalId}/detail`)).members)).toEqual([String(users.ana), String(users.beto)].sort());
    const general = ((await get('ana', `/api/chats?workspace=${space.id}`)).chats as { id: string; memberIds: string[]; acuseDe: string[] }[]).find((chat) => chat.id === space.generalId);
    expect(general?.memberIds.sort()).toEqual([String(users.ana), String(users.beto)].sort());
    expect(general?.acuseDe).toEqual([String(users.beto)]);
    expect(userIdsOf((await get('ana', `/api/workspaces/${space.id}/channels/${space.generalId}/people`)).people)).not.toContain(String(users.jose));

    expect(userIdsOf((await get('jose', `/api/chats/${space.generalId}/detail`)).members)).toContain(String(users.jose));
    expect((await get('jose', `/api/workspaces/${space.id}/channels`)).channels.find((channel: { id: string }) => channel.id === space.generalId)?.members).toBe(3);
  });

  it('is not in the «Info» of a message, but a 1:1 with him still shows him', async () => {
    const space = await spaceWithHiddenOwner();
    const sent = await sendMessage({ chatId: space.generalId, senderId: users.ana, clientKey: 'k1', body: 'buenos días' });

    const info = (await get('ana', `/api/chats/${space.generalId}/messages/${sent.message.seq}/info`)).miembros as { id: string }[];
    expect(info.map((member) => member.id)).toEqual([String(users.beto)]);

    const direct = await request(app).post('/api/chats').set('Authorization', jwt('jose')).send({ kind: 'direct', memberIds: [String(users.ana)], workspaceId: space.id }).expect(201);
    expect(userIdsOf((await get('ana', `/api/chats/${direct.body.chatId}/detail`)).members)).toEqual([String(users.jose), String(users.ana)].sort());
  });

  it('is not offered as an admin to talk to after someone is removed', async () => {
    const space = await spaceWithHiddenOwner();
    await WorkspaceMemberModel.updateOne({ workspaceId: space.id, userId: users.ana }, { $set: { status: 'deactivated' } });

    const mine = (await get('ana', '/api/workspaces')).workspaces as { id: string; admins?: unknown[] }[];
    expect(mine.find((one) => one.id === space.id)?.admins ?? []).toEqual([]);
  });

  /** He adds and invites the people himself: «Te agregó» and the email must not name him. */
  it('is not named as who added or invited someone', async () => {
    const space = await spaceWithHiddenOwner();
    const mails: SpaceInvitationMail[] = [];
    await inviteByEmail(space.id, users.jose, { email: 'nicole@globofast.pe' }, async (mail) => {
      mails.push(mail);
      return { ok: true, valor: {} };
    });
    const nicole = await UserModel.create({ phone: '954321098', name: 'Nicole', email: 'nicole@globofast.pe', emailVerifiedAt: new Date() });

    const ana = ((await get('ana', '/api/workspaces')).workspaces as { id: string; addedBy?: unknown }[]).find((one) => one.id === space.id);
    expect(ana?.addedBy).toBeUndefined();
    expect(mails).toEqual([expect.objectContaining({ to: 'nicole@globofast.pe', spaceName: 'Globofast' })]);
    expect(mails[0]).not.toHaveProperty('inviterName');
    expect((await invitationsOf(nicole._id)).map((invite) => invite.invitedBy)).toEqual([null]);
  });
});
