import { PHOTO_SIZING, createSerialRunner, jpegNameOf, photoOutputType, photoSizingLog, shouldShrinkPhoto, shrinkWithLadder, type PhotoOutputType } from '@lilachat/shared';

export type ShrunkBlob = { blob: Blob; name: string; mime: string; width?: number; height?: number };

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };
type Drawn = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };

const OPAQUE = 255;
const HALF = 2;
/** One photo at a time: a 12 MP decode is ~48 MB, and ten at once crashed low-end phones' tabs (agentes, 28/10). */
const oneAtATime = createSerialRunner();

/** The image upright (the browser applies EXIF), never decoded at a size: without the orientation first it could shrink the wrong side. */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // A format the bitmap cannot read (HEIC outside Safari): an <img> may.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        image.src = url;
      });
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Its default smoothing is «low», which jags small print (agentes measured ~12 % more error). */
function smoothCanvas(width: number, height: number): Drawn | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return { canvas, context };
}

/** Halves the image while it is over twice the target: one big jump loses detail where a browser ignores the smoothing. */
function stepDown(decoded: Decoded, width: number, height: number): { source: CanvasImageSource; width: number; height: number } {
  let current = { source: decoded.source, width: decoded.width, height: decoded.height };
  while (current.width > width * HALF && current.height > height * HALF) {
    const half = smoothCanvas(Math.round(current.width / HALF), Math.round(current.height / HALF));
    if (!half) break;
    half.context.drawImage(current.source, 0, 0, half.canvas.width, half.canvas.height);
    current = { source: half.canvas, width: half.canvas.width, height: half.canvas.height };
  }
  return current;
}

/** The long side at most `side`. For a JPEG it paints white first: transparency would turn black. */
function draw(decoded: Decoded, side: number, opaque: boolean): Drawn | null {
  const scale = Math.min(1, side / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const source = stepDown(decoded, width, height);
  const drawn = smoothCanvas(width, height);
  if (!drawn) return null;
  if (opaque) {
    drawn.context.fillStyle = 'white';
    drawn.context.fillRect(0, 0, width, height);
  }
  drawn.context.drawImage(source.source, 0, 0, width, height);
  return drawn;
}

function hasTransparency({ canvas, context }: Drawn): boolean {
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) if (data[index]! < OPAQUE) return true;
  return false;
}

const toBlob = (canvas: HTMLCanvasElement, type: PhotoOutputType, quality: number | null) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality ?? undefined));

/**
 * Portal's standard in the browser (7727ee59; José, 28/10): a photo of 1 MB
 * or more goes up at most 1600 px, from JPEG 0.78 down to 0.50 and then
 * smaller, until it is under 1 MB. A lighter one, a GIF, an SVG, «HD», a
 * browser without canvas or a failure: the original.
 */
export function shrinkPhotoBlob(file: Blob, name: string, options: { hd?: boolean } = {}): Promise<ShrunkBlob> {
  const original = { blob: file, name, mime: file.type };
  if (!shouldShrinkPhoto({ mimeType: file.type, sizeBytes: file.size, name, hd: options.hd }) || typeof createImageBitmap !== 'function') return Promise.resolve(original);
  return oneAtATime(() => shrinkNow(file, name).then((shrunk) => shrunk ?? original));
}

async function shrinkNow(file: Blob, name: string): Promise<ShrunkBlob | null> {
  const decoded = await decode(file).catch(() => null);
  if (!decoded) return null;
  try {
    const longSide = Math.max(decoded.width, decoded.height);
    const probe = file.type === 'image/png' ? draw(decoded, Math.min(longSide, PHOTO_SIZING.maxSide), false) : null;
    const output = photoOutputType({ mimeType: file.type, name }, probe ? hasTransparency(probe) : false);
    let current: { side: number; canvas: HTMLCanvasElement } | null = null;
    const best = await shrinkWithLadder({
      longSide,
      originalBytes: file.size,
      output,
      encode: async (side, quality) => {
        if (current?.side !== side) {
          const drawn = draw(decoded, side, output === 'image/jpeg');
          if (!drawn) return null;
          current = { side, canvas: drawn.canvas };
        }
        const blob = await toBlob(current.canvas, output, quality);
        return blob ? { value: { blob, width: current.canvas.width, height: current.canvas.height }, bytes: blob.size } : null;
      },
    });
    if (!best) return null;
    const { blob, width, height } = best.value;
    console.info(`[fotos] ${photoSizingLog({ bytesBefore: file.size, bytesAfter: best.bytes, before: { width: decoded.width, height: decoded.height }, after: { width, height } })}`);
    return { blob, name: output === 'image/jpeg' ? jpegNameOf(name) : name, mime: output, width, height };
  } catch {
    return null;
  } finally {
    decoded.close();
  }
}
