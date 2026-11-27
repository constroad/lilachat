import type { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { clipWindowOf, MAX_STICKER_AUDIO_BYTES, MAX_STICKER_VIDEO_BYTES, parseStickerSound, soundPresetPath, STICKER_SIZE, type StickerSound } from '@lilachat/shared';
import type { MediaUploader } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import type { VideoStickerConverter } from './soundSticker.js';
import { StickerModel } from './stickerModel.js';
import { toClientSticker } from './stickerView.js';
import { webFileUrl } from './webOrigin.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_STICKER_VIDEO_BYTES + 1 } });
const receiveParts = (req: Request, res: Response, next: NextFunction) =>
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'audio', maxCount: 1 }])(req, res, (error?: unknown) => {
    if (error) return res.status(413).json({ message: 'Ese video pesa demasiado (máximo 60 MB).' });
    next();
  });

const REFUSALS = {
  'too-heavy': { status: 413, message: 'No se pudo dejar ese clip en 500 KB: prueba con uno más corto.' },
  'not-a-video': { status: 400, message: 'No se pudo leer ese video.' },
} as const;

type Parts = { video?: Express.Multer.File; audio?: Express.Multer.File };
const partsOf = (req: Request): Parts => {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
  return { video: files.file?.[0], audio: files.audio?.[0] };
};

/** Why the request cannot make a sticker, or null when it can. */
function refusalOf(parts: Parts, sound: StickerSound | null): string | null {
  if (!parts.video || !parts.video.mimetype.startsWith('video/')) return 'Elige un video.';
  if (!sound) return 'Elige el sonido del sticker.';
  if (sound.kind !== 'file') return null;
  if (!parts.audio || !(parts.audio.mimetype.startsWith('audio/') || parts.audio.mimetype === 'video/mp4')) return 'Elige un audio.';
  return parts.audio.size > MAX_STICKER_AUDIO_BYTES ? 'Ese audio pesa demasiado (máximo 4 MB).' : null;
}

const soundSourceOf = (sound: StickerSound, parts: Parts): 'video' | Buffer | null =>
  sound.kind === 'original' ? 'video' : sound.kind === 'file' ? parts.audio!.buffer : null;

/**
 * A sticker with sound from a video (José 26/11, designs ss-01…ss-04): the
 * clip of up to 6 s becomes a 512×512 animated WebP in «Mis stickers», and its
 * sound (the video's, a recorded or uploaded one, or one of ours) goes with it.
 */
export function videoStickerRoutes(router: Router, deps: { uploader: MediaUploader; convert: VideoStickerConverter }): void {
  router.post('/stickers/from-video', requireSession, receiveParts, asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const parts = partsOf(req);
    const sound = parseStickerSound(req.body?.sound);
    const refusal = refusalOf(parts, sound);
    if (refusal) return void res.status(400).json({ message: refusal });
    const window = clipWindowOf(req.body?.startMs, req.body?.endMs);
    if (!window) return void res.status(400).json({ message: 'Elige un tramo de medio segundo a 6 segundos.' });
    const presetUrl = sound!.kind === 'preset' ? webFileUrl(req, soundPresetPath(sound!.presetId)!) : null;
    if (sound!.kind === 'preset' && !presetUrl) return void res.status(400).json({ message: 'No se pudo guardar el sticker.' });

    const made = await deps.convert({ video: parts.video!.buffer, window, soundFrom: soundSourceOf(sound!, parts) });
    if (typeof made === 'string') return void res.status(REFUSALS[made].status).json({ message: REFUSALS[made].message });
    const chatId = `stickers-${me}`;
    const picture = await deps.uploader.upload({ chatId, fileName: 'sticker-video.webp', mimeType: 'image/webp', kind: 'image', bytes: made.webp });
    const track = made.audio ? await deps.uploader.upload({ chatId, fileName: 'sticker-sonido.m4a', mimeType: 'audio/mp4', kind: 'audio', bytes: made.audio }) : null;
    if (!picture.ok || (track && !track.ok)) return void res.status(503).json({ message: 'No se pudo guardar el sticker. Inténtalo de nuevo.' });
    const audioUrl = track?.ok ? track.media.url : presetUrl;
    const sticker = await StickerModel.create({ userId: me, mediaId: picture.media.storageName, url: picture.media.url, mime: 'image/webp', width: STICKER_SIZE, height: STICKER_SIZE, animated: true, ...(audioUrl ? { audioUrl } : {}) });
    res.status(201).json({ sticker: toClientSticker(sticker) });
  }));
}
