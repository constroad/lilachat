import type { VistaPreviaDeEnlace } from '@lilachat/shared';

/** How many link cards the phone remembers (the ones of the chats you open the most). */
export const PREVIEW_CACHE_LIMIT = 200;

export type PreviewEntry = [url: string, preview: VistaPreviaDeEnlace | null];

/** The entries with this url as the newest; the oldest drop past the limit. Pure. */
export function rememberPreview(entries: readonly PreviewEntry[], url: string, preview: VistaPreviaDeEnlace | null, limit = PREVIEW_CACHE_LIMIT): PreviewEntry[] {
  return [...entries.filter(([known]) => known !== url), [url, preview] as PreviewEntry].slice(-limit);
}
