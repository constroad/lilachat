import { MAXIMO_DE_FOTOS } from './envioDeFotos';
import type { FotoElegida } from './envioDeFotos';

/**
 * The gallery under the clip (José, 20/10: «in WhatsApp and Telegram the clip
 * shows my photos and videos right away»): pure selection logic, so the sheet
 * only draws.
 */
export type GalleryItem = { uri: string; filename: string; width: number; height: number; mediaType: 'photo' | 'video' };

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
};

/** Tap order is send order; a second tap removes; the limit is the photo preview's. */
export function toggleSelection(selected: readonly string[], id: string): readonly string[] {
  if (selected.includes(id)) return selected.filter((one) => one !== id);
  if (selected.length >= MAXIMO_DE_FOTOS) return selected;
  return [...selected, id];
}

export function mediaTypeOf(filename: string, kind: GalleryItem['mediaType']): string {
  const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  const known = MIME_BY_EXTENSION[extension];
  if (known && known.startsWith(kind === 'video' ? 'video/' : 'image/')) return known;
  return kind === 'video' ? 'video/mp4' : 'image/jpeg';
}

/** What the photo preview (`EnviarFotos`) receives, the same as the system picker gives. */
export function toPickedPhoto(item: GalleryItem): FotoElegida {
  return { uri: item.uri, fileName: item.filename, mimeType: mediaTypeOf(item.filename, item.mediaType), width: item.width, height: item.height };
}

/** What the clip can show (José, 20/10): Android 14 «limited access» only lists the photos the person picked. */
export type MediaAccess = 'granted' | 'limited' | 'ask' | 'denied';

export function mediaAccessFrom(permission: { granted: boolean; canAskAgain: boolean; accessPrivileges?: string }): MediaAccess {
  if (permission.granted) return permission.accessPrivileges === 'limited' ? 'limited' : 'granted';
  return permission.canAskAgain ? 'ask' : 'denied';
}

/** Documents picked together (pending 112): as many as photos in one go. */
export const MAX_DOCUMENTS_AT_ONCE = MAXIMO_DE_FOTOS;

/**
 * The documents to send, in the order chosen (pending 112, José 28/10: only
 * one could be attached). A document goes untouched, even an image, like
 * WhatsApp (`hd`).
 */
export function documentsToSend(assets: readonly { uri: string; name: string; mimeType?: string | null; size?: number | null }[] | null | undefined): { uri: string; fileName: string; mimeType: string; sizeBytes: number; hd: true }[] {
  return (assets ?? []).slice(0, MAX_DOCUMENTS_AT_ONCE).map((asset) => ({
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    sizeBytes: asset.size ?? 0,
    hd: true,
  }));
}

/**
 * The gallery loads the phone in pages (pending 113, José 28/10: scrolling
 * never reached the rest of the photos). A photo taken meanwhile shifts the
 * pages by one, so an id already listed is skipped.
 */
export function appendGalleryPage<T extends { id: string }>(shown: readonly T[], page: readonly T[]): readonly T[] {
  const listed = new Set(shown.map((one) => one.id));
  const fresh = page.filter((one) => !listed.has(one.id));
  return fresh.length ? [...shown, ...fresh] : shown;
}
