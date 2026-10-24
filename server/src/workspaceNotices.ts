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

/**
 * «This chat is yours now» to whoever created or joined a channel (José, 23/10:
 * the new channel did not show until refreshing by hand). Their devices read
 * the space's list again (`chat.changed`), the same as any other change.
 */
type NotifyChat = (userId: string, chatId: string) => void;
let notifyChat: NotifyChat = () => undefined;

export function configureChannelNotices(emit: NotifyChat): void {
  notifyChat = emit;
}

export function noticeChannelJoined(userId: Types.ObjectId | string, chatId: Types.ObjectId | string): void {
  notifyChat(String(userId), String(chatId));
}
