/**
 * How a photo is made lighter before it goes up: Portal's standard
 * (`src/common/utils/optimizeBrowserImageFile.ts`, 7727ee59; José, 28/10: the
 * same in Lilachat, everywhere a photo goes up, without losing quality). One rule for the
 * chat, the forms, the selfies, the group and space photos and the agenda.
 * PURE: it decides and runs the ladder; each platform encodes with its own
 * engine (expo-image-manipulator in the app, a canvas in the web, sharp in
 * the server). The photo is captured at its native size, never smaller.
 */
export const PHOTO_SIZING = {
  /** Under this a photo goes as it is. */
  thresholdBytes: 1024 * 1024,
  /** The ladder stops at the first try under this. */
  targetBytes: 1024 * 1024,
  maxSide: 1600,
  startQuality: 0.78,
  minQuality: 0.5,
  qualityStep: 0.08,
  minSide: 1000,
  sideFactor: 0.82,
  maxPasses: 5,
} as const;

export type PhotoOutputType = 'image/jpeg' | 'image/png';
export type PhotoSize = { width: number; height: number };

const STILL_IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$/i;
/** An animation, a vector or an icon would turn into a flat JPEG and stop being what it is. */
const UNTOUCHED_TYPES = new Set(['image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
const UNTOUCHED_NAME = /\.(gif|svg|ico)$/i;
const isPng = (file: { mimeType: string; name?: string }) => file.mimeType === 'image/png' || (!file.mimeType && /\.png$/i.test(file.name ?? ''));

/** An image of 1 MB or more that is not an animation, a vector or an icon; «HD» in the chat sends the original. */
export function shouldShrinkPhoto(file: { mimeType: string; sizeBytes: number; name?: string; hd?: boolean }): boolean {
  if (file.hd || file.sizeBytes < PHOTO_SIZING.thresholdBytes) return false;
  if (UNTOUCHED_TYPES.has(file.mimeType) || UNTOUCHED_NAME.test(file.name ?? '')) return false;
  return file.mimeType ? file.mimeType.startsWith('image/') : STILL_IMAGE_NAME.test(file.name ?? '');
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const PNG_COLOR_TYPE_AT = 25;
/** Gray with alpha (4) and RGBA (6). */
const PNG_ALPHA_TYPES = new Set([4, 6]);
const PNG_PALETTE = 3;
const WEBP_CHUNK_AT = 12;
const WEBP_FLAGS_AT = 20;
const WEBP_ALPHA_FLAG = 0x10;
const asText = (bytes: Uint8Array, from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));

/**
 * From a file's first bytes (4 KB is plenty): a PNG with an alpha channel or a
 * palette with `tRNS`, or a WebP with its alpha flag or lossless, MAY be
 * transparent. Where the pixels cannot be read (the app), «may» keeps it.
 */
export function headerMayHaveAlpha(header: Uint8Array): boolean {
  if (PNG_SIGNATURE.every((byte, index) => header[index] === byte)) {
    const colorType = header[PNG_COLOR_TYPE_AT];
    return colorType !== undefined && (PNG_ALPHA_TYPES.has(colorType) || (colorType === PNG_PALETTE && asText(header, 0, header.length).includes('tRNS')));
  }
  if (asText(header, 0, 4) !== 'RIFF' || asText(header, 8, 4) !== 'WEBP') return false;
  const chunk = asText(header, WEBP_CHUNK_AT, 4);
  return chunk === 'VP8L' || (chunk === 'VP8X' && ((header[WEBP_FLAGS_AT] ?? 0) & WEBP_ALPHA_FLAG) !== 0);
}

/** JPEG, unless the source is a PNG with real transparency: that stays PNG and only changes size. */
export function photoOutputType(file: { mimeType: string; name?: string }, hasTransparency: boolean): PhotoOutputType {
  return isPng(file) && hasTransparency ? 'image/png' : 'image/jpeg';
}

/** The same base name ending in `.jpg`. */
export function jpegNameOf(name: string): string {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${base || 'foto'}.jpg`;
}

/** 0.78, 0.70, 0.62, 0.54, 0.50. */
export function photoQualities(): number[] {
  const qualities: number[] = [];
  for (let quality: number = PHOTO_SIZING.startQuality; quality > PHOTO_SIZING.minQuality; quality = Number((quality - PHOTO_SIZING.qualityStep).toFixed(2))) qualities.push(quality);
  return [...qualities, PHOTO_SIZING.minQuality];
}

/** The long sides to try: at most 1600 (never bigger than the photo), then ×0.82 down to 1000, 5 at most. */
export function photoSides(longSide: number): number[] {
  const sides = [Math.min(Math.round(longSide), PHOTO_SIZING.maxSide)];
  while (sides.length < PHOTO_SIZING.maxPasses && sides[sides.length - 1]! > PHOTO_SIZING.minSide) {
    sides.push(Math.max(PHOTO_SIZING.minSide, Math.round(sides[sides.length - 1]! * PHOTO_SIZING.sideFactor)));
  }
  return sides;
}

/** Width and height with the long side at most `longSide`, in proportion; never bigger than it was. */
export function fitWithin(width: number, height: number, longSide: number): PhotoSize {
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type LadderTry<T> = { value: T; bytes: number };
export type LadderResult<T> = LadderTry<T> & { side: number; quality: number | null };

/**
 * Runs the ladder with the platform's encoder (`quality` is null for a PNG).
 * Each side tries the qualities until one is under 1 MB; if none is, the next
 * smaller side. Returns the last try, or null when it failed or is not lighter
 * than the original: then the original goes up (losing the evidence is worse).
 */
export async function shrinkWithLadder<T>(params: { longSide: number; originalBytes: number; output: PhotoOutputType; encode: (side: number, quality: number | null) => Promise<LadderTry<T> | null> }): Promise<LadderResult<T> | null> {
  const qualities = params.output === 'image/png' ? [null] : photoQualities();
  let last: LadderResult<T> | null = null;
  for (const side of photoSides(params.longSide)) {
    for (const quality of qualities) {
      const attempt = await params.encode(side, quality);
      if (!attempt) return last && last.bytes < params.originalBytes ? last : null;
      last = { ...attempt, side, quality };
      if (attempt.bytes <= PHOTO_SIZING.targetBytes) return last.bytes < params.originalBytes ? last : null;
    }
  }
  return last && last.bytes < params.originalBytes ? last : null;
}

/** Runs jobs one after another; a failure does not stop the ones behind it. */
export function createSerialRunner(): <R>(job: () => Promise<R>) => Promise<R> {
  let tail: Promise<unknown> = Promise.resolve();
  return <R>(job: () => Promise<R>) => {
    const run = tail.then(job, job);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

const KB = 1024;
const sizeLabel = (bytes: number) => (bytes >= KB * KB ? `${(bytes / KB / KB).toFixed(1)} MB` : `${Math.round(bytes / KB)} KB`);
const pixels = (size: PhotoSize) => `${size.width}×${size.height}`;

/** «3.2 MB → 412 KB · 4000×3000 → 1600×1200», for the upload's log. */
export function photoSizingLog(entry: { bytesBefore: number; bytesAfter: number; before?: PhotoSize; after?: PhotoSize }): string {
  const bytes = `${sizeLabel(entry.bytesBefore)} → ${sizeLabel(entry.bytesAfter)}`;
  return entry.before && entry.after ? `${bytes} · ${pixels(entry.before)} → ${pixels(entry.after)}` : bytes;
}
