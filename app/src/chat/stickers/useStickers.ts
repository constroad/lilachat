import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSticker, packLibrary, STICKER_PACKS, type LibrarySticker } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { addMediaInFlight, HANDOVER_MS, removeMediaInFlight, stickerAsQueuedFile } from '../gifs/gifsInFlight';
import { isEmojiPanelOpen, subscribeEmojiPanel } from '../emojiPanel';
import { beginInteraction, SEND_FRAME_WINDOW_MS } from '../../diagnostico/frameMonitor';
import { keepFromMessage, keepFromPack, listStickers, removeSticker, sendSticker, setFavorite, stickerFromGif, uploadGifSticker, uploadSticker, type StickerTarget } from './stickersApi';

const RECENTS_KEY = 'lilachat.stickers.recientes';
/**
 * The session library: the panel opens and closes often, no need to ask every
 * time. A store the panel subscribes to: keeping a sticker from a message
 * (outside the panel) shows up in it at once (José, 21/10: a favorite only
 * appeared the second time, because the open panel kept its own copy).
 */
let cachedLibrary: LibrarySticker[] | null = null;
const libraryListeners = new Set<() => void>();
const setCachedLibrary = (list: LibrarySticker[]) => {
  cachedLibrary = list;
  libraryListeners.forEach((listener) => listener());
};
const subscribeLibrary = (listener: () => void) => {
  libraryListeners.add(listener);
  return () => libraryListeners.delete(listener);
};
/** The default packs, with urls on this server (they never change during a session). */
const PACK_STICKERS = packLibrary(BASE_URL);
export const STICKER_PACK_SECTIONS = STICKER_PACKS.map((pack) => ({ id: pack.id, title: pack.title, stickers: PACK_STICKERS.filter((one) => one.id.startsWith(`pack:${pack.id}/`)) }));

const keepInCache = (sticker: LibrarySticker) => {
  if (cachedLibrary) setCachedLibrary([sticker, ...cachedLibrary.filter((one) => one.id !== sticker.id)]);
};

/**
 * From a message in the chat: keep the sticker (and make it a favorite, if
 * asked). Outside the hook so each sticker in the list does not load the
 * library; the panel picks the change up from the session cache.
 */
/** A GIF of the gallery, or one already in a chat, becomes my animated sticker (pending 37). Returns what to tell the person. */
export async function saveGifSticker(jwt: string, source: { uri: string } | { chatId: string; seq: number }): Promise<string> {
  const saved = 'uri' in source ? await uploadGifSticker(jwt, source) : await stickerFromGif(jwt, source.chatId, source.seq);
  if (!saved.ok) return saved.reason;
  keepInCache(saved.data);
  return 'Sticker animado guardado en Mis stickers';
}

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
  const library = useSyncExternalStore(subscribeLibrary, () => cachedLibrary);
  const [recents, setRecents] = useState<string[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const response = await listStickers(jwt);
    if (!response.ok) return setError(response.reason);
    setCachedLibrary(response.data.stickers);
    setError('');
  }, [jwt]);

  useEffect(() => {
    void reload();
    void readRecents().then(setRecents);
  }, [reload]);

  // While the emoji panel is open the grid stays still (02/11): a «Recientes» row appearing on top pushed
  // the stickers down under the finger. The new order shows the next time it opens. Subscribed without a
  // render: closing the panel with a wink redrew the whole sticker grid for nothing (F4).
  const latestRecents = useRef<string[] | null>(null);
  useEffect(
    () =>
      subscribeEmojiPanel(() => {
        if (isEmojiPanelOpen() || !latestRecents.current) return;
        setRecents(latestRecents.current);
        latestRecents.current = null;
      }),
    []
  );
  const markUsed = useCallback(
    (id: string) => {
      const after = addRecentSticker(latestRecents.current ?? recents, id);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(after)).catch(() => setError('No se pudieron guardar los recientes.'));
      if (isEmojiPanelOpen()) latestRecents.current = after;
      else setRecents(after);
    },
    [recents]
  );

  const replace = setCachedLibrary;
  const withSticker = (sticker: LibrarySticker) => [sticker, ...(cachedLibrary ?? []).filter((one) => one.id !== sticker.id)];

  const send = async (chatId: string, sticker: LibrarySticker, target?: StickerTarget) => {
    beginInteraction('enviar-sticker', SEND_FRAME_WINDOW_MS);
    markUsed(sticker.id);
    const clientKey = `st-${sticker.id}-${Date.now().toString(36)}`;
    // In the chat at once (José, 02/11: «aún se siente tosco»): it showed up after the server's round
    // trip. A sticker that goes only to a thread waits there, not in the chat.
    const inChat = target?.hiloDe === undefined || target.enElChat === true;
    if (inChat) addMediaInFlight(chatId, stickerAsQueuedFile(sticker, chatId, clientKey, new Date().toISOString()));
    const response = await sendSticker(jwt, chatId, sticker.id, clientKey, target);
    if (!response.ok) {
      removeMediaInFlight(clientKey);
      setError(response.reason);
      return false;
    }
    setTimeout(() => removeMediaInFlight(clientKey), HANDOVER_MS);
    return true;
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
