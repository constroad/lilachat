/**
 * A number field whose text is not rebuilt from the number (José 27/11: «3.10» became «310» because
 * «3.» was shown back as «3» and the next digits went in without the dot).
 */
export function cleanDecimalText(text: string): string {
  const kept = text.replace(/[^0-9.,]/g, '');
  const separator = kept.search(/[.,]/);
  if (separator < 0) return kept;
  return kept.slice(0, separator + 1) + kept.slice(separator + 1).replace(/[.,]/g, '');
}

export function decimalOf(text: string): number | null {
  const plain = text.trim().replace(',', '.');
  if (plain === '' || plain === '.') return null;
  const value = Number(plain);
  return Number.isFinite(value) ? value : null;
}

/** What the field shows: the typed text while it still means `value`, else `value` itself. */
export const decimalTextFollows = (text: string, value: number | null): string => (decimalOf(text) === value ? text : value === null ? '' : String(value));
