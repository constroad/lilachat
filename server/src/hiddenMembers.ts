import type { Types } from 'mongoose';
import { INCOGNITO_COMPOSER } from '@lilachat/shared';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { ChatModel } from './chatModels.js';
import { OnlyAdminsSendError } from './erroresDelChat.js';

/**
 * José, 12/11/2026: he supports Globofast for about a week as its superadmin, and the people who
 * join must not see him there. A `hidden` member is left out of what everyone ELSE sees of the
 * space (directory, counts, a group's or channel's people, «Info», who added or invited them).
 * José 13/11: not even in his own views («no mostrarme como miembro en ningún lado»), and he only
 * READS the space's chats («en ese modo no debo poder escribir»).
 */
export type HiddenBySpace = ReadonlyMap<string, ReadonlySet<string>>;
type SpaceId = Types.ObjectId | string | null | undefined;

const NONE: ReadonlySet<string> = new Set();

/** The hidden members of each space, in one query for all of them. */
export async function hiddenMembersOf(workspaceIds: readonly SpaceId[]): Promise<HiddenBySpace> {
  const ids = [...new Set(workspaceIds.flatMap((id) => (id ? [String(id)] : [])))];
  if (ids.length === 0) return new Map();
  const rows = await WorkspaceMemberModel.find({ workspaceId: { $in: ids }, hidden: true, userId: { $exists: true } }).select('workspaceId userId').lean();
  const bySpace = new Map<string, Set<string>>();
  for (const row of rows) bySpace.set(String(row.workspaceId), (bySpace.get(String(row.workspaceId)) ?? new Set<string>()).add(String(row.userId)));
  return bySpace;
}

/** Who `_viewerId` must not see in a space: everyone hidden there, himself included (José 13/11). PURE. */
export function hiddenInSpace(hidden: HiddenBySpace, workspaceId: SpaceId, _viewerId: string): ReadonlySet<string> {
  const inSpace = workspaceId ? hidden.get(String(workspaceId)) : undefined;
  return inSpace?.size ? inSpace : NONE;
}

/** Whether `viewerId` is hidden (incognito) in the chat's space: he only reads there. PURE. */
export function isIncognitoIn(hidden: HiddenBySpace, workspaceId: SpaceId, viewerId: string): boolean {
  return Boolean(workspaceId && hidden.get(String(workspaceId))?.has(viewerId));
}

/** Rejects a message from someone hidden in the chat's space. One query for everyone, two for him. */
export async function ensureNotIncognito(chatId: Types.ObjectId, senderId: Types.ObjectId): Promise<void> {
  const spaces = await WorkspaceMemberModel.find({ userId: senderId, hidden: true, status: 'active' }).select('workspaceId').lean();
  if (spaces.length === 0) return;
  if (await ChatModel.exists({ _id: chatId, workspaceId: { $in: spaces.map((space) => space.workspaceId) } })) throw new OnlyAdminsSendError(INCOGNITO_COMPOSER);
}

/** The same for a chat of the space. A 1:1 always shows the other person: it IS the conversation with him. PURE. */
export function hiddenInChat(hidden: HiddenBySpace, chat: { workspaceId?: SpaceId; kind?: string }, viewerId: string): ReadonlySet<string> {
  return chat.kind === 'direct' ? NONE : hiddenInSpace(hidden, chat.workspaceId, viewerId);
}
