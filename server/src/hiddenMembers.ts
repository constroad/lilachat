import type { Types } from 'mongoose';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * José, 12/11/2026: he supports Globofast for about a week as its superadmin, and the people who
 * join must not see him there. A `hidden` member is left out of what everyone ELSE sees of the
 * space (directory, counts, a group's or channel's people, «Info», who added or invited them).
 * He still sees the space whole. His own messages stay signed: hiding them would be lying.
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

/** Who `viewerId` must not see in a space: everyone hidden there but himself. PURE. */
export function hiddenInSpace(hidden: HiddenBySpace, workspaceId: SpaceId, viewerId: string): ReadonlySet<string> {
  const inSpace = workspaceId ? hidden.get(String(workspaceId)) : undefined;
  if (!inSpace?.size) return NONE;
  return inSpace.has(viewerId) ? new Set([...inSpace].filter((id) => id !== viewerId)) : inSpace;
}

/** The same for a chat of the space. A 1:1 always shows the other person: it IS the conversation with him. PURE. */
export function hiddenInChat(hidden: HiddenBySpace, chat: { workspaceId?: SpaceId; kind?: string }, viewerId: string): ReadonlySet<string> {
  return chat.kind === 'direct' ? NONE : hiddenInSpace(hidden, chat.workspaceId, viewerId);
}
