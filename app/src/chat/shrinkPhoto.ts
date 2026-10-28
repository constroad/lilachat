import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext, type ImageRef, type ImageResult } from 'expo-image-manipulator';
import { createSerialRunner, fitWithin, headerMayHaveAlpha, jpegNameOf, photoOutputType, photoSizingLog, shouldShrinkPhoto, shrinkWithLadder } from '@lilachat/shared';

export type PhotoFile = { uri: string; mimeType: string; fileName: string; sizeBytes?: number; width?: number; height?: number };
/** `temporary`: a new file in the cache that the caller moves or deletes. */
export type ShrunkPhotoFile = { uri: string; mimeType: string; fileName: string; sizeBytes: number; width?: number; height?: number; temporary: boolean };

/** Enough to reach a PNG's `tRNS` or a WebP's flags. */
const HEADER_BYTES = 4096;
/** One photo at a time: a 12 MP decode is ~48 MB, and several at once close the app on a low-end phone (agentes, 28/10). */
const oneAtATime = createSerialRunner();

async function sizeOf(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? info.size : 0;
}

async function headerOf(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: HEADER_BYTES });
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** The photo drawn at one long side (native resize), decoded once per side and saved once per quality. */
type Rendered = { side: number; context: ImageManipulatorContext; image: ImageRef };
async function renderAt(uri: string, size: { width: number; height: number } | null, side: number): Promise<Rendered> {
  const context = ImageManipulator.manipulate(uri);
  if (size) context.resize(fitWithin(size.width, size.height, side));
  return { side, context, image: await context.renderAsync() };
}
function release(rendered: Rendered | null): void {
  rendered?.image.release();
  rendered?.context.release();
}

/**
 * Portal's standard in the app (José, 28/10): a photo of 1 MB or more goes up
 * at most 1600 px, from JPEG 0.78 down to 0.50 and then smaller, until it is
 * under 1 MB. A lighter one, a GIF, «HD» or a failure: the original. A source
 * that may be transparent keeps it: a PNG stays PNG, a WebP stays as it is
 * (the app cannot paint it white).
 */
export function shrinkPhotoFile(photo: PhotoFile, options: { hd?: boolean } = {}): Promise<ShrunkPhotoFile> {
  return oneAtATime(() => shrinkNow(photo, options.hd === true));
}

async function shrinkNow(photo: PhotoFile, hd: boolean): Promise<ShrunkPhotoFile> {
  const sizeBytes = photo.sizeBytes || (await sizeOf(photo.uri).catch(() => 0));
  const original: ShrunkPhotoFile = { ...photo, sizeBytes, temporary: false };
  if (!shouldShrinkPhoto({ mimeType: photo.mimeType, sizeBytes, name: photo.fileName, hd })) return original;
  const saved: string[] = [];
  let chosen: string | undefined;
  let current: Rendered | null = null;
  try {
    const mayBeTransparent = headerMayHaveAlpha(await headerOf(photo.uri));
    if (mayBeTransparent && photo.mimeType === 'image/webp') return original;
    const output = photoOutputType({ mimeType: photo.mimeType, name: photo.fileName }, mayBeTransparent);
    // Without its size the photo is drawn once as it is; that draw serves the first side when it is already under 1600.
    const known = photo.width && photo.height ? { width: photo.width, height: photo.height } : null;
    if (!known) current = await renderAt(photo.uri, null, 0);
    const size = known ?? { width: current!.image.width, height: current!.image.height };
    const longSide = Math.max(size.width, size.height);
    if (current) current.side = longSide;
    const best = await shrinkWithLadder<ImageResult>({
      longSide,
      originalBytes: sizeBytes,
      output,
      encode: async (side, quality) => {
        if (current?.side !== side) {
          release(current);
          current = await renderAt(photo.uri, size, side);
        }
        const result = await current.image.saveAsync({ compress: quality ?? 1, format: output === 'image/png' ? SaveFormat.PNG : SaveFormat.JPEG });
        saved.push(result.uri);
        return { value: result, bytes: await sizeOf(result.uri) };
      },
    });
    if (!best) return original;
    chosen = best.value.uri;
    console.log(`[fotos] ${photoSizingLog({ bytesBefore: sizeBytes, bytesAfter: best.bytes, before: size, after: { width: best.value.width, height: best.value.height } })}`);
    return { uri: best.value.uri, mimeType: output, fileName: output === 'image/jpeg' ? jpegNameOf(photo.fileName) : photo.fileName, sizeBytes: best.bytes, width: best.value.width, height: best.value.height, temporary: true };
  } catch (error) {
    console.warn('[fotos] no se pudo reducir, va la original:', error instanceof Error ? error.message : error);
    return original;
  } finally {
    release(current);
    await Promise.all(saved.filter((uri) => uri !== chosen).map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)));
  }
}
