/**
 * Text comparison without `localeCompare` (José, 30/10: the app closed on
 * opening the Slack mode). Hermes builds a new `Intl.Collator`, with ICU's
 * LocaleMatcher, on EVERY `localeCompare` call; sorting the space list on
 * each render filled the 256 MB heap (OutOfMemoryError in Collator.<init>).
 * One collator per variant, built the first time it is needed. PURE.
 */
let strict: Intl.Collator | null = null;
let loose: Intl.Collator | null = null;

/** Names in Spanish: «ñ» after «n», accents next to their letter. */
export function compareNames(a: string, b: string): number {
  strict ??= new Intl.Collator('es');
  return strict.compare(a, b);
}

/** The same ignoring case and accents («José» = «jose»). */
export function compareNamesLoose(a: string, b: string): number {
  loose ??= new Intl.Collator('es', { sensitivity: 'base' });
  return loose.compare(a, b);
}

/** ISO dates, ids and keys: by code point, no Intl at all. */
export const compareOrdinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
