import { api } from './api';

/**
 * Web Push en el navegador (F6).
 *
 * El permiso se pide **cuando el usuario lo pide**, nunca al cargar: un prompt
 * de notificaciones en el primer segundo lo rechaza casi todo el mundo, y en
 * Chrome un rechazo es definitivo — no se puede volver a preguntar.
 */
const SW_PATH = '/sw.js';

export type PushState = 'sin-soporte' | 'apagado' | 'encendido' | 'bloqueado';

export function pushState(): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'sin-soporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return Notification.permission === 'granted' ? 'encendido' : 'apagado';
}

/** La clave VAPID viaja en base64url y el navegador la quiere en bytes. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  // Se devuelve el ArrayBuffer y no la vista: `applicationServerKey` lo tipa
  // como BufferSource sobre ArrayBuffer, y una vista genérica no encaja.
  return bytes.buffer;
}

export async function enablePush(jwt: string): Promise<{ ok: boolean; message?: string }> {
  if (pushState() === 'sin-soporte') {
    return { ok: false, message: 'Este navegador no admite notificaciones.' };
  }

  const key = await api<{ key: string }>('/push/key');
  if (!key.ok) return { ok: false, message: 'El servidor no tiene las notificaciones configuradas.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: 'No diste permiso para las notificaciones.' };
  }

  const registration = await navigator.serviceWorker.register(SW_PATH);
  await navigator.serviceWorker.ready;

  // Reusar la suscripción existente en vez de crear otra: dos suscripciones del
  // mismo navegador significan la misma notificación dos veces.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(key.data.key),
    }));

  const saved = await api('/push/subscribe', { body: { subscription }, jwt });
  return saved.ok ? { ok: true } : { ok: false, message: saved.message };
}

export async function disablePush(jwt: string): Promise<void> {
  await api('/push/subscribe', { method: 'DELETE', jwt });
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
}
