import type { Types } from 'mongoose';
import { toInternationalPhone } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from '../chatModels.js';
import { UserModel } from '../models.js';
import { sendBotEvent } from './botEvents.js';
import { signedMessageFileUrl } from './botFiles.js';
import { botOfUser, botsAmong, type BotOfUser } from './botRegistry.js';

/**
 * What people do that a bot hears (`specs/BOTS-API.spec.md` §c): a message in
 * its 1:1, one that names it in a channel or group, or any message there with
 * `channels:history` (pending 87); later edits and deletions of what it heard;
 * the files sent to it (pending 90); a tap on an action of its
 * card, a task of its checklist. Every person goes with their phone: agentes
 * maps it to the Portal user. Never awaited by who acted: a slow or failing
 * webhook does not hold a message.
 */
export type Person = { id: string; name: string | null; phone: string | null; /** Only with the `users:read.email` scope accepted: the verified email, or null. */ email?: string | null };

export async function personOf(userId: Types.ObjectId | string, scopes?: readonly string[]): Promise<Person> {
  const withEmail = scopes?.includes('users:read.email') === true;
  const user = await UserModel.findById(userId).select(withEmail ? 'name phone email emailVerifiedAt' : 'name phone').lean();
  const base = { id: String(userId), name: user?.name ?? null, phone: user ? toInternationalPhone(user.phone) || null : null };
  // An unverified email does not count (pending 95): the app links accounts by it.
  return withEmail ? { ...base, email: user?.email && user.emailVerifiedAt ? user.email : null } : base;
}

export const channelOf = (chat: Pick<Chat, '_id' | 'kind' | 'name' | 'channel'>) => ({ id: String(chat._id), kind: chat.channel ? 'channel' : chat.kind, ...(chat.name ? { name: chat.name } : {}) });

/** Picked from the suggestions (`menciones`) or typed as text: «@Lila» names the bot either way. */
function mentionsBot(message: Pick<Message, 'body' | 'menciones'>, bot: BotOfUser, botName: string): boolean {
  if (message.menciones?.some((mention) => mention.userId === String(bot.botUserId))) return true;
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Boolean(message.body && new RegExp(`(^|\\s)@${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(message.body));
}

const HISTORY_SCOPE = 'channels:history';
/** The kinds whose file goes to the app: a photo, a document, a voice note. Stickers and videos do not (nobody reads them, and a video is heavy). */
const FILE_KINDS: ReadonlySet<Message['kind']> = new Set(['image', 'file', 'audio']);

/** Its 1:1 always; a channel or group by mention, or entirely with `channels:history` (like Slack). */
export function botHears(params: { chatKind: Chat['kind']; named: boolean; scopes: readonly string[] }): boolean {
  return params.chatKind === 'direct' || params.named || params.scopes.includes(HISTORY_SCOPE);
}

/** The message's file as the app reads it: a signed address of 15 minutes (pending 90). */
export function filesOf(message: Pick<Message, '_id' | 'kind' | 'media'>, now = Date.now()): { url: string; mime: string; name: string; size?: number }[] {
  const media = message.media;
  if (!media?.url || !FILE_KINDS.has(message.kind)) return [];
  return [{ url: signedMessageFileUrl(message._id, now), mime: media.mime ?? 'application/octet-stream', name: media.fileName ?? media.mediaId, ...(media.sizeBytes ? { size: media.sizeBytes } : {}) }];
}

type Hearing = { chat: Chat; bots: { bot: BotOfUser; name: string }[] };

/** The chat and its bots (not the author) with their names, in two reads: null when no bot is there. */
async function hearingOf(message: Pick<Message, 'chatId' | 'senderId' | 'envelope'>, memberIds: readonly string[]): Promise<Hearing | null> {
  if (message.envelope) return null;
  const bots = (await botsAmong(memberIds)).filter((bot) => String(bot.botUserId) !== String(message.senderId));
  if (bots.length === 0) return null;
  const [chat, users] = await Promise.all([
    ChatModel.findById(message.chatId).select('_id kind name channel').lean<Chat | null>(),
    UserModel.find({ _id: { $in: bots.map((bot) => bot.botUserId) } }).select('name').lean(),
  ]);
  if (!chat) return null;
  const names = new Map(users.map((user) => [String(user._id), user.name ?? '']));
  return { chat, bots: bots.map((bot) => ({ bot, name: names.get(String(bot.botUserId)) ?? '' })) };
}

const heardBy = (hearing: Hearing, bot: BotOfUser, named: boolean) => botHears({ chatKind: hearing.chat.kind, named, scopes: bot.scopes });
const messageData = (message: Message) => ({ id: String(message._id), seq: message.seq, text: message.body ?? '', ...(message.hiloDe ? { thread_of: message.hiloDe } : {}) });
const installationOf = (bot: BotOfUser) => ({ _id: bot.installationId, workspaceId: bot.workspaceId });

/** A message just sent: the bots among the members that hear it (`botHears`), with its file if it has one. */
export async function botsHearMessage(message: Message, memberIds: readonly string[]): Promise<boolean> {
  const files = filesOf(message);
  if (!message.body && files.length === 0) return false;
  const hearing = await hearingOf(message, memberIds);
  if (!hearing) return false;
  let heard = false;
  for (const { bot, name } of hearing.bots) {
    const named = mentionsBot(message, bot, name);
    if (!heardBy(hearing, bot, named)) continue;
    heard = true;
    const data = { channel: channelOf(hearing.chat), message: { ...messageData(message), mentions_bot: named, ...(files.length ? { files } : {}) }, author: await personOf(message.senderId) };
    await sendBotEvent(installationOf(bot), 'message.created', data);
  }
  return heard;
}

/**
 * A message edited (pending 87b: «mejor a las 05:00»): to the bots that hear
 * the new text, with the text before only for those that heard it too.
 */
export async function botsHearEdit(message: Message, previous: Message, memberIds: readonly string[]): Promise<void> {
  const hearing = await hearingOf(message, memberIds);
  if (!hearing) return;
  for (const { bot, name } of hearing.bots) {
    const named = mentionsBot(message, bot, name);
    const heardBefore = heardBy(hearing, bot, mentionsBot(previous, bot, name));
    if (!heardBy(hearing, bot, named) && !heardBefore) continue;
    const data = { channel: channelOf(hearing.chat), message: { ...messageData(message), mentions_bot: named, ...(heardBefore ? { previous_text: previous.body ?? '' } : {}) }, author: await personOf(message.senderId) };
    await sendBotEvent(installationOf(bot), 'message.edited', data);
  }
}

/** A message deleted for everyone: to the bots that heard it, without its content (it is gone). */
export async function botsHearDelete(previous: Message, memberIds: readonly string[], deletedBy: Types.ObjectId): Promise<void> {
  const hearing = await hearingOf(previous, memberIds);
  if (!hearing) return;
  for (const { bot, name } of hearing.bots) {
    if (!heardBy(hearing, bot, mentionsBot(previous, bot, name))) continue;
    const data = { channel: channelOf(hearing.chat), message: { id: String(previous._id), seq: previous.seq, ...(previous.hiloDe ? { thread_of: previous.hiloDe } : {}) }, by: await personOf(deletedBy) };
    await sendBotEvent(installationOf(bot), 'message.deleted', data);
  }
}

/** Someone tapped an action of a bot's card. */
export async function botHearsAction(params: { message: Pick<Message, '_id' | 'chatId' | 'seq' | 'senderId'>; action: { id: string; value: string }; userId: Types.ObjectId }): Promise<boolean> {
  const bot = await botOfUser(String(params.message.senderId));
  if (!bot) return false;
  const data = { message: { id: String(params.message._id), seq: params.message.seq }, channel: { id: String(params.message.chatId) }, action: params.action, user: await personOf(params.userId) };
  await sendBotEvent({ _id: bot.installationId, workspaceId: bot.workspaceId }, 'button.click', data);
  return true;
}

/** A task of a checklist the bot created was marked or unmarked. */
export async function botHearsChecklist(params: { checklist: { _id: Types.ObjectId; title: string; createdBy: Types.ObjectId; chatId: Types.ObjectId; cardSeq?: number }; item: { id: string; text: string; done: boolean; assignee?: Types.ObjectId | null }; userId: Types.ObjectId }): Promise<void> {
  const bot = await botOfUser(String(params.checklist.createdBy));
  if (!bot) return;
  const assignee = params.item.assignee ? await personOf(params.item.assignee) : null;
  const card = params.checklist.cardSeq ? await MessageModel.findOne({ chatId: params.checklist.chatId, seq: params.checklist.cardSeq }).select('_id').lean() : null;
  const data = {
    checklist: { id: String(params.checklist._id), title: params.checklist.title, message_id: card ? String(card._id) : null },
    item: { id: params.item.id, text: params.item.text, done: params.item.done, ...(assignee?.phone ? { assignee_phone: assignee.phone } : {}) },
    user: await personOf(params.userId),
  };
  await sendBotEvent({ _id: bot.installationId, workspaceId: bot.workspaceId }, 'checklist.item.toggled', data);
}
