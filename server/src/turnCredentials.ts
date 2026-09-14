/**
 * Los servidores ICE para una llamada, de **Cloudflare Realtime TURN** (F10).
 *
 * El TURN rebota audio/video cuando los dos teléfonos NO se ven directo (redes
 * distintas). Lo hostea Cloudflare y no la mini: la mini solo expone el 443 por
 * el túnel, y un TURN necesita UDP + puertos de relay públicos, así que un coturn
 * propio no sería alcanzable desde datos móviles.
 *
 * El secreto (`CF_TURN_API_TOKEN`) vive SOLO en el server: se le pide a Cloudflare
 * una credencial CORTA (`ttl`) por request y esa —efímera— es la única que viaja
 * al teléfono. Una fija horneada en el APK sería un relay gratis para cualquiera
 * que abra el archivo.
 */
export type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * STUN de Cloudflare: solo dice «cuál es mi IP», no reenvía tráfico. Es el
 * fallback cuando el TURN no está configurado o Cloudflare no responde — la
 * llamada de misma red igual conecta; la cross-red no, pero es mejor que dejar
 * sin llamar también a quien sí podía.
 */
const STUN_FALLBACK: IceServer = { urls: 'stun:stun.cloudflare.com:3478' };

const TTL_SEGUNDOS = 12 * 3600;

export async function obtenerIceServers(): Promise<IceServer[]> {
  const keyId = process.env.CF_TURN_KEY_ID || '';
  const token = process.env.CF_TURN_API_TOKEN || '';
  if (!keyId || !token) return [STUN_FALLBACK];

  try {
    const respuesta = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SEGUNDOS }),
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!respuesta.ok) return [STUN_FALLBACK];
    const datos = (await respuesta.json()) as { iceServers?: IceServer[] };
    return Array.isArray(datos.iceServers) && datos.iceServers.length > 0
      ? datos.iceServers
      : [STUN_FALLBACK];
  } catch {
    // Falla cerrado a STUN: mejor una llamada que solo anda en misma red que
    // ninguna. Devolver un error dejaría sin llamar también a quien sí podía.
    return [STUN_FALLBACK];
  }
}
