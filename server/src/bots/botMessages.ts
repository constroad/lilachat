import { Types } from 'mongoose';
import { botCardSummary, botFilesSummary, type BotCard, type BotClientRef, type BotPost, type GalleryItem } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from '../chatModels.js';
import { chatMemberIds, sendMessage } from '../chatService.js';
import { createChecklistInChat } from '../checklistService.js';
import { HiloInvalidoError } from '../hilos.js';
import { notifyThread, publicarMensaje } from '../reparto.js';
import { WorkspaceMemberModel } from '../workspaceModels.js';
import { BotInstallationModel, type BotInstallation } from './botModels.js';
import { channelOfPostedTopic } from './botTopics.js';
import { chatOfClient } from './botClients.js';

/**
 * What a bot publishes (`specs/BOTS-API.spec.md` §b): to a channel or group of
 * its space, or to a 1:1 with a member (created the first time). Every message
 * goes out by the same path as a person's: stored, sent to the members, push
 * to the ones offline.
 */
export type BotApiError = { status: 400 | 403 | 404 | 409; error: string; message: string; phone?: string };
export type PostedMessage = { id: string; chat_id: string; seq: number };
type Installation = Pick<BotInstallation, '_id' | 'appId' | 'workspaceId' | 'botUserId' | 'recentKeys'>;

const RECENT_KEYS_KEPT = 500;
const fail = (status: BotApiError['status'], error: string, message: string): BotApiError => ({ status, error, message });
const posted = (message: Pick<Message, '_id' | 'chatId' | 'seq'>): PostedMessage => ({ id: String(message._id), chat_id: String(message.chatId), seq: message.seq });

async function activeMemberId(workspaceId: Types.ObjectId, by: { phone: string } | { userId: string }): Promise<Types.ObjectId | null> {
  if ('userId' in by && !Types.ObjectId.isValid(by.userId)) return null;
  const filter = 'phone' in by ? { phone: by.phone } : { userId: new Types.ObjectId(by.userId) };
  const member = await WorkspaceMemberModel.findOne({ workspaceId, status: 'active', ...filter }).select('userId').lean();
  return member?.userId ?? null;
}

/** The 1:1 of a member with the app's bot, created the first time (by the bot posting, or the person opening it from «Apps»). */
export async function directWith(installation: Pick<BotInstallation, 'workspaceId' | 'botUserId'>, userId: Types.ObjectId): Promise<Types.ObjectId> {
  const members = [installation.botUserId, userId];
  const existing = await ChatModel.findOne({ kind: 'direct', workspaceId: installation.workspaceId, 'members.userId': { $all: members }, members: { $size: 2 } }).select('_id').lean();
  if (existing) return existing._id;
  const chat = await ChatModel.create({ kind: 'direct', workspaceId: installation.workspaceId, members: members.map((id) => ({ userId: id, role: 'member' })), lastSeq: 0 });
  return chat._id;
}

/** A public channel lets the bot in on its first message; a private one or a group, only if it was added. */
async function chatOfChannel(installation: Installation, channelId: string): Promise<Types.ObjectId | BotApiError> {
  if (!Types.ObjectId.isValid(channelId)) return fail(404, 'channel_not_found', 'Ese canal no existe en el espacio.');
  const chat = await ChatModel.findOne({ _id: channelId, workspaceId: installation.workspaceId, kind: 'group' }).select('_id channel members.userId appsRemoved').lean<Chat | null>();
  if (!chat) return fail(404, 'channel_not_found', 'Ese canal no existe en el espacio.');
  if (chat.members.some((member) => String(member.userId) === String(installation.botUserId))) return chat._id;
  if (chat.appsRemoved?.some((id) => String(id) === String(installation.botUserId))) return fail(403, 'not_in_channel', 'Un admin sacó la app de este canal: vuelve solo si un admin la agrega.');
  if (chat.channel?.visibility !== 'public') return fail(403, 'not_in_channel', 'El bot no está en ese canal privado o grupo: alguien tiene que agregarlo.');
  await ChatModel.updateOne({ _id: chat._id, 'members.userId': { $ne: installation.botUserId } }, { $push: { members: { userId: installation.botUserId, role: 'member', joinedAt: new Date() } } });
  return chat._id;
}

async function resolveChat(installation: Installation, target: BotPost['target']): Promise<Types.ObjectId | BotApiError> {
  if ('channelId' in target) return chatOfChannel(installation, target.channelId);
  if ('client' in target) return chatOfClient(installation, target.client);
  if ('topic' in target) {
    const channelId = await channelOfPostedTopic(installation, target.topic);
    return typeof channelId === 'string' ? chatOfChannel(installation, channelId) : channelId;
  }
  const userId = await activeMemberId(installation.workspaceId, 'userPhone' in target ? { phone: target.userPhone } : { userId: target.userId });
  if (!userId) return fail(404, 'user_not_found', 'Esa persona no es miembro activo del espacio.');
  return directWith(installation, userId);
}

export async function assigneesOf(installation: Pick<Installation, 'workspaceId'>, checklist: Pick<NonNullable<BotPost['checklist']>, 'items'>): Promise<Map<string, Types.ObjectId> | BotApiError> {
  const byPhone = new Map<string, Types.ObjectId>();
  for (const phone of new Set(checklist.items.flatMap((item) => item.assigneePhone ?? []))) {
    const userId = await activeMemberId(installation.workspaceId, { phone });
    if (!userId) return { ...fail(400, 'assignee_not_member', `El responsable 51${phone} no es miembro activo del espacio.`), phone: `51${phone}` };
    byPhone.set(phone, userId);
  }
  return byPhone;
}

async function publishText(installation: Installation, chatId: Types.ObjectId, post: BotPost, sharedBy?: Message['sharedBy']): Promise<Message> {
  const result = await sendMessage({
    chatId: String(chatId),
    senderId: installation.botUserId,
    skipMemberPermissions: true,
    clientKey: `bot:${installation._id}:${post.idempotencyKey}`,
    kind: 'text',
    body: post.text ?? (post.card ? botCardSummary(post.card) : botFilesSummary(post.files ?? [])),
    ...(post.card ? { card: post.card } : {}),
    ...(post.files ? { files: post.files } : {}),
    ...(sharedBy ? { sharedBy } : {}),
    ...(post.threadOf ? { hiloDe: post.threadOf } : {}),
  });
  if (post.clientRef && !result.duplicate) await MessageModel.updateOne({ _id: result.message._id }, { $set: { clientRef: post.clientRef } });
  if (result.duplicate) return result.message;
  // The live message carries its ref too: a visit card (lv01) is drawn by it from the first delivery.
  const message = post.clientRef ? { ...result.message, clientRef: post.clientRef } : result.message;
  const members = await publicarMensaje(message, result.members);
  if (result.hilo && post.threadOf) notifyThread(String(chatId), post.threadOf, result.hilo, members);
  return message;
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

/** A `thread_of` that is not a message of that chat (agentes 07/11: each unit under its order's card) is the caller's mistake. */
async function publishAll(installation: Installation, chatId: Types.ObjectId, post: BotPost, assignees: Map<string, Types.ObjectId>, sharedBy?: Message['sharedBy']): Promise<Message | BotApiError | null> {
  try {
    let last: Message | null = null;
    if (post.text || post.card || post.files) last = await publishText(installation, chatId, post, sharedBy);
    if (post.checklist) last = (await publishChecklist(installation, chatId, post, assignees)) ?? last;
    return last;
  } catch (error) {
    if (error instanceof HiloInvalidoError) return fail(400, 'invalid_thread', 'thread_of no es un mensaje de ese canal que admita respuestas.');
    throw error;
  }
}

/** `sharedBy` is Lilachat's own: an answer to a command sent to the channel by who asked; never from the public API. */
export async function postBotMessage(installation: Installation, post: BotPost, sharedBy?: Message['sharedBy']): Promise<{ status: 200 | 201; message: PostedMessage } | BotApiError> {
  const known = installation.recentKeys.find((entry) => entry.key === post.idempotencyKey);
  if (known) return { status: 200, message: { id: known.messageId, chat_id: known.chatId, seq: known.seq } };
  const chatId = await resolveChat(installation, post.target);
  if (!(chatId instanceof Types.ObjectId)) return chatId;
  const assignees = post.checklist ? await assigneesOf(installation, post.checklist) : new Map<string, Types.ObjectId>();
  if (!(assignees instanceof Map)) return assignees;
  const last = await publishAll(installation, chatId, post, assignees, sharedBy);
  if (!(last && 'seq' in last)) return last ?? fail(400, 'invalid_request', 'No se pudo publicar.');
  const entry = { key: post.idempotencyKey, messageId: String(last._id), chatId: String(last.chatId), seq: last.seq };
  await BotInstallationModel.updateOne({ _id: installation._id }, { $push: { recentKeys: { $each: [entry], $slice: -RECENT_KEYS_KEPT } } });
  return { status: 201, message: posted(last) };
}

/** A bot replaces the text or the card of ITS message: the card closed after the click. No push; the members see it change. */
export async function updateBotMessage(installation: Installation, messageId: string, change: { text?: string; card?: BotCard; files?: GalleryItem[]; clientRef?: BotClientRef }, notify: (members: string[], edited: Record<string, unknown>) => void): Promise<{ message: PostedMessage } | BotApiError> {
  if (!Types.ObjectId.isValid(messageId)) return fail(404, 'message_not_found', 'Ese mensaje no existe.');
  const message = await MessageModel.findOne({ _id: messageId, senderId: installation.botUserId, deletedAt: { $exists: false } }).select('_id chatId seq body card files').lean<Message | null>();
  if (!message) return fail(404, 'message_not_found', 'Ese mensaje no existe o no es de este bot.');
  const fields = { ...editedFields(message, change), ...(change.clientRef ? { clientRef: change.clientRef } : {}) };
  await MessageModel.updateOne({ _id: message._id }, { $set: fields });
  notify(await chatMemberIds(message.chatId), { chatId: String(message.chatId), seq: message.seq, ...fields });
  return { message: posted(message) };
}

/** A visit card of this bot (lv01): its edit may carry the five buttons, like its POST. */
export async function isVisitMessage(installation: Installation, messageId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(messageId)) return false;
  return Boolean(await MessageModel.exists({ _id: messageId, senderId: installation.botUserId, 'clientRef.visitId': { $exists: true } }));
}

/** What a bot's edit leaves on its message: the new text, card or album, and «Editado» only for a new text. */
function editedFields(message: Pick<Message, 'body' | 'card' | 'files'>, change: { text?: string; card?: BotCard; files?: GalleryItem[] }) {
  const card = change.card ?? message.card;
  const files = change.files ?? message.files;
  const body = change.text ?? editedSummary(message, change);
  const editedAt = change.text !== undefined ? new Date() : undefined;
  return { body, ...(card ? { card } : {}), ...(files ? { files } : {}), ...(editedAt ? { editedAt } : {}) };
}

/** The list preview after an edit without text: the card's, then the album's, else the old one. */
function editedSummary(message: Pick<Message, 'body' | 'card'>, change: { card?: BotCard; files?: GalleryItem[] }): string | undefined {
  if (change.card) return botCardSummary(change.card);
  if (change.files && !message.card) return botFilesSummary(change.files);
  return message.body;
}
