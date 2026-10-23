import { Router } from 'express';
import { GIF_MAX_BYTES, gifRenditionToSend, gifsFromGiphy, type GifResult } from '@lilachat/shared';
import { ForbiddenChatError, mensajePropioPorClave, sendMessage } from './chatService.js';
import { toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { defaultMediaUploader } from './localMediaUploader.js';
import { toClientMessage } from './messageView.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { publicarMensaje } from './socket.js';

/**
 * GIPHY through the server (backlog 37, José 21/10; design
 * `g-01-panel-gif-giphy`). The key (`GIPHY_API_KEY`, loaded by José in Torre)
 * never reaches the app or the web; without it the panel does not show the
 * tab. Sending stores the GIF in Lilachat's media like any upload, so it does
 * not depend on GIPHY later and nobody's phone asks GIPHY for it.
 */
const GIPHY_API = 'https://api.giphy.com/v1/gifs';
const PAGE = 24;
const MAX_OFFSET = 480;
const MAX_QUERY = 50;
/** Trending changes slowly: one request per page every few minutes is enough for everyone. */
const TRENDING_CACHE_MS = 5 * 60_000;
const SEARCH_TIMEOUT_MS = 6_000;
const DOWNLOAD_TIMEOUT_MS = 10_000;
const GIF_ID = /^[A-Za-z0-9]{1,40}$/;

export type GiphyFetchers = { json: (url: string) => Promise<unknown>; bytes: (url: string) => Promise<Buffer> };

const realFetchers: GiphyFetchers = {
  json: async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`GIPHY ${response.status}`);
    return response.json();
  },
  bytes: async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`GIPHY ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > GIF_MAX_BYTES) throw new Error('GIF demasiado pesado');
    return bytes;
  },
};

function searchUrl(apiKey: string, q: string, offset: number): string {
  const params = new URLSearchParams({ api_key: apiKey, limit: String(PAGE), offset: String(offset), rating: 'pg-13', bundle: 'messaging_non_clips' });
  if (q) {
    params.set('q', q);
    params.set('lang', 'es');
  }
  return `${GIPHY_API}/${q ? 'search' : 'trending'}?${params}`;
}

export function buildGifRouter(options: { apiKey?: string; fetchers?: GiphyFetchers; uploader?: MediaUploader }): Router {
  const router = Router();
  const apiKey = options.apiKey ?? '';
  const fetchers = options.fetchers ?? realFetchers;
  const uploader = options.uploader ?? defaultMediaUploader();
  const trending = new Map<number, { at: number; gifs: GifResult[] }>();
  router.use(requireSession);

  router.get('/', (_req, res) => void res.json({ available: Boolean(apiKey) }));

  router.get('/search', asyncRoute(async (req, res) => {
    if (!apiKey) return void res.status(404).json({ message: 'GIPHY no está configurado.' });
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, MAX_QUERY) : '';
    const offset = Math.min(MAX_OFFSET, Math.max(0, Number.parseInt(String(req.query.offset ?? '0'), 10) || 0));
    const cached = q ? null : trending.get(offset);
    if (cached && Date.now() - cached.at < TRENDING_CACHE_MS) return void res.json({ gifs: cached.gifs });
    try {
      const gifs = gifsFromGiphy(await fetchers.json(searchUrl(apiKey, q, offset)));
      if (!q) trending.set(offset, { at: Date.now(), gifs });
      res.json({ gifs });
    } catch (error) {
      console.error('[gif] GIPHY no respondió:', error instanceof Error ? error.message : error);
      res.status(503).json({ message: 'GIPHY no respondió. Inténtalo de nuevo.' });
    }
  }));

  router.post('/send', asyncRoute(async (req, res) => {
    if (!apiKey) return void res.status(404).json({ message: 'GIPHY no está configurado.' });
    const chatId = String(req.body?.chatId ?? '');
    const gifId = String(req.body?.gifId ?? '');
    const clientKey = String(req.body?.clientKey ?? '');
    if (!chatId || !clientKey || !GIF_ID.test(gifId)) return void res.status(400).json({ message: 'Faltan datos para mandar el GIF.' });
    try {
      // The retry (the phone did not see the answer) is recognized BEFORE downloading again.
      const previous = await mensajePropioPorClave({ chatId, senderId: req.session!.userId, clientKey });
      if (previous) return void res.status(200).json({ message: toClientMessage(previous), duplicate: true });
      const rendition = gifRenditionToSend(record(await fetchers.json(`${GIPHY_API}/${gifId}?${new URLSearchParams({ api_key: apiKey })}`)).data);
      if (!rendition) return void res.status(400).json({ message: 'Ese GIF no se puede mandar.' });
      const bytes = await fetchers.bytes(rendition.url);
      const uploaded = await uploader.upload({ chatId, fileName: `giphy-${gifId}.gif`, mimeType: 'image/gif', kind: 'image', bytes });
      if (!uploaded.ok) return void res.status(503).json({ message: 'No se pudo mandar el GIF ahora. Inténtalo de nuevo.' });
      const result = await sendMessage({
        chatId,
        senderId: req.session!.userId,
        clientKey,
        kind: 'image',
        media: { mediaId: uploaded.media.storageName, fileName: `giphy-${gifId}.gif`, sizeBytes: bytes.length, width: rendition.width || undefined, height: rendition.height || undefined, thumbUrl: uploaded.media.thumbnailUrl, url: uploaded.media.url, mime: 'image/gif' },
      });
      if (!result.duplicate) await publicarMensaje(result.message, result.members);
      res.status(201).json({ message: toClientMessage(result.message), duplicate: result.duplicate, url: toAbsoluteMediaUrl(uploaded.media.url) });
    } catch (error) {
      if (error instanceof ForbiddenChatError) return void res.status(403).json({ message: error.message });
      console.error('[gif] no se pudo mandar:', error instanceof Error ? error.message : error);
      res.status(503).json({ message: 'No se pudo mandar el GIF ahora. Inténtalo de nuevo.' });
    }
  }));
  return router;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
