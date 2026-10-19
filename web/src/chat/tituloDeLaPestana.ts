import type { ChatSummary } from './types';

/**
 * «(3) Lilachat» en la pestaña y la insignia de la app instalada (W1). Se
 * cuentan CHATS, como WhatsApp Web; silenciados y archivados no llaman la
 * atención.
 */
export const chatsSinLeer = (chats: readonly ChatSummary[]): number =>
  chats.filter((chat) => !chat.muted && !chat.archived && (chat.unread > 0 || chat.markedUnread)).length;

export const tituloDeLaPestana = (pendientes: number): string =>
  pendientes > 0 ? `(${pendientes}) Lilachat` : 'Lilachat';
