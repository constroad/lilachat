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
