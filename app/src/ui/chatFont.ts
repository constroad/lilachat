import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAT_FONT, parseChatFont, type ChatFontChoice } from '@lilachat/shared';

const STORAGE_KEY = 'lilachat.pref.chatFont';
let current: ChatFontChoice = 'medium';
let loaded = false;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

/** Read once, the first time a bubble asks: until then it is Mediana, as it always was. */
function loadOnce(): void {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      const choice = parseChatFont(stored);
      if (choice === current) return;
      current = choice;
      announce();
    })
    .catch((error: unknown) => console.warn('[chatFont] no se pudo leer:', error instanceof Error ? error.message : error));
}

function subscribe(listener: () => void): () => void {
  loadOnce();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chat's font size (backlog 1): every bubble and the bar read it, without a provider. */
export function useChatFont(): { choice: ChatFontChoice; size: number; line: number } {
  const choice = useSyncExternalStore(subscribe, () => current);
  return { choice, size: CHAT_FONT[choice].size, line: CHAT_FONT[choice].line };
}

export function setChatFont(choice: ChatFontChoice): void {
  current = choice;
  announce();
  AsyncStorage.setItem(STORAGE_KEY, choice).catch((error: unknown) => console.warn('[chatFont] no se pudo guardar:', error instanceof Error ? error.message : error));
}
