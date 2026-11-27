import { STICKER_SIZE, stickerSoundField, type LibrarySticker, type StickerSound } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';
import { withMediaType, type TrimWindow } from './videoSticker';

/** «Mis stickers» from the web: the same contract the app uses (`server/src/stickersRoutes.ts`). */
export const listStickers = (jwt: string) => api<{ stickers: LibrarySticker[] }>('/stickers', { jwt });
export const setFavorite = (jwt: string, id: string, favorite: boolean) => api<{ sticker: LibrarySticker }>(`/stickers/${id}`, { jwt, method: 'PATCH', body: { favorite } });
export const removeSticker = (jwt: string, id: string) => api<undefined>(`/stickers/${id}`, { jwt, method: 'DELETE' });
export const keepFromMessage = (jwt: string, chatId: string, seq: number) => api<{ sticker: LibrarySticker }>('/stickers/from-message', { jwt, body: { chatId, seq } });
/** A GIF already in a chat (GIPHY's or someone's) becomes my animated sticker (pending 37, José 22/10). */
export const stickerFromGif = (jwt: string, chatId: string, seq: number) => api<{ sticker: LibrarySticker }>('/stickers/from-gif', { jwt, body: { chatId, seq } });
export const keepFromPack = (jwt: string, stickerId: string, favorite: boolean) => api<{ sticker: LibrarySticker }>('/stickers/from-pack', { jwt, body: { stickerId, favorite } });
/** One of mine or a pack one: the server reuses the file; the `clientKey` avoids a duplicate on retry. */
/** In a thread (20/10): the root, and whether it also goes to the chat. */
export type StickerThread = { hiloDe: number; enElChat: boolean };

/** Where a sticker goes: a thread, and/or as a reply to a message (José, 20/10: «no puedo responder con sticker»). */
export type StickerTarget = Partial<StickerThread> & { replyToSeq?: number };

export const sendSticker = (jwt: string, chatId: string, stickerId: string, clientKey: string, target?: StickerTarget) =>
  api<{ duplicate: boolean }>(`/chats/${chatId}/stickers`, { jwt, body: { stickerId, clientKey, ...target } });

/** Uploads the sticker the editor built and keeps it in «Mis stickers». */
export async function uploadSticker(jwt: string, file: Blob): Promise<ApiResult<{ sticker: LibrarySticker }>> {
  const form = new FormData();
  form.append('width', String(STICKER_SIZE));
  form.append('height', String(STICKER_SIZE));
  form.append('file', new File([file], file.type === 'image/png' ? 'sticker.png' : 'sticker.webp', { type: file.type }));
  return postStickerForm(jwt, '/api/stickers', form);
}

/** A GIF of the computer becomes my animated sticker: the server cuts it to 6 s, 512×512 and 500 KB. */
export function uploadGifSticker(jwt: string, gif: File): Promise<ApiResult<{ sticker: LibrarySticker }>> {
  const form = new FormData();
  form.append('file', gif);
  return postStickerForm(jwt, '/api/stickers/animated', form);
}

const GIF_MIME = 'image/gif';

/** The last part of a URL's path, when it names a .gif file. */
function gifNameOf(url: string): string {
  const last = url.split(/[?#]/)[0]?.split('/').pop() ?? '';
  return /\.gif$/i.test(last) ? last : 'sticker.gif';
}

/**
 * A GIF of the chat as a file, for the clip editor (José 26/11, design sc-01a:
 * «Convertir en sticker animado» lets the person add a sound first).
 */
export async function fetchGifFile(url: string): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, message: 'No se pudo abrir ese GIF. Inténtalo de nuevo.' };
    const bytes = await response.arrayBuffer();
    return { ok: true, file: new File([bytes], gifNameOf(url), { type: GIF_MIME }) };
  } catch (error) {
    console.warn('[stickers] chat GIF could not be fetched:', error instanceof Error ? error.message : error);
    return { ok: false, message: 'No se pudo traer ese GIF. Revisa tu conexión.' };
  }
}

/** «Crear sticker desde un video» (José 26/11): the whole video (or GIF), the part to keep and its sound. */
export type VideoStickerRequest = { video: File; trim: TrimWindow; sound: StickerSound; audio?: Blob | null };

const AUDIO_EXTENSIONS: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

/** A recorded voice is a bare Blob: it goes as a named file with its type (ffmpeg converts it on the server). */
function audioPart(audio: Blob): File {
  if (audio instanceof File) return withMediaType(audio);
  const type = audio.type.split(';')[0] || 'audio/webm';
  return new File([audio], `sticker-sonido.${AUDIO_EXTENSIONS[type] ?? 'webm'}`, { type });
}

/** The multipart form of `POST /api/stickers/from-video`; the fields go before the files. */
export function videoStickerForm(request: VideoStickerRequest): FormData {
  const form = new FormData();
  form.append('startMs', String(Math.round(request.trim.startMs)));
  form.append('endMs', String(Math.round(request.trim.endMs)));
  form.append('sound', stickerSoundField(request.sound));
  form.append('file', withMediaType(request.video));
  if (request.sound.kind === 'file' && request.audio) form.append('audio', audioPart(request.audio));
  return form;
}

/** The server cuts the clip into a 512×512 animated WebP and keeps its sound: answers the sticker with `audioUrl`. */
export const createStickerFromVideo = (jwt: string, request: VideoStickerRequest) => postStickerForm(jwt, '/api/stickers/from-video', videoStickerForm(request));

/** The new sound of a saved sticker (José 27/11): one of ours, a recorded or uploaded file, or none. */
export function setStickerSound(jwt: string, stickerId: string, request: { sound: StickerSound; audio: Blob | null }): Promise<ApiResult<{ sticker: LibrarySticker }>> {
  const form = new FormData();
  form.append('sound', stickerSoundField(request.sound));
  if (request.sound.kind === 'file' && request.audio) form.append('audio', audioPart(request.audio));
  return postStickerForm(jwt, `/api/stickers/${stickerId}/sound`, form);
}

export type FileOutcome = { ok: true; file: File } | { ok: false; message: string };

/** A file the server makes for this session, with its refusal in its own words. */
async function authorizedFile(jwt: string, path: string, name: string, type: string): Promise<FileOutcome> {
  try {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return { ok: false, message: payload.message ?? 'No se pudo preparar el archivo.' };
    }
    return { ok: true, file: new File([await response.blob()], name, { type }) };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}

/** «Exportar para WhatsApp» (design sa-05): the sticker as a short MP4 with its sound, for WhatsApp's «Crear sticker». */
export const stickerVideoFile = (jwt: string, stickerId: string) => authorizedFile(jwt, `/api/stickers/${stickerId}/export.mp4`, 'sticker-lilachat.mp4', 'video/mp4');

/** A GIF of the GIF tab, for the clip editor (design sa-04): through the server, which keeps GIPHY's key. */
export const giphyGifFile = (jwt: string, gifId: string) => authorizedFile(jwt, `/api/gifs/${encodeURIComponent(gifId)}/file`, `giphy-${gifId}.gif`, 'image/gif');

async function postStickerForm(jwt: string, path: string, form: FormData): Promise<ApiResult<{ sticker: LibrarySticker }>> {
  try {
    const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = (await response.json().catch(() => ({}))) as { message?: string; sticker?: LibrarySticker };
    if (!response.ok || !payload.sticker) return { ok: false, status: response.status, message: payload.message ?? 'No se pudo guardar el sticker.' };
    return { ok: true, data: { sticker: payload.sticker } };
  } catch {
    return { ok: false, status: 0, message: 'Sin conexión. Revisa tu internet.' };
  }
}
