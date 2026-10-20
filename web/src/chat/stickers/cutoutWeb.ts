import type { InteractiveSegmenter } from '@mediapipe/tasks-vision';
import { alphaFromConfidence, MEDIAPIPE_PATH, resample, visibleBox } from './mask';

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

/** The subject at the point, without background and cropped to its box; `null` if nothing is left. */
export async function removeBackground(photo: HTMLCanvasElement, point: Point): Promise<HTMLCanvasElement | null> {
  const cutter = await segmenter();
  const confidence = await new Promise<{ values: Float32Array; width: number; height: number } | null>((resolve) => {
    cutter.segment(photo, { keypoint: point }, (result) => {
      const mask = result.confidenceMasks?.[0];
      // The mask only lives inside the callback: copy it before leaving.
      resolve(mask ? { values: new Float32Array(mask.getAsFloat32Array()), width: mask.width, height: mask.height } : null);
    });
  });
  if (!confidence) return null;
  return applyMask(photo, confidence);
}

function applyMask(photo: HTMLCanvasElement, confidence: { values: Float32Array; width: number; height: number }): HTMLCanvasElement | null {
  const context = photo.getContext('2d');
  if (!context) return null;
  const pixels = context.getImageData(0, 0, photo.width, photo.height);
  const alpha = alphaFromConfidence(resample(confidence.values, confidence, { width: photo.width, height: photo.height }));
  for (let index = 0; index < alpha.length; index += 1) pixels.data[index * 4 + 3] = alpha[index]!;
  const box = visibleBox(alpha, photo.width, photo.height);
  if (!box) return null;
  const output = document.createElement('canvas');
  output.width = box.width;
  output.height = box.height;
  output.getContext('2d')?.putImageData(pixels, -box.x, -box.y);
  return output;
}
