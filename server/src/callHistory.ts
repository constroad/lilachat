import type { Types } from 'mongoose';
import type { CallHistoryEntry } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { UserModel } from './models.js';

/**
 * The call history (pending 38) is not stored apart: it is each chat's call
 * lines (`system.evento: 'llamada'`). One query over my chats with the
 * `{chatId, kind, at}` index, bounded by a window and a limit so that a person
 * with many chats does not read years of lines. Secret chats write no lines.
 */
const HISTORY_LIMIT = 60;
const HISTORY_WINDOW_MS = 90 * 86_400_000;

type CallLine = { chatId: Types.ObjectId; seq: number; at: Date; senderId: Types.ObjectId; system?: { valor?: string } };
type ChatTitleSource = { _id: Types.ObjectId; kind: string; name?: string; members: { userId: Types.ObjectId }[] };
type ChatTitle = { title: string | null; phone: string | null };

/** The group's name, or the other person's name and phone in a direct chat: one read for every person involved. */
async function titlesOf(chats: ChatTitleSource[], userId: Types.ObjectId): Promise<Map<string, ChatTitle>> {
  const otherOf = (chat: ChatTitleSource) => (chat.kind === 'direct' ? chat.members.find((member) => String(member.userId) !== String(userId))?.userId : undefined);
  const others = chats.map(otherOf).filter((id): id is Types.ObjectId => Boolean(id));
  const people = others.length ? await UserModel.find({ _id: { $in: others } }).select('name phone').lean<{ _id: Types.ObjectId; name?: string; phone: string }[]>() : [];
  return new Map(
    chats.map((chat) => {
      const person = people.find((one) => String(one._id) === String(otherOf(chat)));
      return [String(chat._id), person ? { title: person.name ?? null, phone: person.phone } : { title: chat.name ?? null, phone: null }];
    })
  );
}

export async function callHistoryOf(userId: Types.ObjectId): Promise<CallHistoryEntry[]> {
  const chats = await ChatModel.find({ 'members.userId': userId }).select('_id kind name members.userId').lean<ChatTitleSource[]>();
  if (chats.length === 0) return [];
  const lines = await MessageModel.find({
    chatId: { $in: chats.map((chat) => chat._id) },
    kind: 'system',
    at: { $gte: new Date(Date.now() - HISTORY_WINDOW_MS) },
    'system.evento': 'llamada',
    deletedAt: { $exists: false },
  })
    .sort({ at: -1 })
    .limit(HISTORY_LIMIT)
    .select('chatId seq at senderId system.valor')
    .lean<CallLine[]>();
  const withCalls = new Set(lines.map((line) => String(line.chatId)));
  const titles = await titlesOf(chats.filter((chat) => withCalls.has(String(chat._id))), userId);
  return lines.map((line) => ({
    chatId: String(line.chatId),
    seq: line.seq,
    at: line.at.toISOString(),
    valor: line.system?.valor ?? '',
    mine: String(line.senderId) === String(userId),
    ...(titles.get(String(line.chatId)) ?? { title: null, phone: null }),
  }));
}
