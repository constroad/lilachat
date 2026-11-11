import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { startTestMongo } from './testMongo.js';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { BotInstallationModel } from './bots/botModels.js';
import { PURGE_AFTER_DAYS, purgeDeletedWorkspaces, purgeWorkspace } from './workspacePurge.js';

/** José 11/11: a deleted space is erased for real after a while; nothing else is touched. */
let mongo: MongoMemoryServer;
const DAY_MS = 24 * 60 * 60 * 1000;
const owner = new Types.ObjectId();

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([WorkspaceModel, WorkspaceMemberModel, ChatModel, MessageModel, ReceiptModel, BotInstallationModel].map((model) => (model as mongoose.Model<unknown>).deleteMany({})));
});

/** A space with a member, a channel, a message, a receipt and an app; deleted `daysAgo` days ago, or alive. */
async function seedSpace(name: string, daysAgo: number | null) {
  const space = await WorkspaceModel.create({ name, ownerId: owner, joinCode: `${name.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, ...(daysAgo === null ? {} : { deletedAt: new Date(Date.now() - daysAgo * DAY_MS), deletedBy: owner }) });
  await WorkspaceMemberModel.create({ workspaceId: space._id, userId: owner, phone: '902049935', role: 'owner', status: 'active' });
  const chat = await ChatModel.create({ kind: 'group', workspaceId: space._id, name: 'general', members: [], lastSeq: 1 });
  await MessageModel.create({ chatId: chat._id, seq: 1, senderId: owner, clientKey: `k-${name}`, kind: 'text', body: 'hola', at: new Date() });
  await ReceiptModel.create({ chatId: chat._id, userId: owner, readSeq: 1, deliveredSeq: 1 });
  await BotInstallationModel.create({ appId: new Types.ObjectId(), workspaceId: space._id, botUserId: new Types.ObjectId(), tokenHash: `h-${name}`, signingSecret: 's', installedBy: owner, revokedAt: new Date() });
  return { spaceId: space._id, chatId: chat._id };
}

async function leftOf(seed: { spaceId: Types.ObjectId; chatId: Types.ObjectId }) {
  const [space, members, chats, messages, receipts, apps] = await Promise.all([
    WorkspaceModel.countDocuments({ _id: seed.spaceId }),
    WorkspaceMemberModel.countDocuments({ workspaceId: seed.spaceId }),
    ChatModel.countDocuments({ workspaceId: seed.spaceId }),
    MessageModel.countDocuments({ chatId: seed.chatId }),
    ReceiptModel.countDocuments({ chatId: seed.chatId }),
    BotInstallationModel.countDocuments({ workspaceId: seed.spaceId }),
  ]);
  return { space, members, chats, messages, receipts, apps };
}

describe('purging deleted spaces', () => {
  it(`erases a space deleted more than ${PURGE_AFTER_DAYS} days ago and leaves the rest alone`, async () => {
    const old = await seedSpace('Vieja', PURGE_AFTER_DAYS + 1);
    const recent = await seedSpace('Reciente', PURGE_AFTER_DAYS - 1);
    const alive = await seedSpace('Activa', null);

    expect(await purgeDeletedWorkspaces()).toBe(1);

    expect(await leftOf(old)).toEqual({ space: 0, members: 0, chats: 0, messages: 0, receipts: 0, apps: 0 });
    const kept = { space: 1, members: 1, chats: 1, messages: 1, receipts: 1, apps: 1 };
    expect(await leftOf(recent)).toEqual(kept);
    expect(await leftOf(alive)).toEqual(kept);
  });

  it('refuses to empty a space that is not deleted', async () => {
    const alive = await seedSpace('Activa', null);
    await expect(purgeWorkspace(alive.spaceId)).rejects.toThrow(/not deleted/);
    expect(await leftOf(alive)).toEqual({ space: 1, members: 1, chats: 1, messages: 1, receipts: 1, apps: 1 });
  });

  it('with nothing due it does nothing', async () => {
    await seedSpace('Activa', null);
    expect(await purgeDeletedWorkspaces()).toBe(0);
  });
});
