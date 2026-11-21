import { Types } from 'mongoose';
import { ChatModel } from '../chatModels.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { noticeChannelJoined } from '../workspaceNotices.js';

/**
 * Shared by `botProspects.ts` and `botWhatsapp.ts`: a per-prospect or per-WhatsApp-group channel adds
 * EVERY active member of the space, unlike a client channel's admins-only (`botClients.ts`).
 */
export async function activeMemberIds(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const members = await WorkspaceMemberModel.find({ workspaceId, status: 'active' }).select('userId').lean();
  return members.flatMap((member) => (member.userId ? [member.userId] : []));
}

/** A member who joined the space after the channel was born enters with the next PUT. */
export async function addMissingMembers(installation: { workspaceId: Types.ObjectId }, chatId: Types.ObjectId): Promise<void> {
  const chat = await ChatModel.findById(chatId).select('members.userId').lean();
  if (!chat) return;
  const inside = new Set(chat.members.map((member) => String(member.userId)));
  const missing = (await activeMemberIds(installation.workspaceId)).filter((userId) => !inside.has(String(userId)));
  if (!missing.length) return;
  await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: missing.map((userId) => ({ userId, role: 'member' })) } } });
  missing.forEach((userId) => noticeChannelJoined(userId, chatId));
}
