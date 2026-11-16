import type { AcuseEnVivo } from '@lilachat/shared';

/**
 * José 16/11: «la notificación llega cuando ya leí el mensaje». A chat read on the web (or another
 * phone) sends this phone a receipt over the socket; while the app is alive, that chat's notices go,
 * as Telegram clears them when the history is read elsewhere. PURE.
 */
export function chatReadByMe(receipt: AcuseEnVivo, me: string): string | null {
  if (receipt.userId !== me || typeof receipt.chatId !== 'string' || !receipt.chatId) return null;
  return typeof receipt.readSeq === 'number' ? receipt.chatId : null;
}

type Presented = { request: { identifier: string; content: { data?: Record<string, unknown> | null } } };

/** The push notices on screen that belong to that chat (the common FCM ones carry its `chatId`). */
export function presentedOfChat(shown: readonly Presented[], chatId: string): string[] {
  return shown.filter((notice) => notice.request.content.data?.chatId === chatId).map((notice) => notice.request.identifier);
}
