import type { Rect } from './zoomFromBubble';

/**
 * Where the tapped photo was on screen (plan 1, F2). The bubble measures
 * itself on the tap; the viewer grows the photo out of that place and sends it
 * back there on close. Only the last tap: a photo reached by swiping in the
 * viewer has no place in sight, so it fades instead.
 */
let last: { seq: number; rect: Rect } | null = null;

const isUsable = (rect: Rect): boolean =>
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;

export function rememberPhotoOrigin(seq: number, rect: Rect): void {
  last = isUsable(rect) ? { seq, rect } : null;
}

export function photoOriginOf(seq: number): Rect | undefined {
  return last && last.seq === seq ? last.rect : undefined;
}

export function forgetPhotoOrigin(): void {
  last = null;
}

type Measurable = { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => void };
const isMeasurable = (target: unknown): target is Measurable =>
  typeof target === 'object' && target !== null && 'measureInWindow' in target;

/**
 * The tap on a photo: measure the bubble it came from, then open. With the new
 * architecture `measureInWindow` answers before it returns, so the viewer
 * already has the place; if it ever answered later, the photo just fades in.
 */
export function openFromBubble(event: { currentTarget: unknown }, seq: number, open: ((seq: number) => void) | undefined): void {
  if (!open) return;
  const target = event.currentTarget;
  if (isMeasurable(target)) target.measureInWindow((x, y, width, height) => rememberPhotoOrigin(seq, { x, y, width, height }));
  open(seq);
}
