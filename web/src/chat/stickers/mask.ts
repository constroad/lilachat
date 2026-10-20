/**
 * The pure part of the web cutout: from MediaPipe's per-pixel confidence to
 * the sticker alpha, and the smallest box around the subject.
 */

/** The installed `@mediapipe/tasks-vision`; `copy-mediapipe` leaves the wasm on this path. */
export const MEDIAPIPE_VERSION = '0.10.21';
export const MEDIAPIPE_PATH = `/mediapipe/${MEDIAPIPE_VERSION}`;

/** Below this it is background; above the ramp, subject; in between, the soft edge. */
const BACKGROUND_CONFIDENCE = 0.3;
const EDGE_RAMP = 0.4;
const OPAQUE = 255;
/** Almost transparent does not count for the box (same threshold as the app). */
const MIN_ALPHA = 12;

export type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export function alphaFromConfidence(confidence: Float32Array): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(confidence.length);
  for (let index = 0; index < confidence.length; index += 1) {
    const ratio = (confidence[index]! - BACKGROUND_CONFIDENCE) / EDGE_RAMP;
    alpha[index] = Math.round(Math.min(1, Math.max(0, ratio)) * OPAQUE);
  }
  return alpha;
}

/** The smallest box with something visible; `null` if the cutout came out empty. */
export function visibleBox(alpha: Uint8ClampedArray, width: number, height: number): Box | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x]! <= MIN_ALPHA) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = y;
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** The mask taken to the photo size (nearest neighbour); if it already matches, the same one. */
export function resample(values: Float32Array, from: Size, to: Size): Float32Array {
  if (from.width === to.width && from.height === to.height) return values;
  const output = new Float32Array(to.width * to.height);
  for (let y = 0; y < to.height; y += 1) {
    const row = Math.min(from.height - 1, Math.floor((y * from.height) / to.height)) * from.width;
    for (let x = 0; x < to.width; x += 1) {
      output[y * to.width + x] = values[row + Math.min(from.width - 1, Math.floor((x * from.width) / to.width))]!;
    }
  }
  return output;
}
