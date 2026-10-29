import { Router } from 'express';
import { Types, type QueryFilter } from 'mongoose';
import { escaparRegex, mediaLibraryType, mediaSearchTerm, primerEnlace, type MediaLibraryItem, type MediaLibraryType } from '@lilachat/shared';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { chatVisible, infoDeChats, personasPorId } from './contextoDeChats.js';
import { toClientMessage } from './messageView.js';
import { allActiveIn } from './workspaceChats.js';
import { asyncRoute, requireSession } from './requireSession.js';

/** A page of the library: a screen of thumbnails, and «before» asks for the next one. */
const PAGE_DEFAULT = 60;
const PAGE_MAX = 100;
const KINDS: Record<MediaLibraryType, Message['kind'][]> = { all: ['image', 'video', 'file', 'text'], photos: ['image'], videos: ['video'], files: ['file'], links: ['text'] };
const HAS_LINK = /https?:\/\//i;

const pageSize = (value: unknown) => {
  const asked = Number(value);
  return Number.isInteger(asked) && asked > 0 ? Math.min(asked, PAGE_MAX) : PAGE_DEFAULT;
};
const validDate = (value: unknown): Date | null => {
  const date = typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

/** My chats of the personal account, or of one space: never a secret chat (the server does not see it). */
async function chatsOf(me: Types.ObjectId, workspaceId: Types.ObjectId | undefined): Promise<Types.ObjectId[]> {
  const chats = await ChatModel.find({ 'members.userId': me, encrypted: { $ne: true }, workspaceId: workspaceId ?? { $exists: false } }).select('_id').lean();
  return chats.map((chat) => chat._id);
}

/** Which messages of a tab: a text counts only with a link, in «Enlaces» and in «Todo». */
function kindFilter(type: MediaLibraryType): QueryFilter<Message> {
  if (type === 'links') return { kind: 'text', body: HAS_LINK };
  if (type !== 'all') return { kind: { $in: KINDS[type] } };
  return { kind: { $in: KINDS.all }, $or: [{ kind: { $ne: 'text' } }, { body: HAS_LINK }] };
}

/** The search (pending 6): the file's name, the caption or the link's text, as plain text. */
function searchFilter(term: string | null): QueryFilter<Message> {
  if (!term) return {};
  const pattern = new RegExp(escaparRegex(term), 'i');
  return { $and: [{ $or: [{ 'media.fileName': pattern }, { body: pattern }] }] };
}

async function toItems(messages: Message[], me: string): Promise<MediaLibraryItem[]> {
  const chats = await infoDeChats([...new Set(messages.map((m) => String(m.chatId)))].map((id) => new Types.ObjectId(id)), me);
  const people = await personasPorId([...chats.values()].flatMap((chat) => (chat.otroId ? [chat.otroId] : [])));
  return messages.flatMap((raw) => {
    const message = toClientMessage(raw);
    const link = message.kind === 'text' ? primerEnlace(message.body) : null;
    if (message.kind === 'text' && !link) return [];
    return [{
      chatId: String(message.chatId),
      seq: message.seq,
      at: new Date(message.at).toISOString(),
      senderId: String(message.senderId),
      kind: message.kind as MediaLibraryItem['kind'],
      chat: chatVisible(chats.get(String(message.chatId)), people),
      ...(message.media ? { media: { url: message.media.url, thumbUrl: message.media.thumbUrl, mime: message.media.mime, fileName: message.media.fileName, sizeBytes: message.media.sizeBytes, width: message.media.width, height: message.media.height, durationMs: message.media.durationMs } } : {}),
      ...(link ? { link, body: message.body } : {}),
    }];
  });
}

/**
 * «Medios» (pending 38, José 21/10): photos, videos, documents and links of
 * all my chats — the personal ones, or those of one space (`?workspace=`), so
 * the company never mixes with the personal. Newest first, paged by date.
 * «Todo» and the search `?q=` since pending 6.
 *
 * Read through the index `{chatId, kind, at}`, declared in `chatModels.ts` and
 * created in the vault on 21/10 with José's OK (the vault has no autoIndex).
 */
export function buildMediaLibraryRouter(): Router {
  const router = Router();
  router.get('/library', requireSession, asyncRoute(async (req, res) => {
    const me = new Types.ObjectId(req.session!.userId);
    const rawWorkspace = typeof req.query.workspace === 'string' ? req.query.workspace : undefined;
    const workspaceId = rawWorkspace && Types.ObjectId.isValid(rawWorkspace) ? new Types.ObjectId(rawWorkspace) : undefined;
    if (rawWorkspace && (!workspaceId || !(await allActiveIn(workspaceId, [me])))) return res.status(404).json({ message: 'Ese espacio no existe o no estás en él.' });
    const type = mediaLibraryType(req.query.type);
    const limit = pageSize(req.query.limit);
    const before = validDate(req.query.before);
    const filter: QueryFilter<Message> = {
      chatId: { $in: await chatsOf(me, workspaceId) },
      ...kindFilter(type),
      ...searchFilter(mediaSearchTerm(req.query.q)),
      deletedAt: { $exists: false },
      envelope: { $exists: false },
      ...(before ? { at: { $lt: before } } : {}),
    };
    const found = await MessageModel.find(filter).select('chatId seq senderId kind body media at').sort({ at: -1, _id: -1 }).limit(limit + 1).lean<Message[]>();
    res.json({ items: await toItems(found.slice(0, limit), String(me)), hasMore: found.length > limit });
  }));
  return router;
}
