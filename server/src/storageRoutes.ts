import { Router } from 'express';
import { Types } from 'mongoose';
import { BIG_FILE_BYTES, foldStorageRows, STORAGE_KINDS, type BigFile, type StorageChatLabel, type StorageKind, type StorageReport } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { chatVisible, infoDeChats, personasPorId } from './contextoDeChats.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** The heaviest chats and the biggest files it lists: enough to clean up, never the whole history. */
const CHAT_LIMIT = 30;
const BIG_FILE_LIMIT = 60;
/** One chat's files, biggest first. */
const CHAT_FILE_LIMIT = 100;

type MyChat = { _id: Types.ObjectId; members: { userId: Types.ObjectId; borradoHasta?: number }[] };

/** The media I still see in my chats (or in one of them): not deleted, after what I cleared «for me», no stickers. */
async function visibleMediaFilter(me: Types.ObjectId, onlyChat?: Types.ObjectId) {
  const chats = await ChatModel.find({ 'members.userId': me, ...(onlyChat ? { _id: onlyChat } : {}) }).select('members.userId members.borradoHasta').lean<MyChat[]>();
  if (chats.length === 0) return null;
  const floorOf = (chat: MyChat) => chat.members.find((member) => String(member.userId) === String(me))?.borradoHasta ?? 0;
  return {
    $or: chats.map((chat) => ({ chatId: chat._id, seq: { $gt: floorOf(chat) } })),
    kind: { $in: [...STORAGE_KINDS] },
    deletedAt: null,
    'media.sizeBytes': { $gt: 0 },
  };
}

type MediaRow = { chatId: Types.ObjectId; seq: number; kind: StorageKind; media: { sizeBytes: number; fileName?: string }; at: Date };

const toBigFile = (message: MediaRow): BigFile => ({
  chatId: String(message.chatId),
  seq: message.seq,
  kind: message.kind,
  bytes: message.media.sizeBytes,
  ...(message.media.fileName ? { fileName: message.media.fileName } : {}),
  at: message.at.toISOString(),
});

/** How each chat is shown (the same labels «Medios» uses): its name, or the other person in a 1:1. */
async function labelsFor(chatIds: string[], me: Types.ObjectId): Promise<Map<string, StorageChatLabel>> {
  const infos = await infoDeChats([...new Set(chatIds)].map((id) => new Types.ObjectId(id)), String(me));
  const people = await personasPorId([...infos.values()].flatMap((info) => (info.otroId ? [info.otroId] : [])));
  return new Map([...infos.keys()].map((id) => [id, chatVisible(infos.get(id), people)]));
}

const biggestFirst = (filter: object, limit: number) =>
  MessageModel.find(filter).sort({ 'media.sizeBytes': -1 }).limit(limit).select('chatId seq kind media.sizeBytes media.fileName at').lean<MediaRow[]>();

export async function storageReport(me: Types.ObjectId): Promise<StorageReport> {
  const filter = await visibleMediaFilter(me);
  if (!filter) return { chats: [], bigFiles: [] };
  const [sums, big] = await Promise.all([
    MessageModel.aggregate<{ _id: { chatId: Types.ObjectId; kind: StorageKind }; bytes: number; count: number }>([
      { $match: filter },
      { $group: { _id: { chatId: '$chatId', kind: '$kind' }, bytes: { $sum: '$media.sizeBytes' }, count: { $sum: 1 } } },
    ]),
    biggestFirst({ ...filter, 'media.sizeBytes': { $gte: BIG_FILE_BYTES } }, BIG_FILE_LIMIT),
  ]);
  const chats = foldStorageRows(sums.map((row) => ({ chatId: String(row._id.chatId), kind: row._id.kind, bytes: row.bytes, count: row.count }))).slice(0, CHAT_LIMIT);
  const labels = await labelsFor([...chats.map((chat) => chat.chatId), ...big.map((message) => String(message.chatId))], me);
  return {
    chats: chats.map((chat) => ({ ...chat, chat: labels.get(chat.chatId) })),
    bigFiles: big.map((message) => ({ ...toBigFile(message), chat: labels.get(String(message.chatId)) })),
  };
}

/** Every file of one of my chats, biggest first; null when it is not mine. */
export async function chatStorageFiles(me: Types.ObjectId, chatId: string): Promise<BigFile[] | null> {
  if (!Types.ObjectId.isValid(chatId)) return null;
  const filter = await visibleMediaFilter(me, new Types.ObjectId(chatId));
  if (!filter) return null;
  return (await biggestFirst(filter, CHAT_FILE_LIMIT)).map(toBigFile);
}

/** Pending 13: «Almacenamiento» asks what each of my chats weighs and which files are the biggest. */
export function buildStorageRouter(): Router {
  const router = Router();
  router.get('/storage', requireSession, asyncRoute(async (req, res) => {
    res.json(await storageReport(req.session!.userId));
  }));
  router.get('/storage/chats/:chatId/files', requireSession, asyncRoute(async (req, res) => {
    const files = await chatStorageFiles(req.session!.userId, String(req.params.chatId));
    if (!files) return void res.status(404).json({ message: 'Ese chat no existe.' });
    res.json({ files });
  }));
  return router;
}
