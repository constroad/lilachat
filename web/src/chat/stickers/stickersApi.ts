import { STICKER_SIZE, type LibrarySticker } from '@lilachat/shared';
import { api, type ApiResult } from '../../api';

/** «Mis stickers» from the web: the same contract the app uses (`server/src/stickersRoutes.ts`). */
export const listStickers = (jwt: string) => api<{ stickers: LibrarySticker[] }>('/stickers', { jwt });
export const setFavorite = (jwt: string, id: string, favorite: boolean) => api<{ sticker: LibrarySticker }>(`/stickers/${id}`, { jwt, method: 'PATCH', body: { favorite } });
export const removeSticker = (jwt: string, id: string) => api<undefined>(`/stickers/${id}`, { jwt, method: 'DELETE' });
export const keepFromMessage = (jwt: string, chatId: string, seq: number) => api<{ sticker: LibrarySticker }>('/stickers/from-message', { jwt, body: { chatId, seq } });
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
  try {
    const response = await fetch('/api/stickers', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = (await response.json().catch(() => ({}))) as { message?: string; sticker?: LibrarySticker };
    if (!response.ok || !payload.sticker) return { ok: false, status: response.status, message: payload.message ?? 'No se pudo guardar el sticker.' };
    return { ok: true, data: { sticker: payload.sticker } };
  } catch {
    return { ok: false, status: 0, message: 'Sin conexión. Revisa tu internet.' };
  }
}
