/**
 * A qué transporte va cada dispositivo (F6).
 *
 * Android usa FCM con un token opaco; la web usa Web Push, cuyo «token» es una
 * suscripción entera —endpoint más dos claves— con su propio protocolo (VAPID).
 * Un mismo usuario puede tener los dos a la vez: el teléfono y la pestaña del
 * navegador son dispositivos distintos del mismo dueño.
 *
 * La DECISIÓN vive acá y el transporte en `pushSender`/`webPushSender`, igual
 * que en F4: así se prueba sin red y el transporte se cambia sin tocarla.
 */

/** Lo que Web Push necesita para cifrarle a UN navegador. */
export type WebSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /**
   * El texto EXACTO que está guardado en la base.
   *
   * Se arrastra porque borrar una suscripción muerta es un `updateOne` por su
   * valor, y re-serializar el objeto no sirve: `JSON.stringify` no garantiza el
   * mismo orden de claves que escribió el navegador, así que el filtro no
   * encontraría nada y el zombi quedaría vivo.
   */
  raw: string;
};

type PushDevice = { platform?: 'android' | 'web'; pushToken?: string | null };

/**
 * Una suscripción guardada como texto, de vuelta a objeto.
 *
 * Devuelve `null` en vez de lanzar: un registro corrupto en la base no puede
 * tumbar el aviso de los demás destinatarios del mismo mensaje.
 */
export function parseWebSubscription(raw: string): WebSubscription | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const { endpoint, keys } = parsed as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== 'string' || !keys || typeof keys !== 'object') return null;

  // HTTPS OBLIGATORIO. El endpoint lo elige el cliente y termina en un `fetch`
  // del server: aceptar cualquier esquema sería firmar un SSRF con destino a
  // elección de quien se suscribe.
  if (!endpoint.startsWith('https://')) return null;

  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== 'string' || !p256dh) return null;
  if (typeof auth !== 'string' || !auth) return null;

  return { endpoint, keys: { p256dh, auth }, raw };
}

export function splitPushTargets(devices: PushDevice[]): {
  fcm: string[];
  web: WebSubscription[];
} {
  const fcm: string[] = [];
  const web: WebSubscription[] = [];

  for (const device of devices) {
    const token = device.pushToken;
    if (!token) continue;

    if (device.platform === 'web') {
      // Una suscripción ilegible se DESCARTA, nunca cae a la lista de FCM: iría
      // como un JSON entero en lugar de un token, FCM lo rechazaría, y el aviso
      // se perdería en silencio justo para ese usuario.
      const subscription = parseWebSubscription(token);
      if (subscription) web.push(subscription);
      continue;
    }
    fcm.push(token);
  }

  return { fcm, web };
}

/**
 * Cuándo una suscripción está muerta para siempre.
 *
 * Misma regla anti-zombi que el outbox: el navegador que se desuscribió, borró
 * los datos del sitio o desinstaló la PWA contesta 404/410 y va a contestar lo
 * mismo siempre. Sin borrarla, cada mensaje futuro paga un request que ya se
 * sabe perdido; con el tiempo son todos.
 */
export function shouldForgetSubscription(status: number): boolean {
  return status === 404 || status === 410;
}
