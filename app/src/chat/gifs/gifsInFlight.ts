import type { GifResult, MessageTarget, LibrarySticker } from '@lilachat/shared';
import type { ArchivoEnCola } from '../colaDeArchivosMotor';

/**
 * A GIF shows in the chat the moment it is tapped (José, 22/10: «tarda unos
 * segundos en ser enviado, se siente lento»). The server downloads it from
 * GIPHY and stores it before answering; meanwhile the bubble is GIPHY's
 * preview, «sending», in the same lane as a photo being uploaded. When the
 * real message arrives (same `clientKey`) the pending one gives way.
 * A sticker waits the same way (José, 02/11: «aún se siente tosco»).
 */
type InFlight = { chatId: string; file: ArchivoEnCola };
/** After the server answered, how long the pending bubble stays: the real one arrives by the socket and takes its cell. */
export const HANDOVER_MS = 1500;
let inFlight: InFlight[] = [];
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

/** The pending bubble of a GIF: GIPHY's preview with its shape, as a file of the queue. */
export function gifAsQueuedFile(gif: GifResult, chatId: string, clientKey: string, queuedAt: string, target?: MessageTarget): ArchivoEnCola {
  return { ...(target?.replyToSeq ? { target } : {}), clientKey, chatId, uri: gif.sharpUrl ?? gif.previewUrl, fileName: `giphy-${gif.id}.gif`, mimeType: 'image/gif', sizeBytes: 0, width: gif.width || undefined, height: gif.height || undefined, queuedAt, intentos: 0 };
}

/** The pending sticker: the image the panel already showed (cached), drawn as a sticker. */
export function stickerAsQueuedFile(sticker: LibrarySticker, chatId: string, clientKey: string, queuedAt: string): ArchivoEnCola {
  return { clientKey, chatId, uri: sticker.url, fileName: 'sticker.webp', mimeType: sticker.mime, sizeBytes: 0, width: sticker.width, height: sticker.height, queuedAt, intentos: 0, sticker: true };
}

export function addMediaInFlight(chatId: string, file: ArchivoEnCola): void {
  inFlight = [...inFlight, { chatId, file }];
  announce();
}

export function removeMediaInFlight(clientKey: string): void {
  const next = inFlight.filter((one) => one.file.clientKey !== clientKey);
  if (next.length === inFlight.length) return;
  inFlight = next;
  announce();
}

export const mediaInFlightOf = (chatId: string): ArchivoEnCola[] => inFlight.filter((one) => one.chatId === chatId).map((one) => one.file);

export function subscribeMediaInFlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
