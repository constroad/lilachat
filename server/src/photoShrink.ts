import sharp, { type OverlayOptions } from 'sharp';
import { createSerialRunner, jpegNameOf, photoOutputType, photoSizingLog, shouldShrinkPhoto, shrinkWithLadder, type PhotoOutputType, type PhotoSize } from '@lilachat/shared';

export type ShrunkPhoto = { bytes: Buffer; mimeType: PhotoOutputType; fileName: string; log: string };
/** Drawn over the photo at each size: the date and place band of a live selfie. */
export type PhotoOverlay = (size: PhotoSize) => OverlayOptions[];

const PERCENT = 100;
const WHITE = { r: 255, g: 255, b: 255 };
/** One photo at a time: a 12 MP decode is ~48 MB, and the mini serves every app. */
const oneAtATime = createSerialRunner();

/** A PNG with at least one pixel that is not fully opaque. */
async function hasTransparency(bytes: Buffer): Promise<boolean> {
  const meta = await sharp(bytes).metadata();
  if (!meta.hasAlpha) return false;
  return !(await sharp(bytes).stats()).isOpaque;
}

/** The photo upright (EXIF) at one long side, as raw pixels: decoded once per side, encoded once per quality. */
async function uprightAt(bytes: Buffer, side: number, output: PhotoOutputType, overlay?: PhotoOverlay) {
  let image = sharp(bytes).rotate().resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true });
  // JPEG has no alpha: transparency is painted white, never black.
  if (output === 'image/jpeg') image = image.flatten({ background: WHITE });
  const resized = await image.raw().toBuffer({ resolveWithObject: true });
  const size = { width: resized.info.width, height: resized.info.height };
  // A composite can add an alpha channel: the pixels' shape is read again after it.
  const drawn = overlay ? await sharp(resized.data, { raw: resized.info }).composite(overlay(size)).raw().toBuffer({ resolveWithObject: true }) : resized;
  return { bytes: drawn.data, raw: { width: drawn.info.width, height: drawn.info.height, channels: drawn.info.channels }, size };
}

/**
 * Runs Portal's ladder with sharp (lanczos3). `force` re-encodes even a light
 * photo (a stamp must be burned in); otherwise a photo under 1 MB, a GIF or a
 * file sharp cannot read gives null and the original goes as it came.
 */
export async function shrinkPhotoBuffer(file: { bytes: Buffer; mimeType: string; fileName: string }, options: { overlay?: PhotoOverlay; force?: boolean } = {}): Promise<ShrunkPhoto | null> {
  if (!options.force && !shouldShrinkPhoto({ mimeType: file.mimeType, sizeBytes: file.bytes.length, name: file.fileName })) return null;
  return oneAtATime(async () => {
    try {
      const meta = await sharp(file.bytes).rotate().metadata();
      const turned = (meta.orientation ?? 1) >= 5;
      const before = { width: turned ? meta.height! : meta.width!, height: turned ? meta.width! : meta.height! };
      const output = photoOutputType({ mimeType: file.mimeType, name: file.fileName }, file.mimeType === 'image/png' && (await hasTransparency(file.bytes)));
      let current: ({ side: number } & Awaited<ReturnType<typeof uprightAt>>) | null = null;
      const best = await shrinkWithLadder({
        longSide: Math.max(before.width, before.height),
        originalBytes: options.force ? Number.POSITIVE_INFINITY : file.bytes.length,
        output,
        encode: async (side, quality) => {
          if (current?.side !== side) current = { side, ...(await uprightAt(file.bytes, side, output, options.overlay)) };
          const pixels = sharp(current.bytes, { raw: current.raw });
          const encoded = output === 'image/png' ? await pixels.png().toBuffer() : await pixels.jpeg({ quality: Math.round((quality ?? 1) * PERCENT) }).toBuffer();
          return { value: { bytes: encoded, size: current.size }, bytes: encoded.length };
        },
      });
      if (!best) return null;
      const fileName = output === 'image/jpeg' ? jpegNameOf(file.fileName) : file.fileName;
      return { bytes: best.value.bytes, mimeType: output, fileName, log: photoSizingLog({ bytesBefore: file.bytes.length, bytesAfter: best.bytes, before, after: best.value.size }) };
    } catch (error) {
      console.warn('[fotos] no se pudo reducir, va la original:', error instanceof Error ? error.message : error);
      return null;
    }
  });
}
