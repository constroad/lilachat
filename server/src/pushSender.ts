/**
 * Notificaciones push (F4).
 *
 * **La notificación es el TIMBRE, no la entrega.** Nunca lleva el mensaje como
 * fuente de verdad: al abrir la app, el cliente sincroniza por cursor y ESO es
 * lo que muestra. Si el push se pierde —y se pierden—, no se pierde nada.
 *
 * Se manda SOLO a quien no tiene socket vivo: empujarle una notificación a
 * alguien que está mirando la conversación es ruido, y es la queja más común
 * contra las apps de mensajería después de «no me notificó».
 *
 * **Estado**: el camino está completo salvo la credencial. Hace falta que José
 * cree el proyecto de Firebase y ponga `FCM_SERVER_KEY` en el `.env`; hasta
 * entonces `buildPushSender` devuelve el emisor que solo registra en el log, y
 * lo DICE al arrancar en vez de fingir que notifica.
 */

import jwt from 'jsonwebtoken';
import { leerCredencialFcm, urlDeEnvio, type CredencialFcm } from './credencialFcm.js';
import { registro } from './registro.js';

export type PushMessage = {
  tokens: string[];
  title: string;
  body: string;
  data: { chatId: string; seq: number };
};

export interface PushSender {
  send(message: PushMessage): Promise<void>;
}

const PUSH_TIMEOUT_MS = 10_000;
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const AMBITO = 'https://www.googleapis.com/auth/firebase.messaging';

/**
 * El token de acceso, cacheado.
 *
 * Google los emite por una hora. Pedir uno por cada notificación sumaría un
 * viaje de ida y vuelta a cada mensaje y, con un grupo activo, nos ganaríamos un
 * límite de tasa de Google por nuestra propia cuenta.
 *
 * Se renueva un minuto ANTES de vencer: un token que expira entre que se lee y
 * que se usa da un 401 imposible de reproducir.
 */
let acceso: { token: string; venceEn: number } | null = null;

async function obtenerAcceso(credencial: CredencialFcm): Promise<string | null> {
  const ahora = Math.floor(Date.now() / 1000);
  if (acceso && acceso.venceEn - 60 > ahora) return acceso.token;

  // JWT firmado con la clave de la cuenta de servicio; Google lo cambia por un
  // token de acceso. `jsonwebtoken` ya es dependencia (lo usan las sesiones), así
  // que no se suma nada al árbol por esto.
  const assertion = jwt.sign(
    { scope: AMBITO },
    credencial.privateKey,
    {
      algorithm: 'RS256',
      issuer: credencial.clientEmail,
      subject: credencial.clientEmail,
      audience: OAUTH_URL,
      expiresIn: '1h',
    }
  );

  try {
    const respuesta = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    } | null;

    if (!respuesta.ok || !cuerpo?.access_token) {
      // Se DICE por qué: un 400 acá suele ser la clave privada con los saltos de
      // línea rotos, y el mensaje de Google lo explica.
      registro.error(
        `[push] Google rechazó la credencial (${respuesta.status}): ${cuerpo?.error_description ?? 'sin detalle'}`
      );
      return null;
    }

    acceso = { token: cuerpo.access_token, venceEn: ahora + (cuerpo.expires_in ?? 3600) };
    return acceso.token;
  } catch (error) {
    registro.error(`[push] no se pudo pedir el token: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Emisor real, contra FCM **HTTP v1**. Un fallo NUNCA propaga: el mensaje ya
 * está guardado y la notificación es el timbre, no la entrega.
 */
function buildFcmSender(credencial: CredencialFcm): PushSender {
  const url = urlDeEnvio(credencial.projectId);

  return {
    async send(message) {
      const token = await obtenerAcceso(credencial);
      if (!token) return;

      await Promise.allSettled(
        message.tokens.map(async (destino) => {
          const respuesta = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: destino,
                // `notification` la muestra Android aunque la app esté muerta;
                // `data` es lo que la app lee para abrir el chat correcto.
                notification: { title: message.title, body: message.body },
                data: {
                  chatId: message.data.chatId,
                  // v1 exige que TODO `data` sea string. Mandar el número tal
                  // cual da un 400 que solo dice «invalid argument».
                  seq: String(message.data.seq),
                },
                android: {
                  // Alta: un mensaje de chat tiene que despertar el teléfono.
                  priority: 'HIGH',
                  notification: { channelId: 'mensajes' },
                },
              },
            }),
            signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
          });

          if (!respuesta.ok) {
            const detalle = await respuesta.text().catch(() => '');
            // Un token muerto (la app se desinstaló) da 404: es normal y no
            // amerita alarma, pero el resto sí hay que verlo.
            if (respuesta.status !== 404) {
              registro.error(`[push] FCM ${respuesta.status}: ${detalle.slice(0, 200)}`);
            }
          }
        })
      );
    },
  };
}

let warnedMissingKey = false;

/** Emisor de reemplazo: deja rastro y NO finge haber notificado. */
function buildLoggingSender(motivo?: string): PushSender {
  return {
    async send(message) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        registro.error(
          `[push] sin credencial de FCM: las notificaciones NO se envían${motivo ? ` (${motivo})` : ''}. ` +
            'Poner `FCM_SERVICE_ACCOUNT` (la cuenta de servicio de Firebase en base64) en el .env.'
        );
      }
      registro.info(`[push] (sin enviar) ${message.title}: ${message.body}`);
    },
  };
}

export function buildPushSender(): PushSender {
  const { credencial, problema } = leerCredencialFcm(process.env.FCM_SERVICE_ACCOUNT);
  return credencial ? buildFcmSender(credencial) : buildLoggingSender(problema);
}

/**
 * El texto de la notificación. Es lo ÚNICO que se ve con la pantalla bloqueada,
 * así que dice quién escribió y qué — no «tienes un mensaje nuevo», que obliga
 * a abrir la app para saber si vale la pena abrirla.
 */
export function buildPushText(params: {
  senderName: string;
  chatName?: string;
  body?: string;
  kind: string;
}): { title: string; body: string } {
  const preview =
    params.body ||
    (params.kind === 'image'
      ? '📷 Foto'
      : params.kind === 'video'
        ? '🎬 Video'
        : params.kind === 'file'
          ? '📎 Archivo'
          : '');
  return {
    // En un grupo importan los dos: de qué grupo y quién habló.
    title: params.chatName ? `${params.chatName} · ${params.senderName}` : params.senderName,
    body: preview,
  };
}
