import type { InteractiveSegmenter } from '@mediapipe/tasks-vision';
import type { MaskStroke, Rect } from '@lilachat/shared';
import { alphaFromConfidence, dropSmallPieces, MEDIAPIPE_PATH, resample, visibleBox } from './mask';

/**
 * Background removal on the web (José, 20/10: «WhatsApp removes the background…
 * Lilachat must keep it»). MediaPipe Interactive Segmenter cuts the object at a
 * point (the center, or where the person clicks the photo), in the browser: the
 * photo never leaves the computer. The library (and its 10 MB wasm) loads only
 * when the first sticker is created. It needs WebGL2; without it the editor
 * goes on with the whole photo.
 */
const MODEL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
/** A 12 MP photo is not needed for 512 px, and the cutout is faster. */
const MAX_INPUT_SIDE = 1024;

export type Point = { x: number; y: number };

let loading: Promise<InteractiveSegmenter> | null = null;

function segmenter(): Promise<InteractiveSegmenter> {
  loading ??= import('@mediapipe/tasks-vision')
    .then(({ InteractiveSegmenter }) =>
      InteractiveSegmenter.createFromOptions(
        { wasmLoaderPath: `${MEDIAPIPE_PATH}/vision_wasm_internal.js`, wasmBinaryPath: `${MEDIAPIPE_PATH}/vision_wasm_internal.wasm` },
        { baseOptions: { modelAssetPath: MODEL }, outputCategoryMask: false, outputConfidenceMasks: true }
      )
    )
    .catch((error: unknown) => {
      // Let the next try load again (offline, the first time).
      loading = null;
      throw error;
    });
  return loading;
}

/** The picked photo on a canvas, scaled down if huge. */
export async function photoToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const factor = Math.min(1, MAX_INPUT_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * factor));
  canvas.height = Math.max(1, Math.round(bitmap.height * factor));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** The subject at the point as a mask over the whole photo (alpha per pixel); `null` if nothing is left. */
export async function removeBackground(photo: HTMLCanvasElement, point: Point): Promise<Uint8ClampedArray | null> {
  const cutter = await segmenter();
  const confidence = await new Promise<{ values: Float32Array; width: number; height: number } | null>((resolve) => {
    cutter.segment(photo, { keypoint: point }, (result) => {
      const mask = result.confidenceMasks?.[0];
      // The mask only lives inside the callback: copy it before leaving.
      resolve(mask ? { values: new Float32Array(mask.getAsFloat32Array()), width: mask.width, height: mask.height } : null);
    });
  });
  if (!confidence) return null;
  const alpha = dropSmallPieces(alphaFromConfidence(resample(confidence.values, confidence, { width: photo.width, height: photo.height })), photo.width, photo.height);
  return visibleBox(alpha, photo.width, photo.height) ? alpha : null;
}

/**
 * The photo through the mask (or whole, without one) with the erase/restore
 * strokes (photo pixels), cropped to what is visible; `null` if everything was
 * erased. The same as the app's `CutoutMask.refine`.
 */
export function refineWeb(photo: HTMLCanvasElement, alpha: Uint8ClampedArray | null, strokes: MaskStroke[]): { canvas: HTMLCanvasElement; box: Rect } | null {
  const { width, height } = photo;
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const brush = mask.getContext('2d');
  if (!brush) return null;
  const base = brush.createImageData(width, height);
  base.data.fill(255);
  if (alpha) for (let index = 0; index < alpha.length; index += 1) base.data[index * 4 + 3] = alpha[index]!;
  brush.putImageData(base, 0, 0);
  for (const stroke of strokes) drawMaskStroke(brush, stroke);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) return null;
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.drawImage(photo, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const visible = new Uint8ClampedArray(width * height);
  for (let index = 0; index < visible.length; index += 1) visible[index] = pixels[index * 4 + 3]!;
  const box = visibleBox(visible, width, height);
  if (!box) return null;
  const cropped = document.createElement('canvas');
  cropped.width = box.width;
  cropped.height = box.height;
  cropped.getContext('2d')?.drawImage(output, -box.x, -box.y);
  return { canvas: cropped, box };
}

/** Erase clears the mask, restore paints it opaque; a single point is a dot. */
function drawMaskStroke(context: CanvasRenderingContext2D, stroke: MaskStroke) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  context.save();
  context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
  context.fillStyle = 'white';
  context.strokeStyle = 'white';
  context.lineWidth = stroke.radius * 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (rest.length === 0) {
    context.beginPath();
    context.arc(first.x, first.y, stroke.radius, 0, 2 * Math.PI);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
}
