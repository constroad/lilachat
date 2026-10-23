import type { Types } from 'mongoose';
import { toInternationalPhone } from '@lilachat/shared';
import { ChatModel, MessageModel, type Chat, type Message } from '../chatModels.js';
import { UserModel } from '../models.js';
import { sendBotEvent } from './botEvents.js';
import { botOfUser, botsAmong, type BotOfUser } from './botRegistry.js';

/**
 * What people do that a bot hears (`specs/BOTS-API.spec.md` §c): a message in
 * its 1:1 or one that names it in a channel or group, a tap on an action of its
 * card, a task of its checklist. Every person goes with their phone: agentes
 * maps it to the Portal user. Never awaited by who acted: a slow or failing
 * webhook does not hold a message.
 */
export type Person = { id: string; name: string | null; phone: string | null };

export async function personOf(userId: Types.ObjectId | string): Promise<Person> {
  const user = await UserModel.findById(userId).select('name phone').lean();
  return { id: String(userId), name: user?.name ?? null, phone: user ? toInternationalPhone(user.phone) || null : null };
}

export const channelOf = (chat: Pick<Chat, '_id' | 'kind' | 'name' | 'channel'>) => ({ id: String(chat._id), kind: chat.channel ? 'channel' : chat.kind, ...(chat.name ? { name: chat.name } : {}) });

/** Picked from the suggestions (`menciones`) or typed as text: «@Lila» names the bot either way. */
function mentionsBot(message: Pick<Message, 'body' | 'menciones'>, bot: BotOfUser, botName: string): boolean {
  if (message.menciones?.some((mention) => mention.userId === String(bot.botUserId))) return true;
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Boolean(message.body && new RegExp(`(^|\\s)@${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(message.body));
}

/** A message just sent: the bots among the members hear it if it is their 1:1 or it names them. */
export async function botsHearMessage(message: Message, memberIds: readonly string[]): Promise<boolean> {
  const bots = (await botsAmong(memberIds)).filter((bot) => String(bot.botUserId) !== String(message.senderId));
  if (bots.length === 0 || !message.body || message.envelope) return false;
  const chat = await ChatModel.findById(message.chatId).select('_id kind name channel').lean<Chat | null>();
  if (!chat) return false;
  let heard = false;
  for (const bot of bots) {
    const botUser = await UserModel.findById(bot.botUserId).select('name').lean();
    const named = mentionsBot(message, bot, botUser?.name ?? '');
    if (chat.kind !== 'direct' && !named) continue;
    heard = true;
    const data = { channel: channelOf(chat), message: { id: String(message._id), seq: message.seq, text: message.body, ...(message.hiloDe ? { thread_of: message.hiloDe } : {}), mentions_bot: named }, author: await personOf(message.senderId) };
    await sendBotEvent({ _id: bot.installationId, workspaceId: bot.workspaceId }, 'message.created', data);
  }
  return heard;
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
