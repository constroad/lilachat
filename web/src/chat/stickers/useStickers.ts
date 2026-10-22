import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { addRecentSticker, packLibrary, STICKER_PACKS, type LibrarySticker } from '@lilachat/shared';
import { keepFromMessage, keepFromPack, listStickers, removeSticker, sendSticker, setFavorite, stickerFromGif, uploadGifSticker, uploadSticker, type StickerTarget } from './stickersApi';

/**
 * «Mis stickers» on the web: ONE copy for the panel and the message menu (a
 * kept sticker shows in the panel at once). It belongs to the signed-in person:
 * switching accounts empties it. Recents live in this browser, like WhatsApp.
 */
type StickerStore = { owner: string; library: LibrarySticker[] | null; recents: string[]; error: string };

let store: StickerStore = { owner: '', library: null, recents: [], error: '' };
const listeners = new Set<() => void>();
let request: Promise<void> | null = null;

/** The default packs, served by this same site. */
const PACK_STICKERS = typeof window === 'undefined' ? [] : packLibrary(window.location.origin);
export const STICKER_PACK_SECTIONS = STICKER_PACKS.map((pack) => ({ id: pack.id, title: pack.title, stickers: PACK_STICKERS.filter((one) => one.id.startsWith(`pack:${pack.id}/`)) }));

const recentsKey = (owner: string) => `lilachat.stickers.recientes.${owner}`;

function update(partial: Partial<StickerStore>) {
  store = { ...store, ...partial };
  listeners.forEach((listener) => listener());
}

function readRecents(owner: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(recentsKey(owner)) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecents(owner: string, recents: string[]) {
  try {
    localStorage.setItem(recentsKey(owner), JSON.stringify(recents));
  } catch {
    // Private mode: recents last as long as the tab.
  }
}

/** Another account in this browser: nothing from the previous one. */
function adopt(owner: string) {
  if (store.owner === owner) return;
  request = null;
  store = { owner, library: null, recents: readRecents(owner), error: '' };
}

async function reload(jwt: string, owner: string) {
  request ??= listStickers(jwt).then((response) => {
    request = null;
    if (store.owner !== owner) return;
    if (response.ok) update({ library: response.data.stickers, error: '' });
    else update({ library: store.library ?? [], error: response.message });
  });
  return request;
}

const withSticker = (sticker: LibrarySticker) => [sticker, ...(store.library ?? []).filter((one) => one.id !== sticker.id)];

export function useStickers(jwt: string, owner: string) {
  adopt(owner);
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => store
  );
  useEffect(() => {
    if (jwt && store.library === null) void reload(jwt, owner);
  }, [jwt, owner]);

  const send = useCallback(async (chatId: string, sticker: LibrarySticker, target?: StickerTarget) => {
    const response = await sendSticker(jwt, chatId, sticker.id, `st-${sticker.id}-${Date.now().toString(36)}`, target);
    if (!response.ok) {
      update({ error: response.message });
      return false;
    }
    const recents = addRecentSticker(store.recents, sticker.id);
    writeRecents(owner, recents);
    update({ recents, error: '' });
    return true;
  }, [jwt, owner]);

  const save = useCallback(async (file: Blob) => {
    const response = await uploadSticker(jwt, file);
    if (response.ok) update({ library: withSticker(response.data.sticker) });
    return response;
  }, [jwt]);

  /** A GIF of the computer, or one already in a chat, becomes my animated sticker (pending 37). Returns what to tell the person. */
  const saveGif = useCallback(async (source: File | { chatId: string; seq: number }): Promise<string> => {
    const response = source instanceof File ? await uploadGifSticker(jwt, source) : await stickerFromGif(jwt, source.chatId, source.seq);
    if (!response.ok) {
      update({ error: response.message });
      return response.message;
    }
    update({ library: withSticker(response.data.sticker), error: '' });
    return 'Sticker animado guardado en Mis stickers';
  }, [jwt]);

  /** A pack sticker becomes a favorite through a library entry; a library one just toggles. */
  const toggleFavorite = useCallback(async (sticker: LibrarySticker) => {
    const response = sticker.id.startsWith('pack:') ? await keepFromPack(jwt, sticker.id, true) : await setFavorite(jwt, sticker.id, !sticker.favorite);
    if (!response.ok) return update({ error: response.message });
    update({ library: withSticker(response.data.sticker), error: '' });
  }, [jwt]);

  const remove = useCallback(async (sticker: LibrarySticker) => {
    const response = await removeSticker(jwt, sticker.id);
    if (!response.ok) return update({ error: response.message });
    update({ library: (store.library ?? []).filter((one) => one.id !== sticker.id), error: '' });
  }, [jwt]);

  /** From a message menu: keep it (and make it a favorite, if asked). Returns what to tell the person. */
  const keepReceived = useCallback(async (chatId: string, seq: number, asFavorite: boolean): Promise<string> => {
    const kept = await keepFromMessage(jwt, chatId, seq);
    if (!kept.ok) return kept.message;
    if (!asFavorite || kept.data.sticker.favorite) {
      update({ library: withSticker(kept.data.sticker) });
      return asFavorite ? 'Ya estaba en favoritos' : 'Guardado en Mis stickers';
    }
    const marked = await setFavorite(jwt, kept.data.sticker.id, true);
    if (!marked.ok) return marked.message;
    update({ library: withSticker(marked.data.sticker) });
    return 'Agregado a favoritos';
  }, [jwt]);

  return { ...current, packs: STICKER_PACK_SECTIONS, reload: () => reload(jwt, owner), send, save, saveGif, toggleFavorite, remove, keepReceived };
}
