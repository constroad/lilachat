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

export type PushMessage = {
  tokens: string[];
  title: string;
  body: string;
  data: { chatId: string; seq: number };
};

export interface PushSender {
  send(message: PushMessage): Promise<void>;
}

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
const PUSH_TIMEOUT_MS = 10_000;

/** Emisor real. Un fallo NUNCA propaga: el mensaje ya está guardado. */
function buildFcmSender(serverKey: string): PushSender {
  return {
    async send(message) {
      await Promise.allSettled(
        message.tokens.map((token) =>
          fetch(FCM_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `key=${serverKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: token,
              // `notification` la muestra Android aunque la app esté muerta;
              // `data` es lo que la app lee para abrir el chat correcto.
              notification: { title: message.title, body: message.body },
              data: message.data,
            }),
            signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
          })
        )
      );
    },
  };
}

let warnedMissingKey = false;

/** Emisor de reemplazo: deja rastro y NO finge haber notificado. */
function buildLoggingSender(): PushSender {
  return {
    async send(message) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.error(
          '[push] FCM_SERVER_KEY no está configurada: las notificaciones NO se envían. ' +
            'Crear el proyecto de Firebase y agregar la clave al .env.'
        );
      }
      console.log(`[push] (sin enviar) ${message.title}: ${message.body}`);
    },
  };
}

export function buildPushSender(): PushSender {
  const serverKey = process.env.FCM_SERVER_KEY || '';
  return serverKey ? buildFcmSender(serverKey) : buildLoggingSender();
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
