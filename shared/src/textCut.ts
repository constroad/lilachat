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

/** A letter kept as written (Portal 17/11, an email's message): its line breaks stay, three or more become one blank line. */
export function paragraphsOf(text: string, max: number): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
