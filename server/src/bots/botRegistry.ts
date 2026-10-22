import type { Types } from 'mongoose';
import { BotInstallationModel } from './botModels.js';

/**
 * Which users are bots, in memory: every message sent asks whether a bot is
 * among its members, and a query per message to answer «no» almost always
 * would be pure cost. Loaded once, forgotten when an app is installed or
 * removed. One server process (the mini); with more, each forgets on its own
 * install or removal and reloads within `RELOAD_MS`.
 */
export type BotOfUser = { installationId: Types.ObjectId; appId: Types.ObjectId; workspaceId: Types.ObjectId; botUserId: Types.ObjectId };

const RELOAD_MS = 10 * 60_000;
let cache: { byUser: Map<string, BotOfUser>; loadedAt: number } | null = null;

async function load(): Promise<Map<string, BotOfUser>> {
  if (cache && Date.now() - cache.loadedAt < RELOAD_MS) return cache.byUser;
  const active = await BotInstallationModel.find({ revokedAt: { $exists: false } }).select('_id appId workspaceId botUserId').lean();
  const byUser = new Map(active.map((one) => [String(one.botUserId), { installationId: one._id, appId: one.appId, workspaceId: one.workspaceId, botUserId: one.botUserId }]));
  cache = { byUser, loadedAt: Date.now() };
  return byUser;
}

export async function botOfUser(userId: string): Promise<BotOfUser | undefined> {
  return (await load()).get(userId);
}

/** The bots among a chat's members (usually none: then nothing else is asked). */
export async function botsAmong(memberIds: readonly string[]): Promise<BotOfUser[]> {
  const byUser = await load();
  if (byUser.size === 0) return [];
  return memberIds.flatMap((id) => byUser.get(id) ?? []);
}

export function forgetBots(): void {
  cache = null;
}
