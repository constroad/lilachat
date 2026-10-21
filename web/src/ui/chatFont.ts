import { CHAT_FONT, parseChatFont, type ChatFontChoice } from '@lilachat/shared';

/**
 * The chat's font size on the web (backlog 1; design `f-01-tamano-de-letra`).
 * The choice lives in this browser and becomes two CSS variables on <html>
 * that the bubbles and the bar read. The web stays one pixel under the app
 * (Mediana = 14 px, the bubble as it was).
 */
export const CHAT_FONT_KEY = 'lilachat.letraDelChat';
const WEB_OFFSET = -1;

export function readChatFont(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ChatFontChoice {
  try {
    return parseChatFont(storage?.getItem(CHAT_FONT_KEY));
  } catch {
    return 'medium';
  }
}

export function chatFontPixels(choice: ChatFontChoice): { size: number; line: number } {
  return { size: CHAT_FONT[choice].size + WEB_OFFSET, line: CHAT_FONT[choice].line + WEB_OFFSET };
}

export function applyChatFont(choice: ChatFontChoice): void {
  const { size, line } = chatFontPixels(choice);
  document.documentElement.style.setProperty('--chat-font', `${size}px`);
  document.documentElement.style.setProperty('--chat-line', `${line}px`);
}

export function saveChatFont(choice: ChatFontChoice): void {
  applyChatFont(choice);
  try {
    safeStorage()?.setItem(CHAT_FONT_KEY, choice);
  } catch (error) {
    console.warn('[chatFont] no se pudo guardar:', error instanceof Error ? error.message : error);
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
