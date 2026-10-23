import { Readable } from 'node:stream';
import { Router } from 'express';
import { Types } from 'mongoose';
import { ChatModel, MessageModel, type Message } from './chatModels.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { readOwnMedia } from './mediaDisk.js';
import { asyncRoute, requireSession } from './requireSession.js';

const UPSTREAM_TIMEOUT_MS = 30_000;
const VIEWABLE = new Set(['application/pdf']);

/**
 * A chat's PDF, through Lilachat (José, 21/10: the web had no viewer). The
 * files live in lila-app, which does not let other sites frame them; here the
 * check is membership of the chat, and the bytes come through so the web
 * shows the file in its own dialog. Mounted on `/api/chats`.
 */
export function buildFileViewRouter(): Router {
  const router = Router();
  router.get('/:chatId/files/:seq', requireSession, asyncRoute(async (req, res) => {
    const { chatId } = req.params;
    const seq = Number(req.params.seq);
    if (!Types.ObjectId.isValid(chatId!) || !Number.isInteger(seq) || !(await ChatModel.exists({ _id: chatId, 'members.userId': req.session!.userId }))) return void res.status(404).json({ message: 'Ese archivo no existe.' });
    const message = await MessageModel.findOne({ chatId, seq, deletedAt: { $exists: false } }).select('media').lean<Message | null>();
    const media = message?.media;
    if (!media?.url || !VIEWABLE.has(media.mime ?? '')) return void res.status(404).json({ message: 'Ese archivo no se puede ver aquí.' });
    res.setHeader('Content-Type', media.mime!);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(media.fileName ?? 'archivo.pdf')}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    // Our own file (pending 82) comes from the disk; lila's still travel.
    const own = await readOwnMedia(media.url);
    if (own) return void res.end(own);
    const upstream = await fetch(toAbsoluteMediaUrl(media.url), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }).catch(() => null);
    if (!upstream?.ok || !upstream.body) {
      res.removeHeader('Content-Disposition');
      return void res.status(502).json({ message: 'No se pudo traer el archivo. Inténtalo de nuevo.' });
    }
    Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
  }));
  return router;
}
