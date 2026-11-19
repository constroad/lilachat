import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { ALL_OFF, type AppItemSetting } from '@lilachat/shared';
import { startTestMongo } from '../testMongo.js';
import { ChatModel } from '../chatModels.js';
import { joinChannelEnabledByAdmin } from './commandChannelJoin.js';

/** /lila in a private channel answered only to the asker (José 18/11): the admin had named that channel for the command, but the app was not in it. */
let mongo: MongoMemoryServer;
const jose = new Types.ObjectId();
const bot = new Types.ObjectId();
const spaceId = new Types.ObjectId();
let privateChannel: Types.ObjectId;
let publicChannel: Types.ObjectId;

const namedFor = (...chats: Types.ObjectId[]): AppItemSetting => ({ ...ALL_OFF, channels: chats.map(String), who: { kind: 'everyone' } });
const membersOf = async (chatId: Types.ObjectId) => ((await ChatModel.findById(chatId).select('members.userId').lean())?.members ?? []).map((member) => String(member.userId));

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri('lilachat_command_channel_join'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await ChatModel.deleteMany({});
  const group = (name: string, visibility: 'public' | 'private') => ChatModel.create({ kind: 'group' as const, name, workspaceId: spaceId, channel: { visibility }, members: [{ userId: jose, role: 'admin' as const }], lastSeq: 0 });
  privateChannel = (await group('lila-pruebas', 'private'))._id;
  publicChannel = (await group('general', 'public'))._id;
});

describe('joinChannelEnabledByAdmin', () => {
  it('lets the app into a private channel the admin named for the command', async () => {
    // Act
    const joined = await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, namedFor(privateChannel));
    // Assert
    expect(joined).toBe(true);
    expect(await membersOf(privateChannel)).toContain(String(bot));
  });

  it('does nothing when the command is on in every channel: «Todos» names no private one', async () => {
    const joined = await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, { ...namedFor(), channels: 'all' });
    expect(joined).toBe(false);
    expect(await membersOf(privateChannel)).not.toContain(String(bot));
  });

  it('does nothing for a channel that is not on the list', async () => {
    expect(await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, namedFor(publicChannel))).toBe(false);
  });

  it('never brings back an app an admin took out of the channel', async () => {
    // Arrange
    await ChatModel.updateOne({ _id: privateChannel }, { $set: { appsRemoved: [bot] } });
    // Act / Assert
    expect(await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, namedFor(privateChannel))).toBe(false);
    expect(await membersOf(privateChannel)).not.toContain(String(bot));
  });

  it('is a no-op for a public channel (the app joins it on its first message) and when already in', async () => {
    expect(await joinChannelEnabledByAdmin({ botUserId: bot }, publicChannel, namedFor(publicChannel))).toBe(false);
    await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, namedFor(privateChannel));
    expect(await joinChannelEnabledByAdmin({ botUserId: bot }, privateChannel, namedFor(privateChannel))).toBe(false);
    expect((await membersOf(privateChannel)).filter((id) => id === String(bot))).toHaveLength(1);
  });
});
