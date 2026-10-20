import type { LibrarySticker } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { subirPorXhr } from '../subidaXhr';

const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

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
export const sendSticker = (jwt: string, chatId: string, stickerId: string, clientKey: string) =>
  call<{ message: unknown; duplicate: boolean }>(`/chats/${chatId}/stickers`, jwt, { body: { stickerId, clientKey } });

/** Uploads the WebP the editor built and keeps it in «Mis stickers». */
export async function uploadSticker(jwt: string, file: { uri: string; width: number; height: number }): Promise<ApiOutcome<LibrarySticker>> {
  const form = new FormData();
  form.append('width', String(file.width));
  form.append('height', String(file.height));
  form.append('file', { uri: file.uri, name: 'sticker.webp', type: 'image/webp' } as unknown as Blob);
  const response = await subirPorXhr({ url: `${BASE_URL}/api/stickers`, token: jwt, form, timeoutMs: UPLOAD_TIMEOUT_MS });
  if (response.tipo === 'fallo') return { ok: false, reason: response.motivo };
  if (response.status < 200 || response.status >= 300) {
    const message = response.payload.message;
    return { ok: false, reason: typeof message === 'string' ? message : 'No se pudo guardar el sticker.' };
  }
  return { ok: true, data: response.payload.sticker as LibrarySticker };
}
