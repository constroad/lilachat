import type { NextFunction, Request, Response } from 'express';

/**
 * Las cabeceras de seguridad de la web (W0, 19/10).
 *
 * La CSP es la segunda línea contra un XSS: aunque se cuele un script, el
 * navegador no lo ejecuta si no viene del propio origen. Las fotos y audios
 * vienen del almacenamiento (https), las fuentes de Google, y el socket va al
 * mismo host. `style-src 'unsafe-inline'` queda por las fuentes de Google y
 * los estilos que inyectan las librerías; los scripts, nunca.
 */
const HOST_VALIDO = /^[a-z0-9.-]+(:\d+)?$/i;

export function politicaDeContenido(host: string): string {
  const socket = HOST_VALIDO.test(host) ? ` wss://${host} ws://${host}` : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src 'self'${socket}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
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
