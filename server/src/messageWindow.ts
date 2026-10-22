import type { Types } from 'mongoose';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { clampPageLimit, listMessages, memberChatFloor } from './chatService.js';
import { toClientMessages } from './messageView.js';

/**
 * Pages of a conversation (pending 44, José 22/10: an old message only said
 * to scroll up and load it). Besides `beforeSeq` (scrolling up from the
 * end), a window `around` an old message and the pages `afterSeq` (scrolling
 * down from it), like WhatsApp Web. Each side asks for one more than it shows:
 * that one says whether there is more, with no count.
 */
export type PageQuery = { kind: 'before'; beforeSeq?: number } | { kind: 'around'; seq: number } | { kind: 'after'; seq: number } | { kind: 'invalid' };
export const ONE_PAGE_PARAM_ONLY = 'Usa solo uno: beforeSeq, afterSeq o around.';

const positive = (raw: unknown): number | undefined => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

export function parsePageQuery(query: Record<string, unknown>): PageQuery {
  const given = ['beforeSeq', 'afterSeq', 'around'].filter((name) => query[name] !== undefined);
  if (given.length > 1) return { kind: 'invalid' };
  const around = positive(query.around);
  if (around) return { kind: 'around', seq: around };
  const after = positive(query.afterSeq);
  if (after) return { kind: 'after', seq: after };
  return { kind: 'before', beforeSeq: positive(query.beforeSeq) };
}

type Window = { messages: Message[]; hasOlder?: boolean; hasNewer?: boolean };

async function around(chatId: string, userId: Types.ObjectId, seq: number, limit: number): Promise<Window> {
  const chat = await memberChatFloor(chatId, userId);
  const newerCount = Math.floor(limit / 2);
  const olderCount = limit - newerCount;
  const [older, newer] = await Promise.all([
    MessageModel.find({ chatId: chat.chatId, seq: { $gt: chat.floor, $lte: seq } }).sort({ seq: -1 }).limit(olderCount + 1).lean<Message[]>(),
    MessageModel.find({ chatId: chat.chatId, seq: { $gt: Math.max(seq, chat.floor) } }).sort({ seq: 1 }).limit(newerCount + 1).lean<Message[]>(),
  ]);
  return { messages: [...older.slice(0, olderCount).reverse(), ...newer.slice(0, newerCount)], hasOlder: older.length > olderCount, hasNewer: newer.length > newerCount };
}

async function after(chatId: string, userId: Types.ObjectId, seq: number, limit: number): Promise<Window> {
  const chat = await memberChatFloor(chatId, userId);
  const newer = await MessageModel.find({ chatId: chat.chatId, seq: { $gt: Math.max(seq, chat.floor) } }).sort({ seq: 1 }).limit(limit + 1).lean<Message[]>();
  return { messages: newer.slice(0, limit), hasNewer: newer.length > limit };
}

/** The answer of `GET /api/chats/:chatId/messages`, or `invalid` for more than one page parameter. */
export async function readMessagePage(chatId: string, userId: Types.ObjectId, query: Record<string, unknown>) {
  const asked = parsePageQuery(query);
  if (asked.kind === 'invalid') return 'invalid' as const;
  const limit = clampPageLimit(positive(query.limit));
  const window: Window =
    asked.kind === 'around'
      ? await around(chatId, userId, asked.seq, limit)
      : asked.kind === 'after'
        ? await after(chatId, userId, asked.seq, limit)
        : { messages: await listMessages({ chatId, userId, limit, beforeSeq: asked.beforeSeq }) };
  // `lastSeq` travels WITH the page: the chat's real top at this instant, so the phone can drop what it kept beyond it.
  const chat = await ChatModel.findById(chatId).select('lastSeq').lean();
  return { messages: toClientMessages(window.messages), lastSeq: chat?.lastSeq ?? 0, ...(window.hasOlder !== undefined ? { hasOlder: window.hasOlder } : {}), ...(window.hasNewer !== undefined ? { hasNewer: window.hasNewer } : {}) };
}
