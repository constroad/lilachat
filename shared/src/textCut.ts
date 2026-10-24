const ELLIPSIS = '…';

/** Too long: cut at the last whole word that fits with «…» (no dangling comma); a text without spaces is cut hard. */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  // One character more than fits, to know whether the cut falls right on a space.
  const room = text.slice(0, max - ELLIPSIS.length + 1);
  const lastSpace = room.lastIndexOf(' ');
  const head = lastSpace > 0 ? room.slice(0, lastSpace) : text.slice(0, max - ELLIPSIS.length);
  return `${head.replace(/[\s,;:.\-–—]+$/, '')}${ELLIPSIS}`;
}
