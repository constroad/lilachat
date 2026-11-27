import * as FileSystem from 'expo-file-system/legacy';
// SDK 57: saveToLibraryAsync lives in `/legacy` (see guardarYCompartir.ts).
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import type { LibrarySticker } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';

/**
 * «Exportar para WhatsApp» on the APK (José 27/11, design sa-05). WhatsApp takes no sound from other apps; its own
 * «Crear sticker» makes a sound sticker from a gallery video. So the sticker leaves as an MP4 with its sound (made by
 * the server) to the gallery or the share sheet, and as its WebP picture to share. Never throws.
 */
export type ExportOutcome = { ok: true } | { ok: false; reason: string };
type Downloaded = { ok: true; uri: string } | { ok: false; reason: string };

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

/** Where a file of the export is kept for a moment: one name per sticker and kind, so a retry replaces it. */
export function stickerExportFileName(stickerId: string, kind: 'video' | 'picture', mime = 'image/webp'): string {
  const safeId = stickerId.replace(/[^A-Za-z0-9-]/g, '_');
  const extension = kind === 'video' ? 'mp4' : mime === 'image/png' ? 'png' : 'webp';
  return `sticker-lilachat-${safeId}.${extension}`;
}

async function download(url: string, name: string, headers?: Record<string, string>): Promise<Downloaded> {
  try {
    const { status, uri } = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${name}`, headers ? { headers } : undefined);
    if (status < HTTP_OK_MIN || status > HTTP_OK_MAX) return { ok: false, reason: 'No se pudo preparar el archivo. Inténtalo de nuevo.' };
    return { ok: true, uri };
  } catch {
    return { ok: false, reason: 'Sin conexión para preparar el archivo.' };
  }
}

const videoOf = (jwt: string, stickerId: string) =>
  download(`${BASE_URL}/api/stickers/${stickerId}/export.mp4`, stickerExportFileName(stickerId, 'video'), { Authorization: `Bearer ${jwt}` });

/** The video with its sound into the gallery, where WhatsApp's «Crear sticker» finds it. Write-only permission. */
export async function saveStickerVideo(jwt: string, stickerId: string): Promise<ExportOutcome> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return { ok: false, reason: 'Necesitamos permiso para guardar en tu galería.' };
  const video = await videoOf(jwt, stickerId);
  if (!video.ok) return video;
  try {
    await MediaLibrary.saveToLibraryAsync(video.uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'No pudimos guardarlo en la galería.' };
  } finally {
    await FileSystem.deleteAsync(video.uri, { idempotent: true }).catch(() => undefined);
  }
}

/** The share sheet keeps reading the file after this returns: the copy stays in the cache (Android clears it). */
async function share(file: Downloaded, mimeType: string): Promise<ExportOutcome> {
  if (!file.ok) return file;
  if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'Este teléfono no puede compartir archivos.' };
  try {
    await Sharing.shareAsync(file.uri, { mimeType });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'No pudimos compartirlo.' };
  }
}

export const shareStickerVideo = async (jwt: string, stickerId: string): Promise<ExportOutcome> => share(await videoOf(jwt, stickerId), 'video/mp4');

export const shareStickerPicture = async (sticker: Pick<LibrarySticker, 'id' | 'url' | 'mime'>): Promise<ExportOutcome> =>
  share(await download(sticker.url, stickerExportFileName(sticker.id, 'picture', sticker.mime)), sticker.mime);
