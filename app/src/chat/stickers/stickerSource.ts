import { clipHasOwnSound, isStickerClipMime, VIDEO_STICKER_MAX_MS } from '@lilachat/shared';
import { initialTrim, type TrimWindow } from './videoStickerTrim';
import type { PickedVideo, SoundChoice } from './videoStickerSound';

/**
 * One «Crear» tile (José 26/11, design sc-01a): the gallery hands back a
 * photo, a video or a GIF, and these decide which editor opens and how it
 * starts. Pure: the picker and the editors only follow them.
 */
export type StickerSourceKind = 'photo' | 'clip';

/** What the gallery hands back, as far as these decisions care. */
export type GalleryAsset = { uri: string; type?: string | null; mimeType?: string | null; fileName?: string | null };

const GIF_MIME = 'image/gif';
const DEFAULT_VIDEO_MIME = 'video/mp4';
const GIF_NAME = /\.gif$/i;

const isGifAsset = (asset: GalleryAsset): boolean => asset.mimeType === GIF_MIME || GIF_NAME.test(asset.fileName ?? '') || GIF_NAME.test(asset.uri);

/** The type a clip goes up with: a GIF, a video (the picker may not know which), or null for a still photo. */
export function clipMimeOf(asset: GalleryAsset): string | null {
  if (isGifAsset(asset)) return GIF_MIME;
  if (asset.mimeType?.startsWith('video/')) return asset.mimeType;
  return asset.type === 'video' ? DEFAULT_VIDEO_MIME : null;
}

/** A video or a GIF → the clip editor (with sound); any other image → the photo editor (cutout). */
export function stickerSourceKind(asset: GalleryAsset): StickerSourceKind {
  return isStickerClipMime(clipMimeOf(asset)) ? 'clip' : 'photo';
}

export const isGifClip = (clip: { mime: string }): boolean => clip.mime === GIF_MIME;

/** expo-video cannot play a GIF: it is taken whole from its start; the server clamps it to the GIF's length. */
export const GIF_STICKER_WINDOW: TrimWindow = { startMs: 0, endMs: VIDEO_STICKER_MAX_MS };

/** The first window of the clip editor: the GIF's, or the video's first 6 s (null until its length is known). */
export function initialTrimOf(clip: { mime: string; durationMs?: number }): TrimWindow | null {
  return isGifClip(clip) ? GIF_STICKER_WINDOW : initialTrim(clip.durationMs ?? 0);
}

/** A video starts with its own sound; a GIF has none, so it starts silent. */
export function initialSoundOf(mime: string): SoundChoice {
  return clipHasOwnSound(mime) ? { kind: 'original' } : { kind: 'none' };
}

/** Why a GIF of a chat cannot open in the editor, or null when it can. A secret chat's never leaves the phone. */
export function chatGifRefusal(url: string): string | null {
  if (!url) return 'No se encontró el GIF.';
  return url.startsWith('file:') ? 'Un GIF de un chat secreto no se puede convertir en sticker.' : null;
}

/** Where a chat's GIF is cached for the editor: one file per message. */
export const chatGifCacheName = (chatId: string, seq: number): string => `sticker-gif-${chatId}-${seq}.gif`;

/** The downloaded GIF as the editor uploads it. */
export const chatGifClip = (uri: string): PickedVideo => ({ uri, name: 'sticker.gif', mime: GIF_MIME });
