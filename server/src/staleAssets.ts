import type { NextFunction, Request, Response } from 'express';

/** Folders whose files carry their version in the name or the path: they never change. */
export const VERSIONED_FOLDERS = ['assets', 'mediapipe', 'stickers'];

/**
 * A versioned file that is not on disk is a 404, not the SPA's page (José
 * 30/10: a tab open across a deploy asked for the old emoji panel, got the
 * HTML back and the whole web broke). Goes after the static files and before
 * the fallback to `index.html`.
 */
export function missingVersionedFile(req: Request, res: Response, next: NextFunction) {
  const folder = req.path.split('/')[1] ?? '';
  if (!VERSIONED_FOLDERS.includes(folder)) return next();
  res.status(404).type('text/plain').send('Ese archivo es de una versión anterior.');
}
