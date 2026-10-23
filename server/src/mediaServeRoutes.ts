import path from 'node:path';
import { Router } from 'express';
import type { Disco } from './disco.js';
import { safeRelative } from './mediaDisk.js';

const RETRY_AFTER_ABSENT_S = '5';
const RETRY_AFTER_HUNG_S = '10';
const YEAR_S = 31_536_000;

/**
 * `GET /media/<path>`: our files, public like lila's `/files/` were (the names
 * carry a hash, so they cannot be guessed), with Range for videos and a year of
 * cache because a name never changes its content. Without the disk the answer
 * is 503 with `Retry-After`, never 404: a 404 would leave the photo broken for
 * good after a restart (lilafotos' 415, `deploy-mini` §7.16).
 */
export function buildMediaServeRouter(disk: () => Disco | null): Router {
  const router = Router();
  router.get('/*', async (req, res) => {
    const relative = safeRelative(decodeURIComponent(req.path));
    const current = disk();
    if (!relative || !current) return void res.status(404).end();
    const state = await current.estado();
    if (state !== 'montado') {
      res.setHeader('Retry-After', state === 'ausente' ? RETRY_AFTER_ABSENT_S : RETRY_AFTER_HUNG_S);
      return void res.status(503).json({ motivo: state === 'ausente' ? 'disco_ausente' : 'disco_colgado' });
    }
    res.sendFile(path.join(current.raiz, relative), { acceptRanges: true, maxAge: YEAR_S * 1000, immutable: true, dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  });
  return router;
}
