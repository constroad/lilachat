import type { LinkCard } from '@lilachat/shared';
import type { ServerMessage } from './socketClient';

/** What `msg.edited` brings: the new text and, from a bot, its card, album, place or the visit it points to. */
export type MessageEdit = { body: string; editedAt?: string; card?: ServerMessage['card']; files?: ServerMessage['files']; location?: ServerMessage['location']; clientRef?: ServerMessage['clientRef'] };
/** What `msg.link` brings (José 18/11): a notes chat's link card, read, sorted or moved. The text does not change. */
export type LinkChange = { link: LinkCard };

/** The message after an edit: what the edit brings replaces, what it does not bring stays. */
export function editedMessageOf<M extends Partial<ServerMessage>>(message: M, change: MessageEdit | LinkChange): M {
  if (!('body' in change)) return { ...message, link: change.link };
  const { body, editedAt, card, files, location, clientRef } = change;
  return { ...message, body, ...(editedAt ? { editedAt } : {}), ...(card ? { card } : {}), ...(files ? { files } : {}), ...(location ? { location } : {}), ...(clientRef ? { clientRef } : {}) };
}
