/**
 * The draft of each chat (José, 25/10): what was typed and not sent comes back
 * when the chat is opened again, like WhatsApp Web and the app
 * (`app/src/chat/borradores.ts`). One `localStorage` key per chat.
 * **Never throws**: without storage the field simply forgets, as it did.
 */
const PREFIX = 'lilachat.draft.';

const keyOf = (chatId: string) => `${PREFIX}${chatId}`;

export function readDraft(chatId: string): string {
  try {
    return localStorage.getItem(keyOf(chatId)) ?? '';
  } catch {
    // Private window or blocked storage: no draft to give back.
    return '';
  }
}

/** Blank text is not a draft: it removes the one that was there. */
export function saveDraft(chatId: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(keyOf(chatId), text);
    else localStorage.removeItem(keyOf(chatId));
  } catch {
    // Full or blocked storage: the draft lives only while the page is open.
  }
}

/** On sign-out: the drafts belonged to who left. */
export function forgetDrafts(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing written that could be removed.
  }
}
