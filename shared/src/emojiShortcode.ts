/**
 * «:hug» in the composer offers the emojis whose name matches (José 30/10, like
 * WhatsApp): English and Spanish names, accents and case ignored. The name
 * table is loaded the first time it is needed, so the web keeps it out of its
 * first download. PURE apart from that load.
 */
export type EmojiName = { emoji: string; words: string[] };
export type Shortcode = { start: number; query: string };

const MIN_QUERY = 2;
const SUGGESTIONS = 8;
/** «:» at the start or after a space, then letters only: «10:30» and links are not shortcodes. */
const SHORTCODE = /(^|\s):([\p{L}\p{N}_+-]{2,})$/u;

export const foldWord = (word: string): string => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function parseEmojiNames(raw: string): EmojiName[] {
  return raw.split('|').flatMap((entry) => {
    const colon = entry.indexOf(':');
    return colon > 0 ? [{ emoji: entry.slice(0, colon), words: entry.slice(colon + 1).split(' ').filter(Boolean) }] : [];
  });
}

let loaded: Promise<EmojiName[]> | null = null;
export function loadEmojiNames(): Promise<EmojiName[]> {
  loaded ??= import('./emojiNamesData.js').then((data) => parseEmojiNames(data.EMOJI_NAMES));
  return loaded;
}

/** The «:word» that ends at the caret, if there is one. */
export function shortcodeAt(text: string, caret: number): Shortcode | null {
  const match = SHORTCODE.exec(text.slice(0, caret));
  if (!match || match[2]!.length < MIN_QUERY) return null;
  return { start: match.index + match[1]!.length, query: match[2]! };
}

const rankOf = (entry: EmojiName, query: string): number => {
  if (entry.words.includes(query)) return 0;
  if (entry.words[0]?.startsWith(query)) return 1;
  return entry.words.some((word) => word.startsWith(query)) ? 2 : -1;
};

/** The best matches, in the table's order within each rank. */
export function searchEmojis(table: readonly EmojiName[], query: string, limit = SUGGESTIONS): string[] {
  const folded = foldWord(query);
  const ranked = table.flatMap((entry, index) => {
    const rank = rankOf(entry, folded);
    return rank < 0 ? [] : [{ emoji: entry.emoji, rank, index }];
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, limit).map((one) => one.emoji);
}

/** «:hug» becomes «🤗 » and the caret goes after the space. */
export function insertShortcodeEmoji(text: string, code: Shortcode, caret: number, emoji: string): { text: string; caret: number } {
  const inserted = `${emoji} `;
  return { text: `${text.slice(0, code.start)}${inserted}${text.slice(caret)}`, caret: code.start + inserted.length };
}
