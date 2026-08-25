import webpush from 'web-push';
import { DeviceModel } from './models.js';
import { shouldForgetSubscription, type WebSubscription } from './pushTargets.js';

/**
 * El transporte de Web Push (F6).
 *
 * Web Push no es «un POST al navegador»: el cuerpo va cifrado con las dos
 * claves de la suscripción y firmado con VAPID, y eso es criptografía que no se
 * escribe a mano. `web-push` es la librería de referencia (MIT, sin costo) y es
 * la que usa todo el ecosistema.
 *
 * Igual que FCM en F4: **un push que no sale nunca tumba el envío**. El mensaje
 * ya está guardado y el destinatario lo va a ver al sincronizar — la
 * notificación es el timbre, no la entrega.
 */

/** Con quién se identifica el server ante el servicio de push del navegador. */
const CONTACTO_VAPID = 'mailto:administracion@constroad.com';

let configurado: boolean | null = null;
let avisoDado = false;

/**
 * Las claves VAPID son un par: la pública la lleva el navegador al suscribirse
 * y la privada firma cada envío. Se generan una vez con
 * `npx web-push generate-vapid-keys` y viven en el `.env`.
 */
export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function asegurarConfig(): boolean {
  if (configurado !== null) return configurado;

  const publica = vapidPublicKey();
  const privada = process.env.VAPID_PRIVATE_KEY || '';
  configurado = Boolean(publica && privada);

  if (configurado) {
    webpush.setVapidDetails(CONTACTO_VAPID, publica, privada);
  } else if (!avisoDado) {
    // Se DICE, no se finge. Es la lección de `pushSender`: un canal que calla
    // se lee como «no pasó nada» en vez de como «no me estoy enterando».
    avisoDado = true;
    console.error(
      '[web-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY sin configurar: la web NO recibe ' +
        'notificaciones. Generarlas con `npx web-push generate-vapid-keys`.'
    );
  }
  return configurado;
}

/** Para los tests: vuelve a mirar el entorno en la próxima llamada. */
export function resetVapidConfig(): void {
  configurado = null;
  avisoDado = false;
}

export type WebPushPayload = {
  title: string;
  body: string;
  data: { chatId: string; seq: number };
};

export async function sendWebPush(
  subscriptions: WebSubscription[],
  payload: WebPushPayload
): Promise<void> {
  if (subscriptions.length === 0 || !asegurarConfig()) return;

  const cuerpo = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, cuerpo, { TTL: 60 * 60 });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode ?? 0;
        // La suscripción muerta se BORRA, no se reintenta para siempre.
        if (shouldForgetSubscription(status)) {
          await DeviceModel.updateOne(
            { pushToken: subscription.raw },
            { $unset: { pushToken: 1 } }
          ).catch(() => undefined);
          return;
        }
        console.error(`[web-push] falló (${status || 'sin status'})`);
      }
    })
  );
}
