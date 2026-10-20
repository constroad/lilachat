import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSticker, packLibrary, STICKER_PACKS, type LibrarySticker } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { keepFromMessage, keepFromPack, listStickers, removeSticker, sendSticker, setFavorite, uploadSticker } from './stickersApi';

const RECENTS_KEY = 'lilachat.stickers.recientes';
/** The session library: the panel opens and closes often, no need to ask every time. */
let cachedLibrary: LibrarySticker[] | null = null;
/** The default packs, with urls on this server (they never change during a session). */
const PACK_STICKERS = packLibrary(BASE_URL);
export const STICKER_PACK_SECTIONS = STICKER_PACKS.map((pack) => ({ id: pack.id, title: pack.title, stickers: PACK_STICKERS.filter((one) => one.id.startsWith(`pack:${pack.id}/`)) }));

const keepInCache = (sticker: LibrarySticker) => {
  if (cachedLibrary) cachedLibrary = [sticker, ...cachedLibrary.filter((one) => one.id !== sticker.id)];
};

/**
 * From a message in the chat: keep the sticker (and make it a favorite, if
 * asked). Outside the hook so each sticker in the list does not load the
 * library; the panel picks the change up from the session cache.
 */
export async function keepReceivedSticker(jwt: string, chatId: string, seq: number, asFavorite: boolean): Promise<string> {
  const kept = await keepFromMessage(jwt, chatId, seq);
  if (!kept.ok) return kept.reason;
  if (!asFavorite || kept.data.sticker.favorite) {
    keepInCache(kept.data.sticker);
    return asFavorite ? 'Ya estaba en favoritos' : 'Guardado en Mis stickers';
  }
  const marked = await setFavorite(jwt, kept.data.sticker.id, true);
  if (!marked.ok) return marked.reason;
  keepInCache(marked.data.sticker);
  return 'Agregado a favoritos';
}

async function readRecents(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENTS_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * «Mis stickers», the default pack and the recents (José, 20/10). Recents live
 * on the device, like WhatsApp; the library lives on the server (app and web see it).
 */
export function useStickers(jwt: string) {
  const [library, setLibrary] = useState<LibrarySticker[] | null>(cachedLibrary);
  const [recents, setRecents] = useState<string[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const response = await listStickers(jwt);
    if (!response.ok) return setError(response.reason);
    cachedLibrary = response.data.stickers;
    setLibrary(cachedLibrary);
    setError('');
  }, [jwt]);

  useEffect(() => {
    void reload();
    void readRecents().then(setRecents);
  }, [reload]);

  const markUsed = useCallback((id: string) => {
    setRecents((before) => {
      const after = addRecentSticker(before, id);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(after)).catch(() => setError('No se pudieron guardar los recientes.'));
      return after;
    });
  }, []);

  const replace = (list: LibrarySticker[]) => {
    cachedLibrary = list;
    setLibrary(list);
  };
  const withSticker = (sticker: LibrarySticker) => [sticker, ...(cachedLibrary ?? []).filter((one) => one.id !== sticker.id)];

  const send = async (chatId: string, sticker: LibrarySticker) => {
    markUsed(sticker.id);
    const response = await sendSticker(jwt, chatId, sticker.id, `st-${sticker.id}-${Date.now().toString(36)}`);
    if (!response.ok) setError(response.reason);
    return response.ok;
  };

  /** What the editor built: uploaded to «Mis stickers» (and sent, if asked, by the caller). */
  const save = async (file: { uri: string; width: number; height: number }) => {
    const uploaded = await uploadSticker(jwt, file);
    if (uploaded.ok) replace(withSticker(uploaded.data));
    return uploaded;
  };

  /** A pack sticker becomes a favorite through a library entry; a library one just toggles. */
  const toggleFavorite = async (sticker: LibrarySticker) => {
    const response = sticker.id.startsWith('pack:') ? await keepFromPack(jwt, sticker.id, true) : await setFavorite(jwt, sticker.id, !sticker.favorite);
    if (!response.ok) return setError(response.reason);
    replace(withSticker(response.data.sticker));
  };

  const remove = async (sticker: LibrarySticker) => {
    const response = await removeSticker(jwt, sticker.id);
    if (!response.ok) return setError(response.reason);
    replace((cachedLibrary ?? []).filter((one) => one.id !== sticker.id));
  };

  return { library, recents, packs: STICKER_PACK_SECTIONS, error, reload, send, save, toggleFavorite, remove };
}

export type StickersState = ReturnType<typeof useStickers>;
