import { Router } from 'express';
import { Types, type QueryFilter } from 'mongoose';
import { activityType, MENTION_ALL, MENTION_HERE, reactionsFromOthers, type ActivityItem, type ActivityType, type Reaccion } from '@lilachat/shared';
import { ChatModel, MessageModel, ReceiptModel, type Message } from './chatModels.js';
import { chatVisible, infoDeChats, personasPorId } from './contextoDeChats.js';
import { allActiveIn } from './workspaceChats.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** How many rows a tab brings: the recent activity, not an archive. */
const ACTIVITY_LIMIT = 50;
/** Messages with reactions read to find the ones reacted to last. */
const REACTED_SCAN = 200;
const FIELDS = 'chatId seq senderId body menciones at hilo reacciones';

type Scope = { me: Types.ObjectId; chatIds: Types.ObjectId[]; readSeq: Map<string, number> };

// Each filter repeats its partial index's condition (`chatModels.ts`, 22/10): the planner only uses a partial index when the query implies it.
const mentionsFilter = (scope: Scope): QueryFilter<Message> => ({ chatId: { $in: scope.chatIds }, menciones: { $exists: true }, senderId: { $ne: scope.me }, 'menciones.userId': { $in: [String(scope.me), MENTION_ALL, MENTION_HERE] }, deletedAt: { $exists: false } });
const threadsFilter = (scope: Scope): QueryFilter<Message> => ({ chatId: { $in: scope.chatIds }, 'hilo.respuestas': { $gt: 0 }, deletedAt: { $exists: false }, $or: [{ senderId: scope.me }, { 'hilo.autores': String(scope.me) }] });
const reactionsFilter = (scope: Scope): QueryFilter<Message> => ({ chatId: { $in: scope.chatIds }, senderId: scope.me, $and: [{ reacciones: { $exists: true } }, { reacciones: { $elemMatch: { userId: { $ne: String(scope.me) } } } }], deletedAt: { $exists: false } });

const read = (scope: Scope, message: Pick<Message, 'chatId'>) => scope.readSeq.get(String(message.chatId)) ?? 0;
const mentionUnread = (scope: Scope, message: Message) => message.seq > read(scope, message);
/** A thread is new for me while its last reply is after what I read and was not mine. */
const threadUnread = (scope: Scope, message: Message) => (message.hilo?.ultimaSeq ?? 0) > read(scope, message) && message.hilo?.autores?.at(-1) !== String(scope.me);

async function scopeOf(me: Types.ObjectId, workspaceId: Types.ObjectId | undefined): Promise<Scope> {
  const chats = await ChatModel.find({ 'members.userId': me, encrypted: { $ne: true }, workspaceId: workspaceId ?? { $exists: false } }).select('_id').lean();
  const chatIds = chats.map((chat) => chat._id);
  const receipts = await ReceiptModel.find({ userId: me, chatId: { $in: chatIds } }).select('chatId readSeq').lean();
  return { me, chatIds, readSeq: new Map(receipts.map((receipt) => [String(receipt.chatId), receipt.readSeq])) };
}

/** The mentions and threads are read once: the tab's rows and the chips' counts come from the same answer. */
type Found = { mentioned: Message[]; inThreads: Message[] };

async function rowsOf(scope: Scope, type: ActivityType, found: Found): Promise<{ message: Message; at: Date; authorId: string; unread: boolean }[]> {
  if (type === 'mentions') return found.mentioned.map((message) => ({ message, at: message.at, authorId: String(message.senderId), unread: mentionUnread(scope, message) }));
  if (type === 'threads') return found.inThreads.map((message) => ({ message, at: message.hilo?.ultimaEn ?? message.at, authorId: String(message.senderId), unread: threadUnread(scope, message) }));
  const reacted = await MessageModel.find(reactionsFilter(scope)).select(FIELDS).sort({ at: -1 }).limit(REACTED_SCAN).lean<Message[]>();
  return reacted
    .flatMap((message) => {
      const others = reactionsFromOthers((message.reacciones ?? []).map((reaction) => ({ userId: reaction.userId, emoji: reaction.emoji, en: reaction.en ? new Date(reaction.en).toISOString() : undefined })) as Reaccion[], String(scope.me));
      return others ? [{ message, at: others.latestAt ? new Date(others.latestAt) : message.at, authorId: others.latestBy, unread: false }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ACTIVITY_LIMIT);
}

/**
 * «Menciones y actividad» (design `e-19-menciones-actividad`): the mentions of
 * me (by name or by a group mention), the threads I am in and the reactions of
 * others to my messages — of one space (`?workspace=`) or of the personal
 * account, never mixed. `unread` counts the new mentions and threads for the
 * tabs and the list's chips (`?counts=1` brings only those). A mention is
 * read when its chat is read.
 */
export function buildActivityRouter(): Router {
  const router = Router();
  router.get('/activity', requireSession, asyncRoute(async (req, res) => {
    const me = new Types.ObjectId(req.session!.userId);
    const rawWorkspace = typeof req.query.workspace === 'string' ? req.query.workspace : undefined;
    const workspaceId = rawWorkspace && Types.ObjectId.isValid(rawWorkspace) ? new Types.ObjectId(rawWorkspace) : undefined;
    if (rawWorkspace && (!workspaceId || !(await allActiveIn(workspaceId, [me])))) return res.status(404).json({ message: 'Ese espacio no existe o no estás en él.' });
    const scope = await scopeOf(me, workspaceId);
    const type = activityType(req.query.type);
    // The list's «Hilos» and «Menciones» chips only need the counts.
    const countsOnly = req.query.counts === '1';
    const [mentioned, inThreads] = await Promise.all([
      MessageModel.find(mentionsFilter(scope)).select(FIELDS).sort({ at: -1 }).limit(ACTIVITY_LIMIT).lean<Message[]>(),
      MessageModel.find(threadsFilter(scope)).select(FIELDS).sort({ 'hilo.ultimaEn': -1 }).limit(ACTIVITY_LIMIT).lean<Message[]>(),
    ]);
    const rows = countsOnly ? [] : await rowsOf(scope, type, { mentioned, inThreads });
    const chatIds = [...new Set(rows.map((row) => String(row.message.chatId)))].map((id) => new Types.ObjectId(id));
    const [chats, channelRows] = await Promise.all([
      infoDeChats(chatIds, String(me)),
      ChatModel.find({ _id: { $in: chatIds }, channel: { $exists: true } }).select('_id').lean(),
    ]);
    const channels = new Set(channelRows.map((chat) => String(chat._id)));
    const people = await personasPorId([...rows.map((row) => row.authorId), ...[...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : []))]);
    const items: ActivityItem[] = rows.map(({ message, at, authorId, unread }) => ({
      chatId: String(message.chatId),
      seq: message.seq,
      at: at.toISOString(),
      chat: { ...chatVisible(chats.get(String(message.chatId)), people), ...(channels.has(String(message.chatId)) ? { channel: true } : {}) },
      author: { id: authorId, ...people.get(authorId) },
      ...(message.body ? { body: message.body } : {}),
      ...(message.menciones?.length ? { menciones: message.menciones } : {}),
      unread,
      ...(message.hilo?.respuestas ? { thread: { replies: message.hilo.respuestas, ...(message.hilo.ultimaEn ? { lastAt: new Date(message.hilo.ultimaEn).toISOString() } : {}) } } : {}),
      ...(type === 'reactions' ? { reactions: (reactionsFromOthers((message.reacciones ?? []) as unknown as Reaccion[], String(me))?.groups ?? []).map(({ emoji, count }) => ({ emoji, count })) } : {}),
    }));
    res.json({ items, unread: { mentions: mentioned.filter((message) => mentionUnread(scope, message)).length, threads: inThreads.filter((message) => threadUnread(scope, message)).length } });
  }));
  return router;
}
