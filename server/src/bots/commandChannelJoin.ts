import type { Types } from 'mongoose';
import type { AppItemSetting } from '@lilachat/shared';
import { ChatModel } from '../chatModels.js';
import type { BotInstallation } from './botModels.js';

/**
 * A private channel the space admin named for an app's command (José 18/11: /lila in #lila-pruebas answered only to
 * the asker, because the app was not in that private channel and nobody can add an app from the contact picker).
 * Naming the channel in «Comandos y acciones» is the admin adding the app there; «Todos» names no private channel,
 * and an app an admin took out of the channel stays out. True when the app joined now.
 */
export async function joinChannelEnabledByAdmin(installation: Pick<BotInstallation, 'botUserId'>, chatId: Types.ObjectId, setting: AppItemSetting): Promise<boolean> {
  if (!Array.isArray(setting.channels) || !setting.channels.includes(String(chatId))) return false;
  const joined = await ChatModel.updateOne(
    { _id: chatId, kind: 'group', 'channel.visibility': { $ne: 'public' }, 'members.userId': { $ne: installation.botUserId }, appsRemoved: { $ne: installation.botUserId } },
    { $push: { members: { userId: installation.botUserId, role: 'member', joinedAt: new Date() } } }
  );
  return joined.modifiedCount > 0;
}
