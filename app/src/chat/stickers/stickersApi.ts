import type { LibrarySticker } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { subirPorXhr } from '../subidaXhr';

const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
/** A video of up to 60 MB goes up whole and the server converts it: more room than a photo. */
const VIDEO_UPLOAD_TIMEOUT_MS = 180_000;

export type ApiOutcome<T> = { ok: true; data: T } | { ok: false; reason: string };

async function call<T>(path: string, jwt: string, init: { method?: string; body?: unknown } = {}): Promise<ApiOutcome<T>> {
  try {
    const response = await fetch(`${BASE_URL}/api${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${jwt}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) return { ok: false, reason: typeof payload.message === 'string' ? payload.message : 'No se pudo completar.' };
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, reason: 'Sin conexión. Revisa tu internet.' };
  }
}

/** «Mis stickers» (José, 20/10): the ones I made, the ones I saved and the favorite pack ones. */
export const listStickers = (jwt: string) => call<{ stickers: LibrarySticker[] }>('/stickers', jwt);
export const setFavorite = (jwt: string, id: string, favorite: boolean) => call<{ sticker: LibrarySticker }>(`/stickers/${id}`, jwt, { method: 'PATCH', body: { favorite } });
export const removeSticker = (jwt: string, id: string) => call<Record<string, never>>(`/stickers/${id}`, jwt, { method: 'DELETE' });
export const keepFromMessage = (jwt: string, chatId: string, seq: number) => call<{ sticker: LibrarySticker }>('/stickers/from-message', jwt, { body: { chatId, seq } });
export const keepFromPack = (jwt: string, stickerId: string, favorite: boolean) => call<{ sticker: LibrarySticker }>('/stickers/from-pack', jwt, { body: { stickerId, favorite } });
/** One of mine or a pack one: the server reuses the file; the `clientKey` avoids a duplicate on retry. */
/** In a thread (20/10): the root, and whether it also goes to the chat. */
export type StickerThread = { hiloDe: number; enElChat: boolean };

/** Where a sticker goes: a thread, and/or as a reply to a message (José, 20/10: «no puedo responder con sticker»). */
export type StickerTarget = Partial<StickerThread> & { replyToSeq?: number };

export const sendSticker = (jwt: string, chatId: string, stickerId: string, clientKey: string, target?: StickerTarget) =>
  call<{ message: unknown; duplicate: boolean }>(`/chats/${chatId}/stickers`, jwt, { body: { stickerId, clientKey, ...target } });

/** Uploads the WebP the editor built and keeps it in «Mis stickers». */
export async function uploadSticker(jwt: string, file: { uri: string; width: number; height: number }): Promise<ApiOutcome<LibrarySticker>> {
  const form = new FormData();
  form.append('width', String(file.width));
  form.append('height', String(file.height));
  form.append('file', { uri: file.uri, name: 'sticker.webp', type: 'image/webp' } as unknown as Blob);
  return postStickerForm(jwt, '/api/stickers', form);
}

/** A file as React Native's form sends it: read from disk by the native side, never loaded into JS. */
type FormFile = { uri: string; name: string; mime: string };
const asFormPart = (file: FormFile) => ({ uri: file.uri, name: file.name, type: file.mime }) as unknown as Blob;

export type VideoStickerUpload = { video: FormFile; audio: FormFile | null; fields: [string, string][] };

/**
 * A clip of a gallery video becomes my animated sticker with sound (José 26/11,
 * designs ss-01/ss-02): the server cuts the window, makes the WebP and keeps the
 * sound. `onProgress` follows the bytes; converting comes after them.
 */
export function createStickerFromVideo(jwt: string, upload: VideoStickerUpload, onProgress?: (ratio: number) => void): Promise<ApiOutcome<LibrarySticker>> {
  const form = new FormData();
  upload.fields.forEach(([name, value]) => form.append(name, value));
  form.append('file', asFormPart(upload.video));
  if (upload.audio) form.append('audio', asFormPart(upload.audio));
  return postStickerForm(jwt, '/api/stickers/from-video', form, { timeoutMs: VIDEO_UPLOAD_TIMEOUT_MS, onProgress });
}

/** A new sound for a saved sticker (José 27/11): `sound` and, for a voice or an audio of the phone, the file. */
export type SavedSoundUpload = { audio: FormFile | null; fields: [string, string][] };

export function setStickerSound(jwt: string, stickerId: string, upload: SavedSoundUpload): Promise<ApiOutcome<LibrarySticker>> {
  const form = new FormData();
  upload.fields.forEach(([name, value]) => form.append(name, value));
  if (upload.audio) form.append('audio', asFormPart(upload.audio));
  return postStickerForm(jwt, `/api/stickers/${stickerId}/sound`, form);
}

async function postStickerForm(jwt: string, path: string, form: FormData, options: { timeoutMs?: number; onProgress?: (ratio: number) => void } = {}): Promise<ApiOutcome<LibrarySticker>> {
  const response = await subirPorXhr({ url: `${BASE_URL}${path}`, token: jwt, form, timeoutMs: options.timeoutMs ?? UPLOAD_TIMEOUT_MS, onProgress: options.onProgress });
  if (response.tipo === 'fallo') return { ok: false, reason: response.motivo };
  if (response.status < 200 || response.status >= 300) {
    const message = response.payload.message;
    return { ok: false, reason: typeof message === 'string' ? message : 'No se pudo guardar el sticker.' };
  }
  return { ok: true, data: response.payload.sticker as LibrarySticker };
}
