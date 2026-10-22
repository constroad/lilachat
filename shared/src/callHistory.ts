import { leerValorDeLlamada, textoDeLlamada } from './registroDeLlamada.js';

/**
 * «Llamadas» in the web's rail (pending 38): the history is each chat's call
 * lines (`registroDeLlamada.ts`), newest first, read by the server from the
 * messages of my chats. Pure: the arrow and the label of each row.
 */
export type CallDirection = 'outgoing' | 'incoming' | 'missed' | 'unanswered';

/**
 * One row as `GET /api/calls/history` sends it: `mine` = I called. `title` is
 * the group's name or the other person's, and `phone` theirs: the client
 * prefers its own name for the chat (its phone book) and falls back to these,
 * since a just-linked web may not have its list yet.
 */
export type CallHistoryEntry = { chatId: string; seq: number; at: string; valor: string; mine: boolean; title: string | null; phone: string | null };

export function callDirection(line: { valor: string | undefined; mine: boolean }): CallDirection | null {
  const record = leerValorDeLlamada(line.valor);
  if (!record) return null;
  if (record.segundos === null) return line.mine ? 'unanswered' : 'missed';
  return line.mine ? 'outgoing' : 'incoming';
}

export const callHistoryLabel = (line: { valor: string | undefined; mine: boolean }): string => textoDeLlamada({ valor: line.valor, esMio: line.mine });
