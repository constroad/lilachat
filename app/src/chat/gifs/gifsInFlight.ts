import type { GifResult } from '@lilachat/shared';
import type { ArchivoEnCola } from '../colaDeArchivosMotor';

/**
 * A GIF shows in the chat the moment it is tapped (José, 22/10: «tarda unos
 * segundos en ser enviado, se siente lento»). The server downloads it from
 * GIPHY and stores it before answering; meanwhile the bubble is GIPHY's
 * preview, «sending», in the same lane as a photo being uploaded. When the
 * real message arrives (same `clientKey`) the pending one gives way.
 */
type InFlight = { chatId: string; file: ArchivoEnCola };
let inFlight: InFlight[] = [];
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

/** The pending bubble of a GIF: GIPHY's preview with its shape, as a file of the queue. */
export function gifAsQueuedFile(gif: GifResult, chatId: string, clientKey: string, queuedAt: string): ArchivoEnCola {
  return { clientKey, chatId, uri: gif.previewUrl, fileName: `giphy-${gif.id}.gif`, mimeType: 'image/gif', sizeBytes: 0, width: gif.width || undefined, height: gif.height || undefined, queuedAt, intentos: 0 };
}

export function addGifInFlight(chatId: string, file: ArchivoEnCola): void {
  inFlight = [...inFlight, { chatId, file }];
  announce();
}

export function removeGifInFlight(clientKey: string): void {
  const next = inFlight.filter((one) => one.file.clientKey !== clientKey);
  if (next.length === inFlight.length) return;
  inFlight = next;
  announce();
}

export const gifsInFlightOf = (chatId: string): ArchivoEnCola[] => inFlight.filter((one) => one.chatId === chatId).map((one) => one.file);

export function subscribeGifsInFlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
