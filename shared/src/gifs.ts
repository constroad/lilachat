/**
 * GIFs (backlog 37, José 21/10: upload a GIF, and the time has come for a
 * GIPHY section). A GIF is sent as an image message that keeps
 * its animation (it is never recompressed: `shouldShrinkPhoto`); GIPHY is
 * searched through the server, so its key never reaches the app or the web,
 * with its content filter at `pg-13` and the «Powered by GIPHY» its license
 * asks for.
 */
export type GifResult = { id: string; title: string; previewUrl: string; width: number; height: number };

/** A GIF heavier than this is not stored: the 200 px rendition is usually far below. */
export const GIF_MAX_BYTES = 4 * 1024 * 1024;
/** The chips under the search, in the design (`g-01-panel-gif-giphy`). */
export const GIF_SUGGESTIONS: readonly string[] = ['Gracias', 'Listo', 'Jajaja', 'Buen trabajo', 'En camino'];

type Rendition = { url?: unknown; webp?: unknown; width?: unknown; height?: unknown; size?: unknown };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const number = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

/** Only GIPHY's own media hosts, over https: the server downloads from nowhere else. */
export function isGiphyMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'giphy.com' || parsed.hostname.endsWith('.giphy.com'));
  } catch {
    return false;
  }
}

/** The panel's results from a GIPHY answer; a result without its images is left out. */
export function gifsFromGiphy(raw: unknown): GifResult[] {
  const data = record(raw).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const images = record(record(item).images);
    const small = record(images.fixed_width_small) as Rendition;
    const regular = record(images.fixed_width) as Rendition;
    const previewUrl = text(small.webp) || text(small.url) || text(regular.url);
    const id = text(record(item).id);
    if (!id || !previewUrl || !isGiphyMediaUrl(previewUrl)) return [];
    return [{ id, title: text(record(item).title), previewUrl, width: number(regular.width) || number(small.width), height: number(regular.height) || number(small.height) }];
  });
}

/** What gets stored when a GIF is sent: the 200 px GIF, from GIPHY, under the size limit. */
export function gifRenditionToSend(raw: unknown): { url: string; width: number; height: number } | null {
  const regular = record(record(record(raw).images).fixed_width) as Rendition;
  const url = text(regular.url);
  if (!url || !isGiphyMediaUrl(url)) return null;
  if (number(regular.size) > GIF_MAX_BYTES) return null;
  return { url, width: number(regular.width), height: number(regular.height) };
}

/** An image that moves (a GIF): the bubble shows the file itself, not its still thumbnail. */
export const isAnimatedImage = (mime: string | undefined): boolean => mime === 'image/gif';
