/**
 * The emoji panel as ONE scroll with every category, like WhatsApp (José,
 * 02/11: «una sola vista con scroll para ver todas las categorías»). The rows
 * carry their offset, so the list jumps to a category without measuring and
 * the bar knows which one is under the top. PURE.
 */
export type EmojiSection = { key: string; title: string; emojis: readonly string[] };
export type EmojiRow = ({ kind: 'header'; title: string } | { kind: 'emojis'; emojis: readonly string[] }) & { key: string; offset: number; height: number };
export type SectionStart = { key: string; offset: number };

export function emojiLayout(sections: readonly EmojiSection[], size: { columns: number; rowHeight: number; headerHeight: number }): { rows: EmojiRow[]; sections: SectionStart[]; height: number } {
  const rows: EmojiRow[] = [];
  const starts: SectionStart[] = [];
  let offset = 0;
  for (const section of sections) {
    if (!section.emojis.length) continue;
    starts.push({ key: section.key, offset });
    rows.push({ kind: 'header', key: `h-${section.key}`, title: section.title, offset, height: size.headerHeight });
    offset += size.headerHeight;
    for (let start = 0; start < section.emojis.length; start += size.columns) {
      rows.push({ kind: 'emojis', key: `${section.key}-${start}`, emojis: section.emojis.slice(start, start + size.columns), offset, height: size.rowHeight });
      offset += size.rowHeight;
    }
  }
  return { rows, sections: starts, height: offset };
}

/** The category whose header is at or above this scroll offset. */
export function sectionAtOffset(starts: readonly SectionStart[], offset: number): string | null {
  let found: string | null = null;
  for (const start of starts) {
    if (start.offset > offset) break;
    found = start.key;
  }
  return found ?? starts[0]?.key ?? null;
}

/** What was stored as recent (the old keyboard saved objects with `emoji`; ours saves the emoji): newest first, no repeats. */
export function recentEmojis(stored: unknown, limit: number): string[] {
  if (!Array.isArray(stored)) return [];
  const emojis = stored.map((entry: unknown) => (typeof entry === 'string' ? entry : typeof (entry as { emoji?: unknown } | null)?.emoji === 'string' ? (entry as { emoji: string }).emoji : null));
  return [...new Set(emojis.filter((emoji): emoji is string => Boolean(emoji)))].slice(0, limit);
}
