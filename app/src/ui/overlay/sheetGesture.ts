/**
 * Drag-to-dismiss of an in-window sheet (plan 1, F1). Pure, and every function
 * is also a worklet: the gesture decides on the UI thread without a hop to JS.
 */
export type DragEnd = { translateY: number; velocityY: number; height: number };

/** Dragged past this fraction of its height, the sheet goes. */
export const DISMISS_FRACTION = 1 / 3;
/** A downward flick faster than this (px/s) closes it from any position. */
export const DISMISS_VELOCITY = 800;

export function shouldDismiss(end: DragEnd): boolean {
  'worklet';
  if (end.height <= 0) return false;
  if (end.velocityY < 0) return false;
  if (end.velocityY > DISMISS_VELOCITY) return true;
  return end.translateY > end.height * DISMISS_FRACTION;
}

/** The sheet follows the finger downward only; it never rises above where it rests. */
export function clampDrag(translateY: number): number {
  'worklet';
  return translateY < 0 ? 0 : translateY;
}

/** The backdrop's shade: full at rest, gone when the sheet is all the way down. */
export function backdropOpacity(translateY: number, height: number, max: number): number {
  'worklet';
  if (height <= 0) return max;
  const remaining = 1 - translateY / height;
  return remaining <= 0 ? 0 : max * remaining;
}
