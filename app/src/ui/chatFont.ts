import { CHAT_FONT, parseChatFont, type ChatFontChoice } from '@lilachat/shared';
import { createPrefStore } from './prefStore';

const chatFontStore = createPrefStore<ChatFontChoice>('lilachat.pref.chatFont', parseChatFont, 'medium');

/** The chat's font size (backlog 1): every bubble and the bar read it, without a provider. */
export function useChatFont(): { choice: ChatFontChoice; size: number; line: number } {
  const choice = chatFontStore.use();
  return { choice, size: CHAT_FONT[choice].size, line: CHAT_FONT[choice].line };
}

export const setChatFont = chatFontStore.set;
