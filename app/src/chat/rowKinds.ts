import { tamanoDeBurbuja } from '@lilachat/shared';
import type { ChatMessage, PendingMessage } from './useChat';

/** A row of the conversation: confirmed by the server, or still on its way. */
export type Row = ChatMessage | PendingMessage;

export const isPending = (row: Row): row is PendingMessage => 'pending' in row && row.pending === true;

/** A file and not something to look at: photos and videos show; a PDF, an Excel or a zip go as a card. */
export const isFileMime = (mime?: string): boolean => {
  const type = mime ?? '';
  return type !== '' && !type.startsWith('image/') && !type.startsWith('video/');
};

/** A voice note: it plays right here. */
export const isVoiceMime = (mime?: string): boolean => (mime ?? '').startsWith('audio/');

/** A photo or video with its real shape (FL9); without dimensions, the square. */
export const photoStyle = (media: { width?: number; height?: number }) => {
  const { ancho, alto } = tamanoDeBurbuja(media);
  return { width: ancho, height: alto };
};

/** What the flat row draws: every message but the lines of the chat itself (notices, winks, nudges), which keep their own. */
export function drawsAsFlatRow(row: Row): boolean {
  if (isPending(row)) return true;
  return row.kind !== 'system' && !drawsAsFunLine(row);
}

/**
 * A nudge or a wink draws as its own line, and a poll or event as its card,
 * only while it exists: deleted for everyone it reads as a deleted message,
 * like any other (22/10: QA Ana's deleted winks kept their cards).
 */
export const drawsAsFunLine = (row: Row): boolean => !isPending(row) && !row.deletedAt && (row.kind === 'zumbido' || row.kind === 'guino');

export const drawsAsCard = (row: Row): boolean => !isPending(row) && !row.deletedAt && Boolean(row.ref);

/** A bot's card is a block of its own: it keeps its header and groups with no neighbour (José, 24/10). */
export const hasBotCard = (row: Row): boolean => !isPending(row) && !row.deletedAt && Boolean(row.card);
