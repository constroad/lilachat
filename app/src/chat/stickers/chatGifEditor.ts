import { useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { reportarError } from '../../ui/reportarError';
import { chatGifCacheName, chatGifClip, chatGifRefusal } from './stickerSource';
import type { PickedVideo } from './videoStickerSound';

/** The GIF of a chat the sticker editor is open with, and where «Enviar» sends the sticker. */
export type GifStickerAsk = { jwt: string; chatId: string; gif: PickedVideo };

let pending: GifStickerAsk | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

/**
 * «Convertir en sticker animado» on a GIF of a chat (José 26/11): it opens the
 * sound sticker editor with that GIF, so a sound can be added. The GIF is
 * downloaded to the cache first. Null when the editor opened; otherwise what
 * to tell the person. Never throws.
 */
export async function openChatGifInEditor(params: { jwt: string; chatId: string; seq: number; url: string }): Promise<string | null> {
  const refusal = chatGifRefusal(params.url);
  if (refusal) return refusal;
  try {
    const target = `${FileSystem.cacheDirectory}${chatGifCacheName(params.chatId, params.seq)}`;
    const { status, uri } = await FileSystem.downloadAsync(params.url, target);
    if (status < HTTP_OK_MIN || status > HTTP_OK_MAX) return 'No se pudo descargar el GIF.';
    pending = { jwt: params.jwt, chatId: params.chatId, gif: chatGifClip(uri) };
    tell();
    return null;
  } catch (error) {
    reportarError('openChatGifInEditor', error);
    return 'Sin conexión para descargar el GIF.';
  }
}

export function closeGifStickerEditor(): void {
  if (!pending) return;
  pending = null;
  tell();
}

/** What `GifStickerEditorHost` draws: the open GIF, or null. */
export const useGifStickerAsk = (): GifStickerAsk | null => useSyncExternalStore(subscribe, () => pending);

/** The GIF the editor is open with right now; for tests. */
export const pendingGifStickerForTest = (): GifStickerAsk | null => pending;
