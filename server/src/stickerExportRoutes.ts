import type { Router } from 'express';
import { Types } from 'mongoose';
import { stickerExportOf } from '@lilachat/shared';
import { readMediaBytes } from './mediaClient.js';
import { asyncRoute, requireSession } from './requireSession.js';
import type { StickerVideoMaker } from './stickerVideo.js';
import { StickerModel } from './stickerModel.js';

/**
 * «Exportar para WhatsApp» (José 27/11, design sa-05): a saved sticker as a short MP4 with its sound. WhatsApp takes
 * no sound from other apps; in WhatsApp, Stickers › Crear › this video makes the sound sticker. Only my own stickers.
 */
export function stickerExportRoutes(router: Router, deps: { makeVideo: StickerVideoMaker; readBytes?: (url: string) => Promise<Buffer | null> }): void {
  const read = deps.readBytes ?? readMediaBytes;
  router.get('/stickers/:id/export.mp4', requireSession, asyncRoute(async (req, res) => {
    const id = Types.ObjectId.isValid(String(req.params.id)) ? new Types.ObjectId(String(req.params.id)) : null;
    const sticker = id ? await StickerModel.findOne({ _id: id, userId: req.session!.userId }).lean() : null;
    if (!sticker) return void res.status(404).json({ message: 'Ese sticker ya no está en tus stickers.' });
    if (!stickerExportOf(sticker).video) return void res.status(400).json({ message: 'Este sticker no se mueve ni suena: expórtalo como imagen.' });
    const [picture, sound] = await Promise.all([read(sticker.url), sticker.audioUrl ? read(sticker.audioUrl) : null]);
    const video = picture ? await deps.makeVideo({ picture, sound }) : null;
    if (!video) return void res.status(503).json({ message: 'No se pudo preparar el video. Inténtalo de nuevo.' });
    res.set({ 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="sticker-lilachat.mp4"', 'Cache-Control': 'no-store' });
    res.send(video);
  }));
}
