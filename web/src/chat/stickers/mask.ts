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

/** A piece smaller than this share of the biggest one goes away (same rule as the app's `CutoutMask.kt`). */
const KEEP_RATIO = 0.12;

/**
 * Loose small pieces out of the cutout (José, 20/10: a hand cut off the laptop
 * stayed floating next to the person). Pieces are the visible pixels joined by
 * their 4 neighbours; those under `KEEP_RATIO` of the biggest are cleared.
 */
export function dropSmallPieces(alpha: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const labels = new Int32Array(alpha.length);
  const areas: number[] = [];
  const queue = new Int32Array(alpha.length);
  for (let start = 0; start < alpha.length; start += 1) {
    if (alpha[start]! <= MIN_ALPHA || labels[start] !== 0) continue;
    const label = areas.length + 1;
    let head = 0;
    let tail = 0;
    const visit = (next: number) => {
      if (labels[next] !== 0 || alpha[next]! <= MIN_ALPHA) return;
      labels[next] = label;
      queue[tail++] = next;
    };
    labels[start] = label;
    queue[tail++] = start;
    while (head < tail) {
      const pixel = queue[head++]!;
      const x = pixel % width;
      if (x > 0) visit(pixel - 1);
      if (x < width - 1) visit(pixel + 1);
      if (pixel >= width) visit(pixel - width);
      if (pixel < width * (height - 1)) visit(pixel + width);
    }
    areas.push(tail);
  }
  const biggest = Math.max(0, ...areas);
  const kept = new Uint8ClampedArray(alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    const label = labels[index]!;
    if (label !== 0 && areas[label - 1]! >= biggest * KEEP_RATIO) kept[index] = alpha[index]!;
  }
  return kept;
}
