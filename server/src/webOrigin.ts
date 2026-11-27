import type { Request } from 'express';
import { pedidoSeguro } from './cookieDeDispositivo.js';

const VALID_HOST = /^[a-z0-9.-]+(:\d+)?$/i;

/**
 * The absolute url of a file the web serves (the sticker pack, the preset
 * sounds), from the host the request came to; null for a forged Host.
 */
export function webFileUrl(req: Request, path: string): string | null {
  const host = req.headers.host ?? '';
  if (!VALID_HOST.test(host)) return null;
  return `${pedidoSeguro(req) ? 'https' : 'http'}://${host}${path}`;
}
