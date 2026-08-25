import crypto from 'node:crypto';

/**
 * Credenciales EFÍMERAS para el TURN (F10).
 *
 * Un TURN reenvía audio y video de verdad, o sea que es ancho de banda que
 * alguien paga. Con una contraseña fija horneada en el APK, cualquiera que abra
 * el archivo tiene un relay gratis para lo que se le ocurra — es el abuso
 * clásico de los TURN mal configurados, y no se nota hasta que llega la factura
 * o el proveedor corta el servicio.
 *
 * Se usa el mecanismo REST estándar de coturn: usuario `<vence>:<userId>` y
 * contraseña `HMAC-SHA1(secreto, usuario)` en base64. El TURN valida sin
 * consultar a nadie, y el SECRETO no sale nunca del server.
 */
const VIGENCIA_SEGUNDOS = 12 * 3600;

/** STUN público de Google: solo dice «cuál es mi IP», no reenvía tráfico. */
const STUN_URL = 'stun:stun.l.google.com:19302';

export type IceServer = { urls: string; username?: string; credential?: string };

export function turnCredential(
  userId: string,
  now = new Date()
): { username: string; credential: string } | null {
  const secreto = process.env.TURN_SECRET || '';
  if (!secreto) return null;

  const vence = Math.floor(now.getTime() / 1000) + VIGENCIA_SEGUNDOS;
  const username = `${vence}:${userId}`;

  return {
    username,
    // SHA1 no es una elección nuestra: es lo que coturn valida en este esquema.
    // No protege un secreto, solo autentica una credencial de doce horas.
    credential: crypto.createHmac('sha1', secreto).update(username).digest('base64'),
  };
}

/**
 * Los servidores que el navegador y el teléfono usan para conectarse.
 *
 * STUN siempre; TURN solo si está configurado. Con STUN solo, dos personas en
 * la misma casa se conectan DIRECTO y no se gasta un byte del servidor — el
 * TURN es el plan B para cuando el NAT no deja pasar.
 */
export function buildIceServers(userId: string): IceServer[] {
  const servers: IceServer[] = [{ urls: STUN_URL }];

  const url = process.env.TURN_URL || '';
  const cred = turnCredential(userId);
  if (url && cred) servers.push({ urls: url, ...cred });

  return servers;
}
