import { describe, expect, it } from 'vitest';
import { parseWebSubscription, shouldForgetSubscription, splitPushTargets } from './pushTargets.js';

/**
 * Dos transportes, un solo destinatario.
 *
 * Android va por FCM con un token opaco; la web va por Web Push con una
 * suscripción entera —endpoint + dos claves— y su propio protocolo (VAPID). El
 * mismo usuario puede tener las dos cosas a la vez, así que la decisión de a
 * dónde mandar cada aviso es lógica, no transporte: vive acá y se prueba sin
 * red.
 */
const androidDevice = { platform: 'android' as const, pushToken: 'fcm-token-1' };
const webSubscription = JSON.stringify({
  endpoint: 'https://fcm.googleapis.com/wp/abc',
  keys: { p256dh: 'llave-publica', auth: 'secreto' },
});

describe('splitPushTargets', () => {
  it('manda cada dispositivo por su transporte', () => {
    const targets = splitPushTargets([
      androidDevice,
      { platform: 'web', pushToken: webSubscription },
    ]);

    expect(targets.fcm).toEqual(['fcm-token-1']);
    expect(targets.web).toHaveLength(1);
    expect(targets.web[0]?.endpoint).toBe('https://fcm.googleapis.com/wp/abc');
  });

  /**
   * Borrar una suscripción muerta es un filtro por su valor guardado, y
   * `JSON.stringify` no garantiza el orden de claves del navegador: sin el
   * texto original, el filtro no encontraría nada y el zombi seguiría vivo.
   */
  it('conserva el texto EXACTO que está en la base', () => {
    const targets = splitPushTargets([{ platform: 'web', pushToken: webSubscription }]);

    expect(targets.web[0]?.raw).toBe(webSubscription);
  });

  /**
   * Una suscripción web ilegible NO puede colarse en la lista de FCM. Iría con
   * un JSON entero como token: FCM lo rechaza y el aviso se pierde en silencio
   * para ese usuario, que es el modo de falla que estas notificaciones existen
   * para evitar.
   */
  it('descarta una suscripción web ilegible en vez de mandarla a FCM', () => {
    const targets = splitPushTargets([
      { platform: 'web', pushToken: 'esto no es json' },
      androidDevice,
    ]);

    expect(targets.fcm).toEqual(['fcm-token-1']);
    expect(targets.web).toEqual([]);
  });

  /** Un dispositivo sin token todavía no dio permiso: no es un destinatario. */
  it('ignora dispositivos sin token', () => {
    const targets = splitPushTargets([
      { platform: 'android', pushToken: '' },
      { platform: 'web', pushToken: undefined },
    ]);

    expect(targets).toEqual({ fcm: [], web: [] });
  });
});

describe('parseWebSubscription', () => {
  it('exige endpoint y las DOS claves', () => {
    expect(parseWebSubscription(webSubscription)).not.toBeNull();
    expect(
      parseWebSubscription(JSON.stringify({ endpoint: 'https://x', keys: { p256dh: 'a' } }))
    ).toBeNull();
    expect(parseWebSubscription(JSON.stringify({ keys: { p256dh: 'a', auth: 'b' } }))).toBeNull();
  });

  /**
   * El endpoint termina en un `fetch` del server. Un `http://` o un esquema
   * raro lo convertiría en un SSRF con destino elegido por el cliente.
   */
  it('rechaza un endpoint que no sea https', () => {
    expect(
      parseWebSubscription(
        JSON.stringify({ endpoint: 'http://interno/admin', keys: { p256dh: 'a', auth: 'b' } })
      )
    ).toBeNull();
  });
});

describe('shouldForgetSubscription', () => {
  /**
   * Anti-zombi, la misma regla que el outbox (`PERMANENT_REJECTIONS`): el
   * navegador que se desuscribió o desinstaló responde 404/410 PARA SIEMPRE. Si
   * no se borra, cada mensaje futuro paga un request que ya se sabe muerto.
   */
  it('olvida la suscripción que el navegador declara muerta', () => {
    expect(shouldForgetSubscription(404)).toBe(true);
    expect(shouldForgetSubscription(410)).toBe(true);
  });

  /** Un fallo transitorio no borra nada: el aviso siguiente puede llegar. */
  it('conserva la suscripción ante un fallo pasajero', () => {
    expect(shouldForgetSubscription(429)).toBe(false);
    expect(shouldForgetSubscription(500)).toBe(false);
    expect(shouldForgetSubscription(201)).toBe(false);
  });
});
