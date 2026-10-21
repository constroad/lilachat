import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { dimensionValida, findPackSticker, packStickerPath, STICKER_SIZE } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { sendMessage } from './chatService.js';
import { pedidoSeguro } from './cookieDeDispositivo.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { toClientMessage } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarHilo, publicarMensaje } from './socket.js';
import { StickerModel, type Sticker } from './stickerModel.js';

/** A static sticker is light (WhatsApp: ~100 KB); room left for a lossless WebP. */
const MAX_STICKER_BYTES = 512 * 1024;
const STICKER_TYPES = new Set(['image/webp', 'image/png']);
const VALID_HOST = /^[a-z0-9.-]+(:\d+)?$/i;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_STICKER_BYTES + 1 } });
const asObjectId = (value: unknown) => (Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null);

function toClientSticker(sticker: Pick<Sticker, '_id' | 'url' | 'mime' | 'width' | 'height' | 'favorite' | 'createdAt'>) {
  return { id: String(sticker._id), url: toAbsoluteMediaUrl(sticker.url), mime: sticker.mime, width: sticker.width, height: sticker.height, favorite: sticker.favorite, at: sticker.createdAt };
}

/** Multer cuts an oversized file with an error: answer 413, not 500. */
const receiveFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (error?: unknown) => {
    if (error) return res.status(413).json({ message: 'El sticker pesa demasiado.' });
    next();
  });

/** The default pack lives on the server that serves the web: its absolute url, or null for a forged Host. */
function packMedia(req: Request, id: string) {
  const sticker = findPackSticker(id);
  const host = req.headers.host ?? '';
  if (!sticker || !VALID_HOST.test(host)) return sticker ? 'bad-host' : null;
  const url = `${pedidoSeguro(req) ? 'https' : 'http'}://${host}${packStickerPath(sticker.packId, sticker.slug)}`;
  return { mediaId: id, url, mime: 'image/webp', width: STICKER_SIZE, height: STICKER_SIZE };
}

type StickerMedia = { mediaId: string; url: string; mime: string; width: number; height: number };
type UserId = Types.ObjectId | string;

/** What a send refers to: one of my stickers or a pack one. */
async function mediaToSend(req: Request, me: UserId): Promise<StickerMedia | 'bad-host' | null> {
  const id = String(req.body?.stickerId ?? '');
  if (findPackSticker(id)) return packMedia(req, id);
  const objectId = asObjectId(id);
  const sticker = objectId ? await StickerModel.findOne({ _id: objectId, userId: me }).lean() : null;
  return sticker ? { mediaId: sticker.mediaId, url: sticker.url, mime: sticker.mime, width: sticker.width, height: sticker.height } : null;
}

/** Keep a sticker in «Mis stickers» once per file (a received one, or a pack one). */
const keepSticker = (me: UserId, media: StickerMedia, favorite = false) =>
  StickerModel.findOneAndUpdate(
    { userId: me, mediaId: media.mediaId },
    { $setOnInsert: { url: media.url, mime: media.mime, width: media.width, height: media.height }, ...(favorite ? { $set: { favorite: true } } : {}) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

function libraryRoutes(router: Router, uploader: MediaUploader) {
  router.get('/stickers', requireSession, asyncRoute(async (req, res) => {
    const stickers = await StickerModel.find({ userId: req.session!.userId }).sort({ createdAt: -1 }).lean();
    res.json({ stickers: stickers.map(toClientSticker) });
  }));

  router.post('/stickers', requireSession, receiveFile, asyncRoute(async (req, res) => {
    const file = req.file;
    if (!file || !STICKER_TYPES.has(file.mimetype)) return res.status(400).json({ message: 'Un sticker es un WebP o PNG con fondo transparente.' });
    if (file.size > MAX_STICKER_BYTES) return res.status(413).json({ message: 'El sticker pesa demasiado.' });
    const me = req.session!.userId;
    const uploaded = await uploader.upload({ chatId: `stickers-${me}`, fileName: file.originalname || 'sticker.webp', mimeType: file.mimetype, kind: 'image', bytes: file.buffer });
    if (!uploaded.ok) return res.status(503).json({ message: 'No se pudo guardar el sticker. Inténtalo de nuevo.' });
    const sticker = await StickerModel.create({
      userId: me,
      mediaId: uploaded.media.storageName,
      url: uploaded.media.url,
      mime: file.mimetype,
      width: dimensionValida(req.body?.width) ?? STICKER_SIZE,
      height: dimensionValida(req.body?.height) ?? STICKER_SIZE,
    });
    res.status(201).json({ sticker: toClientSticker(sticker) });
  }));

  router.patch('/stickers/:id', requireSession, asyncRoute(async (req, res) => {
    const id = asObjectId(req.params.id);
    const sticker = id ? await StickerModel.findOneAndUpdate({ _id: id, userId: req.session!.userId }, { $set: { favorite: req.body?.favorite === true } }, { new: true }).lean() : null;
    if (!sticker) return res.status(404).json({ message: 'Ese sticker no existe.' });
    res.json({ sticker: toClientSticker(sticker) });
  }));

  router.delete('/stickers/:id', requireSession, asyncRoute(async (req, res) => {
    const id = asObjectId(req.params.id);
    const removed = id ? await StickerModel.deleteOne({ _id: id, userId: req.session!.userId }) : null;
    if (!removed?.deletedCount) return res.status(404).json({ message: 'Ese sticker no existe.' });
    res.status(204).end();
  }));
}

function keepRoutes(router: Router) {
  /** Save a sticker someone sent me (once per file). */
  router.post('/stickers/from-message', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const chatId = asObjectId(req.body?.chatId);
    if (!chatId || !(await ChatModel.exists({ _id: chatId, 'members.userId': me }))) return res.status(404).json({ message: 'Ese chat no existe.' });
    const message = await MessageModel.findOne({ chatId, seq: Number(req.body?.seq), kind: 'sticker', deletedAt: { $exists: false } }).select('media').lean();
    if (!message?.media?.url || !message.media.mediaId) return res.status(400).json({ message: 'Ese mensaje no es un sticker.' });
    const { mediaId, url, mime, width, height } = message.media;
    const sticker = await keepSticker(me, { mediaId, url, mime: mime ?? 'image/webp', width: width ?? STICKER_SIZE, height: height ?? STICKER_SIZE });
    res.status(201).json({ sticker: toClientSticker(sticker!) });
  }));

  /** Keep a default pack sticker (to mark it as favorite). */
  router.post('/stickers/from-pack', requireSession, asyncRoute(async (req, res) => {
    const media = packMedia(req, String(req.body?.stickerId ?? ''));
    if (!media) return res.status(404).json({ message: 'Ese sticker no existe.' });
    if (media === 'bad-host') return res.status(400).json({ message: 'No se pudo guardar el sticker.' });
    const sticker = await keepSticker(req.session!.userId, media, req.body?.favorite === true);
    res.status(201).json({ sticker: toClientSticker(sticker!) });
  }));
}

/**
 * Stickers (José, 20/10: «I upload a photo, the background goes away, I add
 * text and make the sticker»). The sticker is made on the phone or the web;
 * here live «Mis stickers», the default pack and the send, which reuses the
 * file instead of uploading it again. Session per route: mounted on `/api`.
 */
export function buildStickersRouter(uploader: MediaUploader = buildLilaUploader()): Router {
  const router = Router();
  libraryRoutes(router, uploader);
  keepRoutes(router);

  /** A `sticker` message with the SAME file; a retry (same `clientKey`) does not duplicate. */
  router.post('/chats/:chatId/stickers', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const chatId = asObjectId(req.params.chatId);
    const clientKey = String(req.body?.clientKey ?? '');
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('encrypted').lean() : null;
    if (!chat) return res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return res.status(400).json({ message: 'En un chat secreto todavía no se mandan stickers.' });
    const media = await mediaToSend(req, me);
    if (!media) return res.status(404).json({ message: 'Ese sticker no existe.' });
    if (media === 'bad-host') return res.status(400).json({ message: 'No se pudo mandar el sticker.' });
    if (!clientKey) return res.status(400).json({ message: 'Falta la clave del envío.' });
    // In a thread too (José, 20/10: «I can't send a sticker in a thread»), with «also send to the chat».
    const thread = Number.isInteger(req.body?.hiloDe) ? { hiloDe: req.body.hiloDe as number, enElChat: req.body?.enElChat === true } : {};
    const sent = await sendMessage({ chatId: String(chatId), senderId: me, clientKey, kind: 'sticker', media, ...(Number.isInteger(req.body?.replyToSeq) ? { replyToSeq: req.body.replyToSeq } : {}), ...thread });
    if (!sent.duplicate) {
      const members = await publicarMensaje(sent.message, sent.members);
      if (sent.hilo && sent.message.hiloDe !== undefined) avisarHilo(String(chatId), sent.message.hiloDe, sent.hilo, members);
    }
    res.status(201).json({ message: toClientMessage(sent.message), duplicate: sent.duplicate });
  }));

  return router;
}
