/**
 * What I send is always seen (José, 22/10: after sending several photos the
 * list stayed up and he had to tap «bajar»): a new last row that is mine —
 * a photo in the queue, a sticker, a GIF, a voice note — takes the list to
 * the end, wherever it was. The first key seen (opening the chat) does not.
 * `undefined` = no rows yet; `null` = the last row is someone else's.
 */
export function followsMyNewRow(previousKey: string | null | undefined, nextKey: string | null | undefined): boolean {
  return previousKey !== undefined && nextKey != null && nextKey !== previousKey;
}

/** How many messages of others wait after `sinceSeq` (José, 22/10: the «bajar» button carries it, like WhatsApp); notices do not count. */
export function unreadBelow(messages: readonly { seq: number; senderId: string; kind?: string }[], me: string, sinceSeq: number): number {
  return messages.filter((message) => message.seq > sinceSeq && String(message.senderId) !== me && message.kind !== 'system').length;
}

/**
 * The number on the «bajar» button (José, 22/10). Until the person reaches the
 * end once after entering, it is the unread since entering (the chat opened at
 * the first of them); after that, what arrived while reading further up.
 */
export function downButtonCount(state: { away: boolean; reachedEnd: boolean; unreadSinceOpen: number; arrivedWhileAway: number }): number {
  if (!state.away) return 0;
  return state.reachedEnd ? state.arrivedWhileAway : state.unreadSinceOpen;
}
