import { Types } from 'mongoose';
import { botCardSummary, type BotCard, type BotPost } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from '../chatModels.js';
import { chatMemberIds, sendMessage } from '../chatService.js';
import { createChecklistInChat } from '../checklistService.js';
import { publicarMensaje } from '../reparto.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { BotInstallationModel, type BotInstallation } from './botModels.js';

/**
 * What a bot publishes (`specs/BOTS-API.spec.md` §b): to a channel or group of
 * its space, or to a 1:1 with a member (created the first time). Every message
 * goes out by the same path as a person's: stored, sent to the members, push
 * to the ones offline.
 */
export type BotApiError = { status: 400 | 403 | 404; error: string; message: string; phone?: string };
export type PostedMessage = { id: string; chat_id: string; seq: number };
type Installation = Pick<BotInstallation, '_id' | 'workspaceId' | 'botUserId' | 'recentKeys'>;

const RECENT_KEYS_KEPT = 500;
const fail = (status: BotApiError['status'], error: string, message: string): BotApiError => ({ status, error, message });
const posted = (message: Pick<Message, '_id' | 'chatId' | 'seq'>): PostedMessage => ({ id: String(message._id), chat_id: String(message.chatId), seq: message.seq });

async function activeMemberId(workspaceId: Types.ObjectId, by: { phone: string } | { userId: string }): Promise<Types.ObjectId | null> {
  if ('userId' in by && !Types.ObjectId.isValid(by.userId)) return null;
  const filter = 'phone' in by ? { phone: by.phone } : { userId: new Types.ObjectId(by.userId) };
  const member = await WorkspaceMemberModel.findOne({ workspaceId, status: 'active', ...filter }).select('userId').lean();
  return member?.userId ?? null;
}

async function directWith(installation: Installation, userId: Types.ObjectId): Promise<Types.ObjectId> {
  const members = [installation.botUserId, userId];
  const existing = await ChatModel.findOne({ kind: 'direct', workspaceId: installation.workspaceId, 'members.userId': { $all: members }, members: { $size: 2 } }).select('_id').lean();
  if (existing) return existing._id;
  const chat = await ChatModel.create({ kind: 'direct', workspaceId: installation.workspaceId, members: members.map((id) => ({ userId: id, role: 'member' })), lastSeq: 0 });
  return chat._id;
}

/** A public channel lets the bot in on its first message; a private one or a group, only if it was added. */
async function chatOfChannel(installation: Installation, channelId: string): Promise<Types.ObjectId | BotApiError> {
  if (!Types.ObjectId.isValid(channelId)) return fail(404, 'channel_not_found', 'Ese canal no existe en el espacio.');
  const chat = await ChatModel.findOne({ _id: channelId, workspaceId: installation.workspaceId, kind: 'group' }).select('_id channel members.userId').lean<Chat | null>();
  if (!chat) return fail(404, 'channel_not_found', 'Ese canal no existe en el espacio.');
  if (chat.members.some((member) => String(member.userId) === String(installation.botUserId))) return chat._id;
  if (chat.channel?.visibility !== 'public') return fail(403, 'not_in_channel', 'El bot no está en ese canal privado o grupo: alguien tiene que agregarlo.');
  await ChatModel.updateOne({ _id: chat._id, 'members.userId': { $ne: installation.botUserId } }, { $push: { members: { userId: installation.botUserId, role: 'member', joinedAt: new Date() } } });
  return chat._id;
}

async function resolveChat(installation: Installation, target: BotPost['target']): Promise<Types.ObjectId | BotApiError> {
  if ('channelId' in target) return chatOfChannel(installation, target.channelId);
  const userId = await activeMemberId(installation.workspaceId, 'userPhone' in target ? { phone: target.userPhone } : { userId: target.userId });
  if (!userId) return fail(404, 'user_not_found', 'Esa persona no es miembro activo del espacio.');
  return directWith(installation, userId);
}

async function assigneesOf(installation: Installation, checklist: NonNullable<BotPost['checklist']>): Promise<Map<string, Types.ObjectId> | BotApiError> {
  const byPhone = new Map<string, Types.ObjectId>();
  for (const phone of new Set(checklist.items.flatMap((item) => item.assigneePhone ?? []))) {
    const userId = await activeMemberId(installation.workspaceId, { phone });
    if (!userId) return { ...fail(400, 'assignee_not_member', `El responsable 51${phone} no es miembro activo del espacio.`), phone: `51${phone}` };
    byPhone.set(phone, userId);
  }
  return byPhone;
}

async function publishText(installation: Installation, chatId: Types.ObjectId, post: BotPost): Promise<Message> {
  const result = await sendMessage({
    chatId: String(chatId),
    senderId: installation.botUserId,
    clientKey: `bot:${installation._id}:${post.idempotencyKey}`,
    kind: 'text',
    body: post.text ?? botCardSummary(post.card!),
    ...(post.card ? { card: post.card } : {}),
    ...(post.threadOf ? { hiloDe: post.threadOf } : {}),
  });
  if (!result.duplicate) await publicarMensaje(result.message, result.members);
  return result.message;
}

async function publishChecklist(installation: Installation, chatId: Types.ObjectId, post: BotPost, assignees: Map<string, Types.ObjectId>): Promise<Message | null> {
  const checklist = post.checklist!;
  const created = await createChecklistInChat({
    chatId: String(chatId),
    createdBy: installation.botUserId,
    title: checklist.title,
    items: checklist.items.map((item) => ({ text: item.text, assignee: item.assigneePhone ? assignees.get(item.assigneePhone)! : null, dueAt: item.dueAt ? new Date(item.dueAt) : null })),
    othersCanMark: checklist.othersCanMark,
    othersCanAdd: false,
    ...(post.threadOf ? { hiloDe: post.threadOf } : {}),
    pin: false,
  });
  return created.cardSeq ? MessageModel.findOne({ chatId, seq: created.cardSeq }).lean<Message | null>() : null;
}

export async function postBotMessage(installation: Installation, post: BotPost): Promise<{ status: 200 | 201; message: PostedMessage } | BotApiError> {
  const known = installation.recentKeys.find((entry) => entry.key === post.idempotencyKey);
  if (known) return { status: 200, message: { id: known.messageId, chat_id: known.chatId, seq: known.seq } };
  const chatId = await resolveChat(installation, post.target);
  if (!(chatId instanceof Types.ObjectId)) return chatId;
  const assignees = post.checklist ? await assigneesOf(installation, post.checklist) : new Map<string, Types.ObjectId>();
  if (!(assignees instanceof Map)) return assignees;
  let last: Message | null = null;
  if (post.text || post.card) last = await publishText(installation, chatId, post);
  if (post.checklist) last = (await publishChecklist(installation, chatId, post, assignees)) ?? last;
  if (!last) return fail(400, 'invalid_request', 'No se pudo publicar.');
  const entry = { key: post.idempotencyKey, messageId: String(last._id), chatId: String(last.chatId), seq: last.seq };
  await BotInstallationModel.updateOne({ _id: installation._id }, { $push: { recentKeys: { $each: [entry], $slice: -RECENT_KEYS_KEPT } } });
  return { status: 201, message: posted(last) };
}

/** A bot replaces the text or the card of ITS message: the card closed after the click. No push; the members see it change. */
export async function updateBotMessage(installation: Installation, messageId: string, change: { text?: string; card?: BotCard }, notify: (members: string[], edited: Record<string, unknown>) => void): Promise<{ message: PostedMessage } | BotApiError> {
  if (!Types.ObjectId.isValid(messageId)) return fail(404, 'message_not_found', 'Ese mensaje no existe.');
  const message = await MessageModel.findOne({ _id: messageId, senderId: installation.botUserId, deletedAt: { $exists: false } }).select('_id chatId seq body card').lean<Message | null>();
  if (!message) return fail(404, 'message_not_found', 'Ese mensaje no existe o no es de este bot.');
  const card = change.card ?? message.card;
  const body = change.text ?? (change.card ? botCardSummary(change.card) : message.body);
  const editedAt = change.text !== undefined ? new Date() : undefined;
  await MessageModel.updateOne({ _id: message._id }, { $set: { body, ...(card ? { card } : {}), ...(editedAt ? { editedAt } : {}) } });
  notify(await chatMemberIds(message.chatId), { chatId: String(message.chatId), seq: message.seq, body, ...(card ? { card } : {}), ...(editedAt ? { editedAt } : {}) });
  return { message: posted(message) };
}
