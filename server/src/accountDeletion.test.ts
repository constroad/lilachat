import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { ACCOUNT_DELETION_GRACE_DAYS, DELETED_ACCOUNT_NAME } from '@lilachat/shared';
import { startTestMongo } from './testMongo.js';
import { DeviceModel, InvitationModel, UserModel } from './models.js';
import { ChatModel, MessageModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { buildApp } from './app.js';
import { signSession } from './sessions.js';
import type { AuthClient, AuthOutcome } from './authClient.js';
import { forgetClosedAccounts, isAccountClosed, loadClosedAccounts } from './closedAccounts.js';
import { purgeAccount, purgeDueAccounts } from './accountPurge.js';

/** José 19/11 (Google Play): «Borrar mi cuenta» closes at once, waits 30 days, and a sign-in cancels it. */
let mongo: MongoMemoryServer;
let me: Types.ObjectId;
let ana: Types.ObjectId;
const DAY_MS = 24 * 60 * 60 * 1000;
const PHONE = '902049935';

const ok = <T>(valor: T): Promise<AuthOutcome<T>> => Promise.resolve({ ok: true, valor });
const fakeAuth: AuthClient = {
  requestCode: () => ok({ canal: 'whatsapp' }),
  sendInvitation: () => ok({ canal: 'email' }),
  verifyCode: () => ok({ secreto: 'device-secret' }),
  validateDevice: () => ok({ companyId: 'constroad', identidad: `51${PHONE}`, app: 'lilachat' }),
};
const app = buildApp({ authClient: fakeAuth });
const auth = (userId: Types.ObjectId) => ({ Authorization: `Bearer ${signSession({ userId: String(userId), deviceId: `d-${userId}`, email: 'x@x.com' })}` });
const askDeletion = (who: Types.ObjectId, confirm: unknown = 'borrar') => request(app).post('/api/me/account-deletion').set(auth(who)).send({ confirm });

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_account_deletion_test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  forgetClosedAccounts();
  await Promise.all([UserModel, DeviceModel, InvitationModel, ChatModel, MessageModel, WorkspaceModel, WorkspaceMemberModel].map((model) => (model as mongoose.Model<unknown>).deleteMany({})));
  [me, ana] = (await UserModel.create([
    { phone: PHONE, name: 'José', email: 'jose@x.com', emailVerifiedAt: new Date(), birthday: { day: 3, month: 4 }, avatarUrl: '/files/perfil.jpg', autoReply: { enabled: true, text: 'Ocupado' } },
    { phone: '987654321', name: 'Ana' },
  ])).map((user) => user._id) as [Types.ObjectId, Types.ObjectId];
  await UserModel.updateOne({ _id: ana }, { $set: { blockedUsers: [me] } });
  await DeviceModel.create({ deviceId: 'd-phone', userId: me, platform: 'android', pushToken: 'fcm-token' });
});

async function seedSpace(name: string, people: { userId: Types.ObjectId; role: 'owner' | 'admin' | 'member'; phone: string }[]) {
  const owner = people.find((person) => person.role === 'owner')!;
  const space = await WorkspaceModel.create({ name, ownerId: owner.userId, joinCode: `${name.slice(0, 4).toUpperCase()}-AB${people.length}C` });
  await WorkspaceMemberModel.create(people.map((person) => ({ workspaceId: space._id, ...person, status: 'active' as const, joinedAt: new Date() })));
  return space._id;
}

describe('asking to delete the account', () => {
  it('needs the word typed, and nothing changes without it', async () => {
    // Act
    const response = await askDeletion(me, 'borra');

    // Assert
    expect(response.status).toBe(400);
    expect((await UserModel.findById(me).lean())?.deletionRequestedAt).toBeUndefined();
  });

  it('closes the account at once: devices and push tokens go, and the session stops working', async () => {
    // Act
    const response = await askDeletion(me);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ requested: true, deadline: expect.any(String) }));
    expect(await DeviceModel.countDocuments({ userId: me })).toBe(0);
    expect(isAccountClosed(String(me))).toBe(true);
    expect((await request(app).get('/api/me/account-deletion').set(auth(me))).status).toBe(401);
  });

  it('keeps the first date when asked twice and survives a restart', async () => {
    // Arrange
    await askDeletion(me).expect(200);
    const first = (await UserModel.findById(me).lean())?.deletionRequestedAt;
    forgetClosedAccounts();

    // Act
    await askDeletion(me).expect(200);
    await loadClosedAccounts();

    // Assert
    expect((await UserModel.findById(me).lean())?.deletionRequestedAt).toEqual(first);
    expect(isAccountClosed(String(me))).toBe(true);
  });

  it('is refused to the owner of a space with other people, naming it', async () => {
    // Arrange
    await seedSpace('Constroad', [{ userId: me, role: 'owner', phone: PHONE }, { userId: ana, role: 'member', phone: '987654321' }]);

    // Act
    const response = await askDeletion(me);

    // Assert
    expect(response.status).toBe(409);
    expect(response.body.message).toContain('«Constroad»');
    expect(isAccountClosed(String(me))).toBe(false);
  });

  it('lets the owner of a space with nobody else go', async () => {
    // Arrange
    await seedSpace('Solo', [{ userId: me, role: 'owner', phone: PHONE }]);

    // Act / Assert
    expect((await askDeletion(me)).status).toBe(200);
  });
});

describe('coming back inside the grace', () => {
  it('a sign-in with the code cancels the deletion and says so', async () => {
    // Arrange
    await askDeletion(me).expect(200);

    // Act
    const response = await request(app).post('/api/auth/otp/verify').send({ phone: PHONE, code: '123456', deviceId: 'd-new' });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.accountDeletionCancelled).toBe(true);
    expect((await UserModel.findById(me).lean())?.deletionRequestedAt).toBeUndefined();
    expect(isAccountClosed(String(me))).toBe(false);
  });

  it('a plain sign-in does not carry the notice', async () => {
    // Act
    const response = await request(app).post('/api/auth/otp/verify').send({ phone: PHONE, code: '123456', deviceId: 'd-new' });

    // Assert
    expect(response.body.accountDeletionCancelled).toBeUndefined();
  });

  it('renewing the session of a closed account is refused', async () => {
    // Arrange
    await askDeletion(me).expect(200);
    await DeviceModel.create({ deviceId: 'd-phone', userId: me, platform: 'android' });

    // Act
    const response = await request(app).post('/api/auth/session').send({ deviceId: 'd-phone', deviceSecret: 'device-secret' });

    // Assert
    expect(response.status).toBe(401);
  });

  it('cancelling with DELETE answers whether there was something to cancel', async () => {
    // Act
    const response = await request(app).delete('/api/me/account-deletion').set(auth(me));

    // Assert
    expect(response.body).toEqual({ cancelled: false });
  });
});

describe('the daily purge', () => {
  async function seedChats() {
    const direct = await ChatModel.create({ kind: 'direct', members: [{ userId: me, role: 'member' }, { userId: ana, role: 'member' }], lastSeq: 1 });
    const group = await ChatModel.create({ kind: 'group', name: 'Obra', members: [{ userId: me, role: 'admin' }, { userId: ana, role: 'member' }], lastSeq: 1 });
    await MessageModel.create([
      { chatId: direct._id, seq: 1, senderId: me, clientKey: 'k-direct', kind: 'text', body: 'hola', at: new Date() },
      { chatId: group._id, seq: 1, senderId: me, clientKey: 'k-group', kind: 'text', body: 'avance', at: new Date() },
    ]);
    return { directId: direct._id, groupId: group._id };
  }

  const askedDaysAgo = (days: number) => UserModel.updateOne({ _id: me }, { $set: { deletionRequestedAt: new Date(Date.now() - days * DAY_MS) } });

  it('waits for the grace to end', async () => {
    // Arrange
    await askedDaysAgo(ACCOUNT_DELETION_GRACE_DAYS - 1);

    // Act / Assert
    expect(await purgeDueAccounts()).toBe(0);
    expect((await UserModel.findById(me).lean())?.name).toBe('José');
  });

  it('erases who the person was and their 1:1s, and keeps their group messages signed «Cuenta eliminada»', async () => {
    // Arrange
    const { directId, groupId } = await seedChats();
    const solo = await seedSpace('Solo', [{ userId: me, role: 'owner', phone: PHONE }]);
    await InvitationModel.create({ phone: PHONE, invitedBy: 'seed' });
    await askedDaysAgo(ACCOUNT_DELETION_GRACE_DAYS + 1);

    // Act
    expect(await purgeDueAccounts()).toBe(1);

    // Assert
    const erased = await UserModel.findById(me).lean();
    expect(erased).toEqual(expect.objectContaining({ name: DELETED_ACCOUNT_NAME, phone: `deleted:${me}`, deletedAt: expect.any(Date) }));
    expect(erased).not.toHaveProperty('email');
    expect(erased).not.toHaveProperty('birthday');
    expect(erased).not.toHaveProperty('avatarUrl');
    expect(erased).not.toHaveProperty('autoReply');
    expect(await ChatModel.countDocuments({ _id: directId })).toBe(0);
    expect(await MessageModel.countDocuments({ chatId: directId })).toBe(0);
    expect(await MessageModel.countDocuments({ chatId: groupId, senderId: me })).toBe(1);
    expect((await ChatModel.findById(groupId).lean())?.members.map((member) => String(member.userId))).toEqual([String(ana)]);
    expect(await WorkspaceMemberModel.countDocuments({ userId: me })).toBe(0);
    expect((await WorkspaceModel.findById(solo).lean())?.deletedAt).toBeInstanceOf(Date);
    expect(await DeviceModel.countDocuments({ userId: me })).toBe(0);
    expect(await InvitationModel.countDocuments({ phone: PHONE })).toBe(0);
    expect((await UserModel.findById(ana).lean())?.blockedUsers).toEqual([]);
  });

  it('can run twice without touching an erased account again', async () => {
    // Arrange
    await askedDaysAgo(ACCOUNT_DELETION_GRACE_DAYS + 1);
    await purgeAccount(me);
    const once = await UserModel.findById(me).lean();

    // Act
    await purgeAccount(me);

    // Assert
    expect(await UserModel.findById(me).lean()).toEqual(once);
    expect(await purgeDueAccounts()).toBe(0);
  });

  it('passes a space that gained people during the grace to its admin', async () => {
    // Arrange
    const space = await seedSpace('Creció', [{ userId: me, role: 'owner', phone: PHONE }, { userId: ana, role: 'admin', phone: '987654321' }]);
    await askedDaysAgo(ACCOUNT_DELETION_GRACE_DAYS + 1);

    // Act
    await purgeDueAccounts();

    // Assert
    expect((await WorkspaceMemberModel.findOne({ workspaceId: space, userId: ana }).lean())?.role).toBe('owner');
    expect(String((await WorkspaceModel.findById(space).lean())?.ownerId)).toBe(String(ana));
  });

  it('refuses an account that never asked', async () => {
    // Act / Assert
    await expect(purgeAccount(ana)).rejects.toThrow('did not ask');
  });

  it('a new sign-in with the old phone after the purge is a new account', async () => {
    // Arrange
    await askedDaysAgo(ACCOUNT_DELETION_GRACE_DAYS + 1);
    await purgeDueAccounts();

    // Act
    const response = await request(app).post('/api/auth/otp/verify').send({ phone: PHONE, code: '123456', deviceId: 'd-new' });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.user.id).not.toBe(String(me));
  });
});
