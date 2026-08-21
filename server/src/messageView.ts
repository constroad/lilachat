import { toAbsoluteMediaUrl } from './mediaClient.js';
import type { Message } from './chatModels.js';

/**
 * Cómo sale un mensaje HACIA el cliente.
 *
 * La URL de media se **persiste relativa** (`/files/companies/…`) y se resuelve
 * acá, al servir. Es la regla que ya se pagó en Portal: guardar la absoluta deja
 * todos los mensajes viejos con enlaces rotos el día que cambia el hosting —y
 * pasó, con `localhost` persistido en producción.
 *
 * Y se resuelve en el SERVER, no en la app: así el teléfono no necesita saber
 * dónde vive lila, y mover el storage no obliga a publicar un APK nuevo.
 */
export type ClientMessage = Omit<Message, 'media'> & {
  media?: { mediaId: string; thumbUrl?: string; url?: string; mime?: string };
};

export function toClientMessage(message: Message): ClientMessage {
  if (!message.media) return message as ClientMessage;
  return {
    ...message,
    media: {
      ...message.media,
      thumbUrl: message.media.thumbUrl ? toAbsoluteMediaUrl(message.media.thumbUrl) : undefined,
      url: message.media.url ? toAbsoluteMediaUrl(message.media.url) : undefined,
    },
  } as ClientMessage;
}

export const toClientMessages = (messages: Message[]): ClientMessage[] =>
  messages.map(toClientMessage);
