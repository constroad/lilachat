/**
 * A space's own emojis (pending 19, José 20/10 and 23/10), like Slack's: a
 * short name (`:casco-ok:`) and a small image, PNG, WebP or GIF (animated).
 * They belong to the company space; a reaction keeps only `:name:` and each
 * client draws it from the space's list (taken out, it reads as the name). PURE.
 */
export const CUSTOM_EMOJI_MAX_BYTES = 256 * 1024;
const NAME = /^[a-z0-9_-]{2,32}$/;
const TOKEN = /^:([a-z0-9_-]{2,32}):$/;

export type CustomEmoji = { id: string; name: string; url: string; animated: boolean; createdBy: string; createdAt: string };

/** What a person types («:Casco OK:») as the short name («casco-ok»), or `null`. */
export function customEmojiNameOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/^:|:$/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  return NAME.test(name) ? name : null;
}

export const customEmojiToken = (name: string): string => `:${name}:`;

export function customEmojiNameFromToken(token: string): string | null {
  return TOKEN.exec(token)?.[1] ?? null;
}

/** The image's kind from its first bytes (never the name or the type the phone said), within the size. */
export function customEmojiKindOf(bytes: Uint8Array): { mime: 'image/png' | 'image/gif' | 'image/webp'; animated: boolean } | null {
  if (bytes.length === 0 || bytes.length > CUSTOM_EMOJI_MAX_BYTES) return null;
  const head = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0x89 && head(1, 4) === 'PNG') return { mime: 'image/png', animated: false };
  if (head(0, 4) === 'GIF8') return { mime: 'image/gif', animated: true };
  if (head(0, 4) === 'RIFF' && head(8, 12) === 'WEBP') return { mime: 'image/webp', animated: false };
  return null;
}

export type ReactionGlyph = { kind: 'text'; text: string } | { kind: 'image'; url: string; name: string };

/** How a reaction is drawn: a plain emoji, the space's image, or its name when the space no longer has it. */
export function reactionGlyph(emoji: string, catalog: ReadonlyMap<string, Pick<CustomEmoji, 'url'>> | undefined): ReactionGlyph {
  const name = customEmojiNameFromToken(emoji);
  if (!name) return { kind: 'text', text: emoji };
  const found = catalog?.get(name);
  return found ? { kind: 'image', url: found.url, name } : { kind: 'text', text: emoji };
}
