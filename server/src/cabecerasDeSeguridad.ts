import type { NextFunction, Request, Response } from 'express';
import { VIDEO_EMBED_ORIGINS } from '@lilachat/shared';

/**
 * Las cabeceras de seguridad de la web (W0, 19/10).
 *
 * La CSP es la segunda línea contra un XSS: aunque se cuele un script, el
 * navegador no lo ejecuta si no viene del propio origen. Las fotos y audios
 * vienen del almacenamiento (https), las fuentes de Google, y el socket va al
 * mismo host. `style-src 'unsafe-inline'` queda por las fuentes de Google y
 * los estilos que inyectan las librerías; los scripts, nunca.
 *
 * The web sticker cutout (20/10) runs MediaPipe in WebAssembly:
 * `'wasm-unsafe-eval'` allows compiling wasm WITHOUT enabling JS `eval`, the
 * wasm is served from our own origin and the model only comes from
 * MediaPipe's models folder.
 */
const HOST_VALIDO = /^[a-z0-9.-]+(:\d+)?$/i;
const MODELOS_DE_MEDIAPIPE = 'https://storage.googleapis.com/mediapipe-models/';

export function politicaDeContenido(host: string): string {
  const socket = HOST_VALIDO.test(host) ? ` wss://${host} ws://${host}` : '';
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src 'self'${socket} ${MODELOS_DE_MEDIAPIPE}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    // The PDF viewer (José, 21/10) shows the file from memory (`blob:`) in a frame of the page itself,
    // and a YouTube, TikTok, Instagram or Facebook video plays in that site's own player (pending 6).
    `frame-src 'self' blob: ${VIDEO_EMBED_ORIGINS.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function cabecerasDeSeguridad(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Content-Security-Policy', politicaDeContenido(req.headers.host ?? ''));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}
