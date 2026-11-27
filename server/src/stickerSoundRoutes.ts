import type { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { MAX_STICKER_AUDIO_BYTES, parseStickerSound, soundPresetPath, type StickerSound } from '@lilachat/shared';
import { readMediaBytes, type MediaUploader } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import type { StickerSoundCutter } from './soundSticker.js';
import { StickerModel } from './stickerModel.js';
import { toClientSticker } from './stickerView.js';
import { webFileUrl } from './webOrigin.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_STICKER_AUDIO_BYTES + 1 } });
const receiveAudio = (req: Request, res: Response, next: NextFunction) =>
  upload.single('audio')(req, res, (error?: unknown) => {
    if (error) return res.status(413).json({ message: 'Ese audio pesa demasiado (máximo 4 MB).' });
    next();
  });

const isAudioFile = (file: Express.Multer.File | undefined): file is Express.Multer.File =>
  Boolean(file && (file.mimetype.startsWith('audio/') || file.mimetype === 'video/mp4'));

/** A saved sticker has no video: its sound is a file, one of ours, or none. */
function refusalOf(sound: StickerSound | null, audio: Express.Multer.File | undefined): string | null {
  if (!sound || sound.kind === 'original') return 'Elige el sonido del sticker.';
  return sound.kind === 'file' && !isAudioFile(audio) ? 'Elige un audio.' : null;
}

type Deps = { uploader: MediaUploader; cutSound: StickerSoundCutter };

/** The new sound's address, or null for «Sin sonido»; a string is a refusal to say. */
async function soundUrlOf(req: Request, sticker: { url: string }, sound: StickerSound, deps: Deps): Promise<{ url: string | null } | { refusal: string }> {
  if (sound.kind === 'none') return { url: null };
  if (sound.kind === 'preset') return { url: webFileUrl(req, soundPresetPath(sound.presetId)!) };
  const track = await deps.cutSound({ picture: await readMediaBytes(sticker.url), sound: req.file!.buffer });
  if (!track) return { refusal: 'No se pudo leer ese audio.' };
  const saved = await deps.uploader.upload({ chatId: `stickers-${req.session!.userId}`, fileName: 'sticker-sonido.m4a', mimeType: 'audio/mp4', kind: 'audio', bytes: track });
  return saved.ok ? { url: saved.media.url } : { refusal: 'No se pudo guardar el sonido. Inténtalo de nuevo.' };
}

/**
 * The sound of a sticker already in «Mis stickers» (José 27/11: «quiero agregarle audio sin volver a buscar el GIF»):
 * add, change or take it away. Only the copy in my list changes; what was already sent keeps its own sound.
 */
export function stickerSoundRoutes(router: Router, deps: Deps): void {
  router.post('/stickers/:id/sound', requireSession, receiveAudio, asyncRoute(async (req, res) => {
    const id = Types.ObjectId.isValid(String(req.params.id)) ? new Types.ObjectId(String(req.params.id)) : null;
    const sticker = id ? await StickerModel.findOne({ _id: id, userId: req.session!.userId }).lean() : null;
    if (!sticker) return void res.status(404).json({ message: 'Ese sticker ya no está en tus stickers.' });
    const sound = parseStickerSound(req.body?.sound);
    const refusal = refusalOf(sound, req.file);
    if (refusal) return void res.status(400).json({ message: refusal });
    const next = await soundUrlOf(req, sticker, sound!, deps);
    if ('refusal' in next) return void res.status(400).json({ message: next.refusal });
    const change = next.url ? { $set: { audioUrl: next.url } } : { $unset: { audioUrl: 1 } };
    const updated = await StickerModel.findOneAndUpdate({ _id: sticker._id }, change, { new: true }).lean();
    res.json({ sticker: toClientSticker(updated!) });
  }));
}
