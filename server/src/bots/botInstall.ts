import { Types } from 'mongoose';
import { ChatModel } from '../chatModels.js';
import { UserModel } from '../models.js';
import { BotInstallationModel, type BotApp, type BotInstallation } from './botModels.js';
import { forgetBots } from './botRegistry.js';
import { announceLater, announceSpaceApps } from './botAnnounce.js';
import { newSecret, sha256 } from './botSecrets.js';

/**
 * Installing an app in a space (`specs/BOTS-API.spec.md` §a): one installation
 * per app and space, with its own bot user (a member with the app's name), a
 * token and a signing secret that are returned only here. Reinstalling
 * replaces the token and the secret of the same installation, so the old ones
 * stop working at once; the bot user and its chats stay.
 */
export type InstalledApp = { installation: BotInstallation; token: string; signingSecret: string };

/** The bot user's `phone` is an internal key: it is not a Peruvian number, so nobody logs in with it. */
const botPhone = (appId: Types.ObjectId, workspaceId: Types.ObjectId) => `app:${appId}:${workspaceId}`;

async function botUserFor(app: BotApp, workspaceId: Types.ObjectId, installationId: Types.ObjectId): Promise<Types.ObjectId> {
  const user = await UserModel.findOneAndUpdate(
    { phone: botPhone(app._id, workspaceId) },
    { $set: { name: app.name, ...(app.avatarUrl ? { avatarUrl: app.avatarUrl } : {}), app: { appId: app._id, installationId, workspaceId } } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return user!._id;
}

/** The bot is in every public channel of its space (spec §d); a private one, only if someone adds it. */
export async function joinPublicChannels(workspaceId: Types.ObjectId, botUserId: Types.ObjectId): Promise<void> {
  await ChatModel.updateMany(
    { workspaceId, 'channel.visibility': 'public', 'members.userId': { $ne: botUserId } },
    { $push: { members: { userId: botUserId, role: 'member', joinedAt: new Date() } } }
  );
}

/** A public channel just created: the space's installed bots are in it too. */
export async function addBotsToPublicChannel(workspaceId: Types.ObjectId, chatId: Types.ObjectId): Promise<void> {
  const [bots, chat] = await Promise.all([
    BotInstallationModel.find({ workspaceId, revokedAt: { $exists: false } }).select('botUserId').lean(),
    ChatModel.findById(chatId).select('members.userId appsRemoved').lean(),
  ]);
  // Not twice (a channel made public may have them already), and not one an admin took out (pending 91).
  const outside = new Set([...(chat?.members ?? []).map((member) => String(member.userId)), ...(chat?.appsRemoved ?? []).map(String)]);
  const joining = bots.filter((bot) => !outside.has(String(bot.botUserId)));
  if (joining.length === 0) return;
  await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: joining.map((bot) => ({ userId: bot.botUserId, role: 'member', joinedAt: new Date() })) } } });
}

export async function installApp(params: { app: BotApp; workspaceId: Types.ObjectId; installedBy: Types.ObjectId }): Promise<InstalledApp> {
  const token = newSecret('lcb_');
  const signingSecret = newSecret('lcs_');
  const existing = await BotInstallationModel.findOne({ appId: params.app._id, workspaceId: params.workspaceId }).select('_id').lean();
  const installationId = existing?._id ?? new Types.ObjectId();
  const botUserId = await botUserFor(params.app, params.workspaceId, installationId);
  const installation = await BotInstallationModel.findOneAndUpdate(
    { _id: installationId },
    {
      // What the app asks for now is what this admin accepted (a reinstall updates it).
      $set: { appId: params.app._id, workspaceId: params.workspaceId, botUserId, tokenHash: sha256(token), signingSecret, installedBy: params.installedBy, grantedScopes: params.app.scopes ?? [] },
      $unset: { revokedAt: 1 },
    },
    { upsert: true, returnDocument: 'after' }
  ).lean<BotInstallation>();
  await joinPublicChannels(params.workspaceId, botUserId);
  forgetBots();
  announceLater(announceSpaceApps(params.workspaceId));
  return { installation: installation!, token, signingSecret };
}

/**
 * The token dies and the bot leaves the space's channels and groups; its 1:1s
 * stay as history. From agentes (`POST /api/oauth/revoke`) or from Lilachat
 * (Integraciones), which also sends `app.uninstalled`.
 */
export async function revokeInstallation(installation: Pick<BotInstallation, '_id' | 'workspaceId' | 'botUserId'>): Promise<void> {
  await BotInstallationModel.updateOne({ _id: installation._id }, { $set: { revokedAt: new Date() } });
  await ChatModel.updateMany({ workspaceId: installation.workspaceId, kind: 'group', 'members.userId': installation.botUserId }, { $pull: { members: { userId: installation.botUserId } } });
  forgetBots();
  announceLater(announceSpaceApps(installation.workspaceId));
}

/** The installation behind a bot token, if it is still alive. */
export async function installationByToken(token: string): Promise<BotInstallation | null> {
  if (!token.startsWith('lcb_')) return null;
  return BotInstallationModel.findOne({ tokenHash: sha256(token), revokedAt: { $exists: false } }).lean<BotInstallation | null>();
}
