import type { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * Chats that belong to a company space (E1, spec §66). Deactivating someone
 * moves them from `members` to `suspendedMembers` in every chat of that space:
 * every existing membership check in the server then denies them, and
 * reactivating moves them back with their role.
 */
export async function suspendFromWorkspaceChats(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const chats = await ChatModel.find({ workspaceId, 'members.userId': userId }).select('members').lean();
  await Promise.all(
    chats.map((chat) => {
      const member = chat.members.find((m) => String(m.userId) === String(userId));
      return ChatModel.updateOne({ _id: chat._id }, { $pull: { members: { userId } }, $push: { suspendedMembers: { userId, role: member?.role ?? 'member', joinedAt: member?.joinedAt } } });
    })
  );
}

export async function restoreToWorkspaceChats(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const chats = await ChatModel.find({ workspaceId, 'suspendedMembers.userId': userId }).select('suspendedMembers').lean();
  await Promise.all(
    chats.map((chat) => {
      const member = chat.suspendedMembers?.find((m) => String(m.userId) === String(userId));
      return ChatModel.updateOne({ _id: chat._id }, { $pull: { suspendedMembers: { userId } }, $push: { members: { userId, role: member?.role ?? 'member', joinedAt: member?.joinedAt ?? new Date() } } });
    })
  );
}

/** Leaving a space leaves its chats too. */
export async function leaveWorkspaceChats(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  await ChatModel.updateMany({ workspaceId }, { $pull: { members: { userId }, suspendedMembers: { userId } } });
}

/** Whether these people are all ACTIVE in the space (the creator included). */
export async function allActiveIn(workspaceId: Types.ObjectId, userIds: readonly Types.ObjectId[]): Promise<boolean> {
  const active = await WorkspaceMemberModel.countDocuments({ workspaceId, userId: { $in: userIds }, status: 'active' });
  return active === new Set(userIds.map(String)).size;
}
