import type { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { WorkspaceMemberModel } from './workspaceModels.js';
import { SharedChannelModel } from './sharedChannelModel.js';
import { dropOutsiders } from './sharedChannels.js';

/**
 * José 11/11: in the channels shared INTO this space, whoever was there only through it goes out
 * (deactivated or gone). They are not suspended there: reactivating them does not bring them back,
 * someone adds them again.
 */
async function dropFromSharedInto(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const shares = await SharedChannelModel.find({ workspaceId, status: 'active' }).select('chatId').lean();
  if (shares.length === 0) return;
  const chats = await ChatModel.find({ _id: { $in: shares.map((share) => share.chatId) }, 'members.userId': userId }).select('_id').lean();
  await Promise.all(chats.map((chat) => dropOutsiders(chat._id)));
}

/**
 * José 12/11 (Medaly): this space's channels shared with others that the person still reaches
 * through one of those spaces, where they stay active. Leaving or being deactivated here does not
 * take them out of those.
 */
async function reachedElsewhere(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const shares = await SharedChannelModel.find({ ownerWorkspaceId: workspaceId, status: 'active' }).select('chatId workspaceId').lean();
  if (shares.length === 0) return [];
  const active = await WorkspaceMemberModel.find({ workspaceId: { $in: shares.map((share) => share.workspaceId) }, userId, status: 'active' }).select('workspaceId').lean();
  const spaces = new Set(active.map((row) => String(row.workspaceId)));
  return shares.filter((share) => spaces.has(String(share.workspaceId))).map((share) => share.chatId);
}

/**
 * Chats that belong to a company space (E1, spec §66). Deactivating someone
 * moves them from `members` to `suspendedMembers` in every chat of that space:
 * every existing membership check in the server then denies them, and
 * reactivating moves them back with their role.
 */
export async function suspendFromWorkspaceChats(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  await dropFromSharedInto(workspaceId, userId);
  const kept = await reachedElsewhere(workspaceId, userId);
  const chats = await ChatModel.find({ workspaceId, 'members.userId': userId, _id: { $nin: kept } }).select('members').lean();
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
  await dropFromSharedInto(workspaceId, userId);
  const kept = await reachedElsewhere(workspaceId, userId);
  await ChatModel.updateMany({ workspaceId, _id: { $nin: kept } }, { $pull: { members: { userId }, suspendedMembers: { userId } } });
}

/** Whether these people are all ACTIVE in the space (the creator included). */
export async function allActiveIn(workspaceId: Types.ObjectId, userIds: readonly Types.ObjectId[]): Promise<boolean> {
  const active = await WorkspaceMemberModel.countDocuments({ workspaceId, userId: { $in: userIds }, status: 'active' });
  return active === new Set(userIds.map(String)).size;
}
