/**
 * Cropping a photo before sending it, like WhatsApp (José 01/11: «no hay forma
 * de recortar la imagen»). Pure: the frame lives in screen points over the
 * photo as shown; what gets cut travels as a fraction of the photo, so the
 * preview and the full-size file never have to agree on pixels.
 */
export type Rect = { x: number; y: number; width: number; height: number };
export type Handle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move';
export type CropLimits = { minSize: number; aspect: number | null };
export type Rotation = 0 | 90 | 180 | 270;
export type PixelCrop = { originX: number; originY: number; width: number; height: number };

/** Below this a fraction is the edge of the photo: a finger never lands on 0 exactly. */
const WHOLE_EPSILON = 0.002;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The photo inside the box without stretching it, centered (`contentFit="contain"`). */
export function fitContain(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number): Rect {
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = Math.round(sourceWidth * scale * 100) / 100;
  const height = Math.round(sourceHeight * scale * 100) / 100;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

/** What the finger grabbed: a corner before its edges, the inside to move, `null` far outside. */
export function handleAt(crop: Rect, pointX: number, pointY: number, reach: number): Handle | null {
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  if (pointX < crop.x - reach || pointX > right + reach || pointY < crop.y - reach || pointY > bottom + reach) return null;
  const nearLeft = Math.abs(pointX - crop.x) <= reach;
  const nearRight = !nearLeft && Math.abs(pointX - right) <= reach;
  const nearTop = Math.abs(pointY - crop.y) <= reach;
  const nearBottom = !nearTop && Math.abs(pointY - bottom) <= reach;
  const vertical = nearTop ? 't' : nearBottom ? 'b' : '';
  const horizontal = nearLeft ? 'l' : nearRight ? 'r' : '';
  if (vertical && horizontal) return `${vertical}${horizontal}` as Handle;
  return (vertical || horizontal || 'move') as Handle;
}

/** The frame after a drag that started at `start`, always inside `bounds` and never smaller than `minSize`. */
export function dragCrop(start: Rect, handle: Handle, dx: number, dy: number, bounds: Rect, limits: CropLimits): Rect {
  if (handle === 'move') return moveCrop(start, dx, dy, bounds);
  if (limits.aspect !== null) return handle.length === 2 ? resizeLocked(start, handle, dx, dy, bounds, limits.minSize, limits.aspect) : start;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes('l')) left = clamp(left + dx, bounds.x, right - limits.minSize);
  if (handle.includes('r')) right = clamp(right + dx, left + limits.minSize, bounds.x + bounds.width);
  if (handle.includes('t')) top = clamp(top + dy, bounds.y, bottom - limits.minSize);
  if (handle.includes('b')) bottom = clamp(bottom + dy, top + limits.minSize, bounds.y + bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function moveCrop(start: Rect, dx: number, dy: number, bounds: Rect): Rect {
  return {
    ...start,
    x: clamp(start.x + dx, bounds.x, bounds.x + bounds.width - start.width),
    y: clamp(start.y + dy, bounds.y, bounds.y + bounds.height - start.height),
  };
}

/** A corner with a fixed ratio: the opposite corner stays, the axis the finger moved most decides the size. */
function resizeLocked(start: Rect, handle: Handle, dx: number, dy: number, bounds: Rect, minSize: number, aspect: number): Rect {
  const growsRight = handle.includes('r');
  const growsDown = handle.includes('b');
  const anchorX = growsRight ? start.x : start.x + start.width;
  const anchorY = growsDown ? start.y : start.y + start.height;
  const widthChange = growsRight ? dx : -dx;
  const heightChange = growsDown ? dy : -dy;
  const wanted = Math.abs(widthChange) >= Math.abs(heightChange) * aspect ? start.width + widthChange : (start.height + heightChange) * aspect;
  const roomX = growsRight ? bounds.x + bounds.width - anchorX : anchorX - bounds.x;
  const roomY = growsDown ? bounds.y + bounds.height - anchorY : anchorY - bounds.y;
  const width = clamp(wanted, Math.max(minSize, minSize * aspect), Math.min(roomX, roomY * aspect));
  const height = width / aspect;
  return { x: growsRight ? anchorX : anchorX - width, y: growsDown ? anchorY : anchorY - height, width, height };
}

/** The biggest frame with that ratio, centered; `null` (free) is the whole photo. */
export function aspectCrop(bounds: Rect, aspect: number | null): Rect {
  if (aspect === null) return bounds;
  const wider = bounds.width / bounds.height > aspect;
  const width = wider ? bounds.height * aspect : bounds.width;
  const height = wider ? bounds.height : bounds.width / aspect;
  return { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height };
}

/** A quarter turn to the left, like WhatsApp's button (clockwise degrees, as the manipulator takes them). */
export const nextRotation = (rotation: Rotation): Rotation => ((rotation + 270) % 360) as Rotation;

/** The frame as a fraction of the photo shown. */
export function toFraction(crop: Rect, bounds: Rect): Rect {
  return { x: (crop.x - bounds.x) / bounds.width, y: (crop.y - bounds.y) / bounds.height, width: crop.width / bounds.width, height: crop.height / bounds.height };
}

/** The fraction in whole pixels of a photo of `width`×`height`, never past its border. */
export function toPixels(fraction: Rect, width: number, height: number): PixelCrop {
  const originX = clamp(Math.round(fraction.x * width), 0, width - 1);
  const originY = clamp(Math.round(fraction.y * height), 0, height - 1);
  return {
    originX,
    originY,
    width: clamp(Math.round(fraction.width * width), 1, width - originX),
    height: clamp(Math.round(fraction.height * height), 1, height - originY),
  };
}

/** Nothing to cut nor turn: the original goes as it is. */
export function isWholeImage(fraction: Rect, rotation: Rotation): boolean {
  return rotation === 0 && fraction.x <= WHOLE_EPSILON && fraction.y <= WHOLE_EPSILON && fraction.width >= 1 - WHOLE_EPSILON && fraction.height >= 1 - WHOLE_EPSILON;
}
