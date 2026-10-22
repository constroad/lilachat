import { Types } from 'mongoose';
import { addBotsToPublicChannel } from './bots/botInstall.js';
import { ChatModel, ReceiptModel } from './chatModels.js';
import { escribirAviso } from './chatService.js';
import { UserModel } from './models.js';
import { avisarCambioDeChat, publicarMensaje } from './reparto.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { noticeMembersChanged } from './workspaceNotices.js';

/**
 * #general of a company space (José, 22/10, like Slack): every active member is
 * in it, and «Ana se unió al espacio» lands there when someone becomes active
 * (joins an open space, is approved, added with an account, or claims a phone
 * or email invite). A space born before this gets its #general on the first
 * look, with everyone already active and no notices.
 */
export const GENERAL_CHANNEL = 'general';

async function createGeneral(workspaceId: Types.ObjectId): Promise<Types.ObjectId> {
  const active = await WorkspaceMemberModel.find({ workspaceId, status: 'active', userId: { $exists: true } }).select('userId role').lean();
  const adopted = await ChatModel.findOne({ workspaceId, 'channel.visibility': 'public', name: GENERAL_CHANNEL }).select('_id').lean();
  if (adopted) {
    const missing = active.filter((member) => member.userId).map((member) => ({ userId: member.userId, role: 'member' as const, joinedAt: new Date() }));
    for (const member of missing) await ChatModel.updateOne({ _id: adopted._id, 'members.userId': { $ne: member.userId } }, { $push: { members: member } });
    return adopted._id;
  }
  const chat = await ChatModel.create({
    kind: 'group',
    name: GENERAL_CHANNEL,
    workspaceId,
    channel: { visibility: 'public' },
    members: active.map((member) => ({ userId: member.userId, role: member.role === 'owner' || member.role === 'admin' ? 'admin' : 'member' })),
    lastSeq: 0,
  });
  await addBotsToPublicChannel(workspaceId, chat._id);
  return chat._id;
}

/** The space's #general, created (or adopted, if a «general» channel exists) the first time it is needed. */
export async function ensureGeneralChannel(workspaceId: Types.ObjectId): Promise<Types.ObjectId | null> {
  const space = await WorkspaceModel.findById(workspaceId).select('generalChatId').lean();
  if (!space) return null;
  if (space.generalChatId && (await ChatModel.exists({ _id: space.generalChatId }))) return space.generalChatId;
  const chatId = await createGeneral(workspaceId);
  // Two first looks at once: the one that writes first wins and the other drops its copy.
  const claimed = await WorkspaceModel.updateOne({ _id: workspaceId, generalChatId: space.generalChatId ?? { $exists: false } }, { $set: { generalChatId: chatId } });
  if (claimed.modifiedCount === 1) return chatId;
  const winner = (await WorkspaceModel.findById(workspaceId).select('generalChatId').lean())?.generalChatId ?? null;
  if (winner && String(winner) !== String(chatId)) await ChatModel.deleteOne({ _id: chatId, lastSeq: 0 });
  return winner;
}

/** Someone became active in the space: into #general, and the space hears it once (only with a name: «Alguien se unió» says nothing). */
export async function welcomeToGeneral(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const chatId = await ensureGeneralChannel(workspaceId);
  if (!chatId) return;
  const added = await ChatModel.updateOne({ _id: chatId, 'members.userId': { $ne: userId } }, { $push: { members: { userId, role: 'member', joinedAt: new Date() } } });
  avisarCambioDeChat(String(userId), String(chatId));
  // Every way of becoming active ends here: the space's directories refresh once.
  void noticeMembersChanged(workspaceId).catch(() => undefined);
  const user = await UserModel.findById(userId).select('name phone').lean();
  if (added.modifiedCount === 0 || !user?.name) return;
  const notice = await escribirAviso({ chatId: String(chatId), quien: userId, evento: 'se-unio-espacio', body: `${user.name} se unió al espacio`, quien2: { name: user.name, phone: user.phone } });
  if (!notice) return;
  // Their own arrival is not news to them: #general does not open unread for the newcomer.
  await ReceiptModel.updateOne({ chatId, userId }, { $max: { readSeq: notice.seq, deliveredSeq: notice.seq } }, { upsert: true });
  const members = (await ChatModel.findById(chatId).select('members.userId').lean())?.members.map((member) => String(member.userId)) ?? [];
  await publicarMensaje(notice, members);
}
