import type { Request } from 'express';

/**
 * El secreto del dispositivo de la WEB, en una cookie (W0, 19/10).
 *
 * Antes la web lo guardaba en `localStorage` junto al JWT: cualquier script
 * inyectado (XSS) se llevaba la sesión para siempre. Ahora:
 * - `HttpOnly`: JavaScript no la ve.
 * - `SameSite=Strict`: otro sitio no puede hacer que el navegador la mande.
 * - `Path=/api/auth`: solo viaja a entrar, renovar y salir — no en cada pedido.
 * - `Secure` cuando el pedido llegó por HTTPS (en local, localhost va sin).
 * - 400 días: el tope de Chrome. Se renueva en cada `/session`.
 * - `temporal` (W5, «Mantener la sesión iniciada» apagado): sin `Max-Age`, se
 *   va al cerrar el navegador.
 *
 * La app NO usa esto: su secreto vive en el llavero del teléfono.
 */
export const NOMBRE_DE_LA_COOKIE = 'lilachat_dispositivo';
const VIDA_EN_SEGUNDOS = 400 * 24 * 60 * 60;
const ATRIBUTOS = 'Path=/api/auth; HttpOnly; SameSite=Strict';

export const pedidoSeguro = (req: Request): boolean => req.secure || req.headers['x-forwarded-proto'] === 'https';

export function cookieDeDispositivo(params: { deviceId: string; deviceSecret: string; segura: boolean; temporal?: boolean }): string {
  const valor = encodeURIComponent(`${params.deviceId}:${params.deviceSecret}`);
  const vida = params.temporal ? '' : `; Max-Age=${VIDA_EN_SEGUNDOS}`;
  return `${NOMBRE_DE_LA_COOKIE}=${valor}; ${ATRIBUTOS}${vida}${params.segura ? '; Secure' : ''}`;
}

export const cookieBorrada = (segura: boolean): string =>
  `${NOMBRE_DE_LA_COOKIE}=; ${ATRIBUTOS}; Max-Age=0${segura ? '; Secure' : ''}`;

/** Lee la cookie de la cabecera `Cookie`. Una rota o ajena es `null`, nunca lanza. */
export function leerCookieDeDispositivo(cabecera: string | undefined): { deviceId: string; deviceSecret: string } | null {
  const par = (cabecera ?? '').split(';').map((uno) => uno.trim()).find((uno) => uno.startsWith(`${NOMBRE_DE_LA_COOKIE}=`));
  if (!par) return null;
  let valor: string;
  try {
    valor = decodeURIComponent(par.slice(NOMBRE_DE_LA_COOKIE.length + 1));
  } catch {
    return null;
  }
  const corte = valor.indexOf(':');
  if (corte <= 0 || corte === valor.length - 1) return null;
  return { deviceId: valor.slice(0, corte), deviceSecret: valor.slice(corte + 1) };
}
