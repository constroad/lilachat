import type { Types } from 'mongoose';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * «Your spaces changed, read them again» to the people a change touches: the
 * admins when a request arrives, the person approved, added, rejected,
 * deactivated or given another role. Socket-free so the logic is testable; the
 * socket server plugs the emitter in (`configureWorkspaceNotices`).
 */
type Notify = (userIds: readonly string[]) => void;
let notify: Notify = () => undefined;

export function configureWorkspaceNotices(emit: Notify): void {
  notify = emit;
}

export function noticeSpacesChanged(userIds: readonly (string | { toString(): string } | undefined)[]): void {
  const ids = [...new Set(userIds.flatMap((id) => (id ? [String(id)] : [])))];
  if (ids.length) notify(ids);
}

/**
 * «The people of this space changed» (22/10): someone joined, left, was
 * approved, deactivated, or got another role, title or area. Its active
 * members refresh the directory instead of asking for it on every open.
 */
type NotifyMembers = (userIds: readonly string[], workspaceId: string) => void;
let notifyMembers: NotifyMembers = () => undefined;

export function configureMembersNotices(emit: NotifyMembers): void {
  notifyMembers = emit;
}

export async function noticeMembersChanged(workspaceId: Types.ObjectId): Promise<void> {
  const active = await WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } }).select('userId').lean();
  const ids = active.map((member) => String(member.userId));
  if (ids.length) notifyMembers(ids, String(workspaceId));
}
