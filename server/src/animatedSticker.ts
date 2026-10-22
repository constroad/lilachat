/**
 * An animated sticker of my own from a GIF (pending 37, José 21/10). The
 * server turns it into a 512×512 animated WebP with transparent margins, at
 * most 6 seconds and 500 KB, like the pack's. Pure helpers here; `sharp` does
 * the pixels in `animatedStickerFromGif`.
 */
export const MAX_ANIMATED_MS = 6_000;
/** Browsers draw a GIF frame without a delay at about 100 ms: the same here, or a 0 ms GIF would never be cut. */
const DEFAULT_FRAME_MS = 100;
const QUALITY_FROM = 75;
const QUALITY_FLOOR = 30;
const QUALITY_STEP = 15;

/** How many frames fit in `limitMs`. Always at least one. */
export function framesWithin(delays: readonly number[], limitMs: number): number {
  let total = 0;
  for (let index = 0; index < delays.length; index += 1) {
    total += delays[index]! > 0 ? delays[index]! : DEFAULT_FRAME_MS;
    if (total > limitMs) return Math.max(1, index);
  }
  return Math.max(1, delays.length);
}

/** The WebP qualities tried in turn until it weighs 500 KB or less. */
export function qualitySteps(): number[] {
  const steps: number[] = [];
  for (let quality = QUALITY_FROM; quality >= QUALITY_FLOOR; quality -= QUALITY_STEP) steps.push(quality);
  return steps;
}

const MAX_STICKER_BYTES = 500 * 1024;
const STICKER_SIDE = 512;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * A GIF (or an animated WebP) → a 512×512 animated WebP, centered with
 * transparent margins, cut at 6 seconds and tried at lower qualities until it
 * weighs 500 KB or less. `sharp` is loaded here only, when a sticker is made.
 */
export async function gifToAnimatedSticker(gif: Buffer): Promise<Buffer | 'too-heavy' | 'not-an-image'> {
  const { default: sharp } = await import('sharp');
  const metadata = await sharp(gif, { animated: true }).metadata().catch(() => null);
  if (!metadata?.format || !['gif', 'webp'].includes(metadata.format)) return 'not-an-image';
  const pages = framesWithin(metadata.delay ?? [], MAX_ANIMATED_MS);
  for (const quality of qualitySteps()) {
    const webp = await sharp(gif, { animated: true, pages })
      .resize(STICKER_SIDE, STICKER_SIDE, { fit: 'contain', background: TRANSPARENT })
      .webp({ quality, effort: 4, loop: 0 })
      .toBuffer();
    if (webp.length <= MAX_STICKER_BYTES) return webp;
  }
  return 'too-heavy';
}
