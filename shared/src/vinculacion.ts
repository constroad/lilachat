/**
 * Vincular la web desde el teléfono con un QR (W5, spec §54.4). Lo comparten
 * el server, la web (que dibuja el QR) y la app (que lo lee): el formato del
 * QR no puede escribirse dos veces.
 */

/** Cada cuánto la web cambia el QR. El token impreso vence a los 60 s. */
export const ROTAR_QR_CADA_MS = 20_000;
/** Como WhatsApp: más de cuatro computadoras con tu cuenta ya es sospechoso. */
export const MAXIMO_DE_VINCULADOS = 4;
/** El id de un dispositivo vinculado lo pone el server con este prefijo. */
export const PREFIJO_DE_VINCULADO = 'vinculado-';

/** 32 bytes al azar en base64url = 43 caracteres. */
const TOKEN_EN_LA_RUTA = /^\/v\/([A-Za-z0-9_-]{43})\/?$/;

export const esDispositivoVinculado = (deviceId: string): boolean => deviceId.startsWith(PREFIJO_DE_VINCULADO);

/** Lo que va dentro del QR: una URL, para que la cámara del teléfono diga algo útil. */
export const urlDeVinculacion = (origen: string, token: string): string => `${origen.replace(/\/+$/, '')}/v/${token}`;

/**
 * El token de un QR escaneado, o `null` si no es un QR de Lilachat. Solo
 * http/https y la ruta exacta: el host no se valida acá porque el server solo
 * conoce los tokens que él mismo emitió.
 */
export function tokenDeVinculacion(texto: string): string | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.search || url.hash) return null;
  return TOKEN_EN_LA_RUTA.exec(url.pathname)?.[1] ?? null;
}
