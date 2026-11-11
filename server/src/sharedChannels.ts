import { Types } from 'mongoose';
import { shareRefusal, shareStatusFor, spacesWithAccess, type ChannelShare, type ShareInvite } from '@lilachat/shared';
import { ChatModel, type Chat } from './chatModels.js';
import { SharedChannelModel, type SharedChannel } from './sharedChannelModel.js';
import { ClientChannelModel } from './bots/botClients.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { UserModel } from './models.js';
import { avisarCambioDeChat } from './reparto.js';
import { actorIn, activeIdsOf, WorkspaceError } from './workspaces.js';
import { WorkspaceMemberModel, WorkspaceModel } from './workspaceModels.js';
import { noticeSpacesChanged } from './workspaceNotices.js';

/**
 * Channels shared between company spaces (José 11/11, like Slack Connect). A
 * side table, like `ClientChannel`: the channel stays its owner's
 * (`chat.workspaceId`) and `channel.shared` marks the ones with an active
 * share, so the rest pay no extra query. Rules: `shared/sharedChannels.ts`.
 */


const NO_CHANNEL = 'Ese canal no existe.';

/** The channels shared INTO a space and accepted: they list there under their owner's name. */
export async function sharedChatIdsInto(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
  return (await SharedChannelModel.find({ workspaceId, status: 'active' }).select('chatId').lean()).map((row) => row.chatId);
}

/** The spaces whose active members may be in this chat: its own, plus the active shares of a shared channel. */
export async function spaceIdsWithAccess(chat: Pick<Chat, '_id' | 'workspaceId' | 'channel'>): Promise<Types.ObjectId[]> {
  if (!chat.workspaceId) return [];
  if (!chat.channel?.shared) return [chat.workspaceId];
  const shares = await SharedChannelModel.find({ chatId: chat._id, status: 'active' }).select('workspaceId status').lean();
  return spacesWithAccess(String(chat.workspaceId), shares.map((share) => ({ workspaceId: String(share.workspaceId), status: share.status }))).map((id) => new Types.ObjectId(id));
}

/** Whether this person is active in at least one of these spaces. */
export async function activeInAny(spaceIds: readonly Types.ObjectId[], userId: Types.ObjectId): Promise<boolean> {
  if (spaceIds.length === 0) return false;
  return Boolean(await WorkspaceMemberModel.exists({ workspaceId: { $in: spaceIds }, userId, status: 'active' }));
}

async function ownedChannel(ownerWorkspaceId: Types.ObjectId, chatId: string): Promise<Chat> {
  if (!Types.ObjectId.isValid(chatId)) throw new WorkspaceError(404, NO_CHANNEL);
  const chat = await ChatModel.findOne({ _id: chatId, workspaceId: ownerWorkspaceId, 'channel.visibility': { $exists: true } }).lean<Chat | null>();
  if (!chat) throw new WorkspaceError(404, NO_CHANNEL);
  return chat;
}

/** `channel.shared` follows the active shares, so a channel without any lists and sends as before. */
async function syncSharedFlag(chatId: Types.ObjectId): Promise<void> {
  const shared = Boolean(await SharedChannelModel.exists({ chatId, status: 'active' }));
  await ChatModel.updateOne({ _id: chatId }, shared ? { $set: { 'channel.shared': true } } : { $unset: { 'channel.shared': 1 } });
}

async function addToChannel(chatId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  await ChatModel.updateOne({ _id: chatId, 'members.userId': { $ne: userId } }, { $push: { members: { userId, role: 'member', joinedAt: new Date() } } });
}

/** Shares a channel of `ownerId` with another space of the one sharing; active at once when they also run it. */
export async function shareChannel(ownerId: string, actorId: Types.ObjectId, chatId: string, targetId: unknown): Promise<ChannelShare[]> {
  const actor = await actorIn(ownerId, actorId);
  const chat = await ownedChannel(actor.workspaceId, chatId);
  if (typeof targetId !== 'string' || !Types.ObjectId.isValid(targetId)) throw new WorkspaceError(400, 'Elige el espacio con el que lo compartes.');
  const target = new Types.ObjectId(targetId);
  const [space, membership, isClientChannel, targetSpace] = await Promise.all([
    WorkspaceModel.findById(actor.workspaceId).select('generalChatId').lean(),
    WorkspaceMemberModel.findOne({ workspaceId: target, userId: actorId, status: 'active' }).select('role').lean(),
    ClientChannelModel.exists({ chatId: chat._id }),
    WorkspaceModel.findOne({ _id: target, deletedAt: { $exists: false } }).select('_id').lean(),
  ]);
  const refusal = shareRefusal({ role: actor.role, isChannel: true, isGeneral: Boolean(space?.generalChatId?.equals(chat._id)), isClientChannel: Boolean(isClientChannel), sameSpace: target.equals(actor.workspaceId), memberOfTarget: Boolean(membership && targetSpace) });
  if (refusal) throw new WorkspaceError(refusal.includes('admin') ? 403 : 400, refusal);
  const status = shareStatusFor(membership?.role ?? null);
  await SharedChannelModel.updateOne(
    { chatId: chat._id, workspaceId: target },
    { $set: { ownerWorkspaceId: actor.workspaceId, status, invitedBy: actorId, ...(status === 'active' ? { acceptedBy: actorId } : {}) }, $unset: { removedBy: 1 } },
    { upsert: true }
  );
  if (status === 'active') {
    await syncSharedFlag(chat._id);
    await addToChannel(chat._id, actorId);
    avisarCambioDeChat(String(actorId), String(chat._id));
  } else {
    noticeSpacesChanged(await activeIdsOf(target, { role: { $in: ['owner', 'admin'] } }));
  }
  return listShares(ownerId, actorId, chatId);
}

/** The spaces a channel is shared with (active or waiting), for its share dialog. Anyone in the owner space sees them. */
export async function listShares(ownerId: string, actorId: Types.ObjectId, chatId: string): Promise<ChannelShare[]> {
  const actor = await actorIn(ownerId, actorId);
  const chat = await ownedChannel(actor.workspaceId, chatId);
  const rows = await SharedChannelModel.find({ chatId: chat._id, status: { $in: ['pending', 'active'] } }).lean<SharedChannel[]>();
  if (rows.length === 0) return [];
  const spaces = await WorkspaceModel.find({ _id: { $in: rows.map((row) => row.workspaceId) }, deletedAt: { $exists: false } }).select('name logoUrl').lean();
  const byId = new Map(spaces.map((space) => [String(space._id), space]));
  return rows.flatMap((row) => {
    const space = byId.get(String(row.workspaceId));
    if (!space) return [];
    return [{ workspaceId: String(row.workspaceId), name: space.name, ...(space.logoUrl ? { logoUrl: toAbsoluteMediaUrl(space.logoUrl) } : {}), status: row.status === 'active' ? 'active' : 'pending' } satisfies ChannelShare];
  });
}

/** Channels offered to a space and waiting for one of its admins (the card on top of its list). */
export async function listShareInvites(workspaceId: string, actorId: Types.ObjectId): Promise<ShareInvite[]> {
  const actor = await actorIn(workspaceId, actorId);
  if (actor.role !== 'owner' && actor.role !== 'admin') return [];
  const rows = await SharedChannelModel.find({ workspaceId: actor.workspaceId, status: 'pending' }).lean<SharedChannel[]>();
  if (rows.length === 0) return [];
  const [chats, owners, inviters] = await Promise.all([
    ChatModel.find({ _id: { $in: rows.map((row) => row.chatId) }, 'channel.visibility': { $exists: true } }).select('name').lean(),
    WorkspaceModel.find({ _id: { $in: rows.map((row) => row.ownerWorkspaceId) }, deletedAt: { $exists: false } }).select('name logoUrl').lean(),
    UserModel.find({ _id: { $in: rows.map((row) => row.invitedBy) } }).select('name').lean(),
  ]);
  const chatById = new Map(chats.map((chat) => [String(chat._id), chat]));
  const ownerById = new Map(owners.map((owner) => [String(owner._id), owner]));
  const inviterById = new Map(inviters.map((user) => [String(user._id), user]));
  return rows.flatMap((row) => {
    const chat = chatById.get(String(row.chatId));
    const owner = ownerById.get(String(row.ownerWorkspaceId));
    if (!chat || !owner) return [];
    const invitedBy = inviterById.get(String(row.invitedBy))?.name;
    return [{ chatId: String(row.chatId), channelName: chat.name ?? '', from: { workspaceId: String(owner._id), name: owner.name, ...(owner.logoUrl ? { logoUrl: toAbsoluteMediaUrl(owner.logoUrl) } : {}) }, ...(invitedBy ? { invitedBy } : {}) }];
  });
}

/** An admin of the receiving space accepts (and enters the channel) or turns it down. */
export async function answerShareInvite(workspaceId: string, actorId: Types.ObjectId, chatId: string, accept: boolean): Promise<void> {
  const actor = await actorIn(workspaceId, actorId);
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkspaceError(403, 'Solo un admin del espacio acepta canales compartidos.');
  if (!Types.ObjectId.isValid(chatId)) throw new WorkspaceError(404, NO_CHANNEL);
  const row = await SharedChannelModel.findOneAndUpdate(
    { chatId, workspaceId: actor.workspaceId, status: 'pending' },
    { $set: accept ? { status: 'active', acceptedBy: actorId } : { status: 'removed', removedBy: actorId } },
    { returnDocument: 'after' }
  ).lean<SharedChannel | null>();
  if (!row) throw new WorkspaceError(404, 'Esa invitación ya no está.');
  if (!accept) return;
  await syncSharedFlag(row.chatId);
  await addToChannel(row.chatId, actorId);
  avisarCambioDeChat(String(actorId), String(row.chatId));
}

/**
 * Ends a share: the owner space's admins stop sharing, or the receiving space's admins leave.
 * Whoever was in the channel only through that space goes out of it.
 */
export async function endShare(viewingId: string, actorId: Types.ObjectId, chatId: string, targetId: string): Promise<void> {
  const actor = await actorIn(viewingId, actorId);
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkspaceError(403, 'Solo un admin del espacio puede dejar de compartir.');
  if (!Types.ObjectId.isValid(chatId) || !Types.ObjectId.isValid(targetId)) throw new WorkspaceError(404, NO_CHANNEL);
  const row = await SharedChannelModel.findOne({ chatId, workspaceId: targetId, status: { $in: ['pending', 'active'] } }).lean<SharedChannel | null>();
  // Only the owner space or the receiving space itself may end it.
  if (!row || !(row.ownerWorkspaceId.equals(actor.workspaceId) || row.workspaceId.equals(actor.workspaceId))) throw new WorkspaceError(404, NO_CHANNEL);
  await SharedChannelModel.updateOne({ _id: row._id }, { $set: { status: 'removed', removedBy: actorId } });
  await syncSharedFlag(row.chatId);
  await dropOutsiders(row.chatId);
}

/**
 * A deleted space shares nothing and receives nothing: every share it owns or
 * received ends, and the people who were in a channel only through it leave.
 */
export async function endSharesOfDeletedSpace(workspaceId: Types.ObjectId, actorId: Types.ObjectId): Promise<void> {
  const rows = await SharedChannelModel.find({ $or: [{ ownerWorkspaceId: workspaceId }, { workspaceId }], status: { $in: ['pending', 'active'] } }).select('chatId').lean();
  if (rows.length === 0) return;
  await SharedChannelModel.updateMany({ _id: { $in: rows.map((row) => row._id) } }, { $set: { status: 'removed', removedBy: actorId } });
  const chatIds = [...new Map(rows.map((row) => [String(row.chatId), row.chatId])).values()];
  await Promise.all(chatIds.map(async (chatId) => {
    await syncSharedFlag(chatId);
    await dropOutsiders(chatId);
  }));
}

/** Members no longer active in any space with access leave the channel (a share ended, or someone left their space). */
export async function dropOutsiders(chatId: Types.ObjectId): Promise<void> {
  const chat = await ChatModel.findById(chatId).select('workspaceId channel members.userId').lean<Chat | null>();
  if (!chat?.workspaceId) return;
  const spaces = await spaceIdsWithAccess(chat);
  const active = await WorkspaceMemberModel.find({ workspaceId: { $in: spaces }, userId: { $in: chat.members.map((member) => member.userId) }, status: 'active' }).select('userId').lean();
  const allowed = new Set(active.map((member) => String(member.userId)));
  // Apps stay: an app is never a space member (`mayJoinSpaceChat`).
  const apps = new Set((await UserModel.find({ _id: { $in: chat.members.map((member) => member.userId) }, 'app.appId': { $exists: true } }).select('_id').lean()).map((user) => String(user._id)));
  const out = chat.members.filter((member) => !allowed.has(String(member.userId)) && !apps.has(String(member.userId))).map((member) => member.userId);
  if (out.length === 0) return;
  await ChatModel.updateOne({ _id: chat._id }, { $pull: { members: { userId: { $in: out } } } });
  for (const userId of out) avisarCambioDeChat(String(userId), String(chat._id));
}

/**
 * The space each person sees a shared channel from (José 11/11), for where a notice lands:
 * the owner space if they are active there, else the shared space they are active in.
 */
export async function viewingSpacesOf(chat: Pick<Chat, '_id' | 'workspaceId' | 'channel'>, userIds: readonly string[]): Promise<Map<string, string>> {
  const spaces = await spaceIdsWithAccess(chat);
  if (spaces.length <= 1 || userIds.length === 0) return new Map();
  const rows = await WorkspaceMemberModel.find({ workspaceId: { $in: spaces }, userId: { $in: userIds.map((id) => new Types.ObjectId(id)) }, status: 'active' }).select('workspaceId userId').lean();
  const owner = String(chat.workspaceId);
  const viewing = new Map<string, string>();
  for (const row of rows) {
    const userId = String(row.userId);
    if (viewing.get(userId) !== owner) viewing.set(userId, String(row.workspaceId));
  }
  return viewing;
}

export type ChannelPerson = { userId: string; name?: string; phone: string; avatarUrl?: string; space: { id: string; name: string }; inChannel: boolean };

/**
 * Who can be added to a channel seen from `viewingId` (José 11/11: «agregar gente de otros espacios»):
 * the active members of every space with access, each with their space. Only for someone in the channel.
 */
export async function channelPeople(viewingId: string, actorId: Types.ObjectId, chatId: string): Promise<ChannelPerson[]> {
  await actorIn(viewingId, actorId);
  if (!Types.ObjectId.isValid(chatId)) throw new WorkspaceError(404, NO_CHANNEL);
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': actorId, 'channel.visibility': { $exists: true } }).select('workspaceId channel members.userId').lean<Chat | null>();
  if (!chat?.workspaceId) throw new WorkspaceError(404, NO_CHANNEL);
  const spaceIds = await spaceIdsWithAccess(chat);
  const [rows, spaces] = await Promise.all([
    WorkspaceMemberModel.find({ workspaceId: { $in: spaceIds }, status: 'active', userId: { $exists: true } }).select('workspaceId userId phone').lean(),
    WorkspaceModel.find({ _id: { $in: spaceIds } }).select('name').lean(),
  ]);
  const names = new Map(spaces.map((space) => [String(space._id), space.name]));
  const users = await UserModel.find({ _id: { $in: rows.flatMap((row) => (row.userId ? [row.userId] : [])) } }).select('name avatarUrl').lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const inChannel = new Set(chat.members.map((member) => String(member.userId)));
  // One row per person: the owner space first, so someone in both counts as the owner's.
  const owner = String(chat.workspaceId);
  const sorted = [...rows].sort((a, b) => Number(String(b.workspaceId) === owner) - Number(String(a.workspaceId) === owner));
  const seen = new Set<string>();
  return sorted.flatMap((row) => {
    const userId = String(row.userId);
    if (seen.has(userId)) return [];
    seen.add(userId);
    const user = userById.get(userId);
    return [{ userId, ...(user?.name ? { name: user.name } : {}), phone: row.phone, ...(user?.avatarUrl ? { avatarUrl: toAbsoluteMediaUrl(user.avatarUrl) } : {}), space: { id: String(row.workspaceId), name: names.get(String(row.workspaceId)) ?? '' }, inChannel: inChannel.has(userId) }];
  });
}

