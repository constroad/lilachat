import type { Types } from 'mongoose';
import { broadcastStatus, isPresenceMode, type PresenceMode, type PresenceStatus } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { isOnline, onlineAmong } from './presence.js';
import { blockedEitherWay } from './blockedContacts.js';

/**
 * The presence each person chooses (pending 15): «En línea» (automatic),
 * «Ausente», «Ocupado» or «Invisible», and whether «últ. vez» is shown. Kept
 * in memory for whoever is connected (read when the socket connects), like the
 * presence itself. The real online state stays as it was: pushes depend on it.
 */
export type PresencePrefs = { mode: PresenceMode; lastSeenHidden: boolean };

const DEFAULT_PREFS: PresencePrefs = { mode: 'auto', lastSeenHidden: false };
const prefsByUser = new Map<string, PresencePrefs>();

export function prefsFromUser(user: { presenceMode?: unknown; lastSeenHidden?: unknown } | null | undefined): PresencePrefs {
  return { mode: isPresenceMode(user?.presenceMode) ? user.presenceMode : 'auto', lastSeenHidden: user?.lastSeenHidden === true };
}

export async function loadPresencePrefs(userId: string): Promise<PresencePrefs> {
  const user = await UserModel.findById(userId).select('presenceMode lastSeenHidden').lean();
  const prefs = prefsFromUser(user);
  prefsByUser.set(userId, prefs);
  return prefs;
}

export const presencePrefsOf = (userId: string): PresencePrefs => prefsByUser.get(userId) ?? DEFAULT_PREFS;

export function rememberPresencePrefs(userId: string, prefs: PresencePrefs): void {
  prefsByUser.set(userId, prefs);
}

/** Who of these shows as online, and with which word: someone invisible never does. */
export function presenceSnapshot(userIds: string[]): { online: string[]; statuses: Record<string, PresenceStatus> } {
  const online = onlineAmong(userIds).filter((id) => presencePrefsOf(id).mode !== 'invisible');
  const statuses: Record<string, PresenceStatus> = {};
  for (const id of online) {
    const status = broadcastStatus(presencePrefsOf(id).mode);
    if (status) statuses[id] = status;
  }
  return { online, statuses };
}

/** What a connected person's contacts are told about them right now. */
export function presenceFrameOf(userId: string): { userId: string; online: boolean; status?: PresenceStatus } {
  const { mode } = presencePrefsOf(userId);
  if (!isOnline(userId) || mode === 'invisible') return { userId, online: false };
  const status = broadcastStatus(mode);
  return { userId, online: true, ...(status ? { status } : {}) };
}

/**
 * Who shares a chat with me: the only people my presence matters to, and the
 * only ones it may be told to. A stranger has no business knowing I am online.
 */
export async function contactIdsOf(userId: Types.ObjectId | string): Promise<string[]> {
  const [chats, blocks] = await Promise.all([
    ChatModel.find({ 'members.userId': userId }).select('members.userId').lean(),
    blockedEitherWay(userId),
  ]);
  const ids = new Set<string>();
  for (const chat of chats) {
    for (const member of chat.members) {
      const id = String(member.userId);
      if (id !== String(userId)) ids.add(id);
    }
  }
  return [...ids].filter((id) => !blocks.has(id));
}

export function __resetPresenceModes(): void {
  prefsByUser.clear();
}
