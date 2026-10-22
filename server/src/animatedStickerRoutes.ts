import type { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { STICKER_SIZE } from '@lilachat/shared';
import { ChatModel, MessageModel } from './chatModels.js';
import { toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { StickerModel } from './stickerModel.js';
import { toClientSticker } from './stickerView.js';

/** A GIF from the gallery can be heavy: up to 8 MB goes in, at most 500 KB comes out. */
export const MAX_GIF_BYTES = 8 * 1024 * 1024;
const GIF_TYPES = new Set(['image/gif', 'image/webp']);
const FETCH_TIMEOUT_MS = 15_000;

/** GIF bytes → a 512×512 animated WebP, or why not. `animatedSticker.ts` does it with sharp. */
export type GifConverter = (gif: Buffer) => Promise<Buffer | 'too-heavy' | 'not-an-image'>;
export type MediaFetcher = (url: string) => Promise<Buffer>;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_GIF_BYTES + 1 } });
const receiveGif = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (error?: unknown) => {
    if (error) return res.status(413).json({ message: 'Ese GIF pesa demasiado (máximo 8 MB).' });
    next();
  });
const asObjectId = (value: unknown) => (Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null);

/** Our own media only: the URL comes from the message the server stored, never from the client. */
export async function fetchStoredMedia(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`media ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_GIF_BYTES) throw new Error('media too large');
  return bytes;
}

const REFUSALS = {
  'too-heavy': { status: 413, message: 'No se pudo dejar ese GIF en 500 KB: prueba con uno más corto.' },
  'not-an-image': { status: 400, message: 'Ese archivo no es un GIF.' },
} as const;

/**
 * My own animated stickers (pending 37, José 21/10 and 22/10): from a GIF of
 * the gallery, or from a GIF already in a chat (GIPHY's or someone's). Both
 * end in «Mis stickers» as a 512×512 animated WebP.
 */
export function animatedStickerRoutes(router: Router, deps: { uploader: MediaUploader; convert: GifConverter; fetchMedia: MediaFetcher }): void {
  const save = async (req: Request, res: Response, gif: Buffer) => {
    const me = req.session!.userId;
    const webp = await deps.convert(gif);
    if (typeof webp === 'string') return void res.status(REFUSALS[webp].status).json({ message: REFUSALS[webp].message });
    const uploaded = await deps.uploader.upload({ chatId: `stickers-${me}`, fileName: 'sticker-animado.webp', mimeType: 'image/webp', kind: 'image', bytes: webp });
    if (!uploaded.ok) return void res.status(503).json({ message: 'No se pudo guardar el sticker. Inténtalo de nuevo.' });
    const sticker = await StickerModel.create({ userId: me, mediaId: uploaded.media.storageName, url: uploaded.media.url, mime: 'image/webp', width: STICKER_SIZE, height: STICKER_SIZE, animated: true });
    res.status(201).json({ sticker: toClientSticker(sticker) });
  };

  router.post('/stickers/animated', requireSession, receiveGif, asyncRoute(async (req, res) => {
    if (!req.file || !GIF_TYPES.has(req.file.mimetype)) return void res.status(400).json({ message: 'Elige un GIF.' });
    await save(req, res, req.file.buffer);
  }));

  router.post('/stickers/from-gif', requireSession, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const chatId = asObjectId(req.body?.chatId);
    const chat = chatId ? await ChatModel.findOne({ _id: chatId, 'members.userId': me }).select('encrypted').lean() : null;
    if (!chat) return void res.status(404).json({ message: 'Ese chat no existe.' });
    if (chat.encrypted) return void res.status(400).json({ message: 'En un chat secreto el GIF está cifrado: no se puede convertir.' });
    const message = await MessageModel.findOne({ chatId, seq: Number(req.body?.seq), kind: 'image', 'media.mime': 'image/gif', deletedAt: { $exists: false } }).select('media').lean();
    if (!message?.media?.url) return void res.status(400).json({ message: 'Ese mensaje no es un GIF.' });
    const gif = await deps.fetchMedia(toAbsoluteMediaUrl(message.media.url)).catch(() => null);
    if (!gif) return void res.status(502).json({ message: 'No se pudo leer el GIF. Inténtalo de nuevo.' });
    await save(req, res, gif);
  }));
}
