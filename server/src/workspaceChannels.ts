import { Types } from 'mongoose';
import { addBotsToPublicChannel } from './bots/botInstall.js';
import { canManageMembers, normalizeChannelName, normalizarDescripcion, type ChannelVisibility } from '@lilachat/shared';
import { ChatModel, type Chat } from './chatModels.js';
import { ClientChannelModel } from './bots/botClients.js';
import { avisarCambioDeChat } from './reparto.js';
import { actorIn, WorkspaceError } from './workspaces.js';
import { WorkspaceModel } from './workspaceModels.js';
import { ensureGeneralChannel } from './workspaceGeneral.js';
import { noticeChannelJoined } from './workspaceNotices.js';

/**
 * Channels of a company space (E2, spec §47): a group with `channel` set.
 * Being a group, mentions, admins and notification levels already work;
 * public channels are listed for the whole space and joined without an
 * invitation.
 */
const asVisibility = (value: unknown): ChannelVisibility => (value === 'private' ? 'private' : 'public');

export function toClientChannel(chat: Pick<Chat, '_id' | 'name' | 'descripcion' | 'channel' | 'members'>, userId: Types.ObjectId) {
  return {
    id: String(chat._id),
    name: chat.name ?? '',
    descripcion: chat.descripcion,
    visibility: chat.channel?.visibility ?? 'public',
    members: chat.members.length,
    joined: chat.members.some((member) => String(member.userId) === String(userId)),
  };
}

export async function createChannel(workspaceId: string, userId: Types.ObjectId, input: { name?: unknown; descripcion?: unknown; visibility?: unknown }) {
  const actor = await actorIn(workspaceId, userId);
  const name = typeof input.name === 'string' ? normalizeChannelName(input.name) : null;
  if (!name) throw new WorkspaceError(400, 'Ponle un nombre al canal (letras y números).');
  if (await ChatModel.exists({ workspaceId: actor.workspaceId, 'channel.visibility': { $exists: true }, name })) throw new WorkspaceError(409, `Ya hay un canal #${name} en el espacio.`);
  const cleaned = typeof input.descripcion === 'string' && input.descripcion.trim() ? normalizarDescripcion(input.descripcion) : null;
  if (cleaned && !cleaned.ok) throw new WorkspaceError(400, cleaned.motivo);
  const descripcion = cleaned?.ok ? cleaned.descripcion : undefined;
  const chat = await ChatModel.create({
    kind: 'group',
    name,
    workspaceId: actor.workspaceId,
    channel: { visibility: asVisibility(input.visibility) },
    ...(descripcion ? { descripcion } : {}),
    members: [{ userId, role: 'admin' }],
    lastSeq: 0,
  });
  if (chat.channel?.visibility === 'public') await addBotsToPublicChannel(actor.workspaceId, chat._id);
  noticeChannelJoined(userId, chat._id);
  return toClientChannel(chat.toObject(), userId);
}

/** Public channels of the space plus the private ones I am in. */
export async function listChannels(workspaceId: string, userId: Types.ObjectId) {
  const actor = await actorIn(workspaceId, userId);
  // A space from before #general (22/10) gets it here, with everyone already active.
  await ensureGeneralChannel(actor.workspaceId);
  const chats = await ChatModel.find({
    workspaceId: actor.workspaceId,
    'channel.visibility': { $exists: true },
    $or: [{ 'channel.visibility': 'public' }, { 'members.userId': userId }],
  })
    .select('name descripcion channel members.userId')
    .sort({ name: 1 })
    .lean<Chat[]>();
  return chats.map((chat) => toClientChannel(chat, userId));
}

export async function joinChannel(workspaceId: string, userId: Types.ObjectId, chatId: string) {
  const actor = await actorIn(workspaceId, userId);
  if (!Types.ObjectId.isValid(chatId)) throw new WorkspaceError(404, 'Ese canal no existe.');
  const chat = await ChatModel.findOneAndUpdate(
    { _id: chatId, workspaceId: actor.workspaceId, 'channel.visibility': 'public', 'members.userId': { $ne: userId } },
    { $push: { members: { userId, role: 'member' } } },
    { returnDocument: 'after' }
  ).lean<Chat | null>();
  if (chat) {
    noticeChannelJoined(userId, chat._id);
    return toClientChannel(chat, userId);
  }
  const already = await ChatModel.findOne({ _id: chatId, workspaceId: actor.workspaceId, 'channel.visibility': { $exists: true }, 'members.userId': userId }).lean<Chat | null>();
  if (already) return toClientChannel(already, userId);
  throw new WorkspaceError(404, 'Ese canal no existe o es privado.');
}

/**
 * Deletes a channel (José 30/10: there was no way). Only the space's admins.
 * It stops being a channel and has no members, so it leaves every list and
 * frees its name; its messages and who was in it stay, so it can come back.
 * #general belongs to the whole space and a client channel is Portal's.
 */
export async function deleteChannel(workspaceId: string, userId: Types.ObjectId, chatId: string): Promise<void> {
  const actor = await actorIn(workspaceId, userId);
  if (!canManageMembers(actor.role)) throw new WorkspaceError(403, 'Solo un admin del espacio puede eliminar canales.');
  if (!Types.ObjectId.isValid(chatId)) throw new WorkspaceError(404, 'Ese canal no existe.');
  const chat = await ChatModel.findOne({ _id: chatId, workspaceId: actor.workspaceId, 'channel.visibility': { $exists: true } }).select('name channel members').lean<Chat | null>();
  if (!chat) throw new WorkspaceError(404, 'Ese canal no existe.');
  const space = await WorkspaceModel.findById(actor.workspaceId).select('generalChatId').lean();
  if (space?.generalChatId?.equals(chat._id)) throw new WorkspaceError(400, '#general es el canal de todo el espacio: no se elimina.');
  if (await ClientChannelModel.exists({ chatId: chat._id })) throw new WorkspaceError(400, 'Los canales de cliente vienen de Portal: no se eliminan desde aquí.');
  const members = chat.members.map((member) => ({ userId: member.userId, role: member.role }));
  await ChatModel.updateOne(
    { _id: chat._id },
    { $set: { members: [], deletedChannel: { name: chat.name ?? '', visibility: chat.channel?.visibility ?? 'public', deletedAt: new Date(), deletedBy: userId, members } }, $unset: { channel: '' } }
  );
  for (const member of members) avisarCambioDeChat(String(member.userId), String(chat._id));
}
