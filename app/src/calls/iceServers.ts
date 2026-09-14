/**
 * Los servidores ICE para la llamada. Motor PURO (sin `react-native-webrtc`).
 *
 * STUN descubre la IP pública de cada teléfono; alcanza cuando los dos están en
 * redes que dejan pasar el tráfico directo (misma wifi, o NAT amable). Cuando NO
 * —el caso de dos celulares con datos móviles— hace falta un **TURN** que
 * reboten el audio; esas credenciales son EFÍMERAS y las firma el server
 * (`turnCredentials.ts`), nunca van fijas en el APK. Hasta que coturn esté
 * arriba, `turn` viene `null` y se anda solo con STUN (hito 1: misma red).
 */
import { BASE_URL } from '../api/client';

export type CredencialesTurn = {
  urls: string[];
  username: string;
  credential: string;
} | null;

export type ServidorIce = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const STUN_PUBLICO: ServidorIce = { urls: 'stun:stun.l.google.com:19302' };

export function construirServidoresIce(turn: CredencialesTurn): ServidorIce[] {
  if (!turn || turn.urls.length === 0) return [STUN_PUBLICO];
  return [
    STUN_PUBLICO,
    { urls: turn.urls, username: turn.username, credential: turn.credential },
  ];
}

/**
 * Los servidores ICE de VERDAD, pedidos al server (`GET /api/calls/ice`), que a su
 * vez los pide a Cloudflare TURN. Incluyen el relay para llamadas entre redes
 * distintas — sin esto solo andan en la misma wifi.
 *
 * **Falla cerrado a STUN**: si el server no responde, se devuelve STUN solo (la
 * llamada de misma red igual conecta) en vez de romper el intento.
 */
export async function obtenerIceServers(jwt: string): Promise<ServidorIce[]> {
  try {
    const respuesta = await fetch(`${BASE_URL}/api/calls/ice`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!respuesta.ok) return construirServidoresIce(null);
    const datos = (await respuesta.json()) as { iceServers?: ServidorIce[] };
    return Array.isArray(datos.iceServers) && datos.iceServers.length > 0
      ? datos.iceServers
      : construirServidoresIce(null);
  } catch {
    return construirServidoresIce(null);
  }
}
