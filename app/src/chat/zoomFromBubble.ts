/**
 * Zoom from the bubble (plan 1, F2): the geometry of a photo that grows out of
 * its place in the chat, as Telegram's. Pure and worklet-safe: it runs on the
 * UI thread every frame of the opening.
 */
export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/** The box the whole photo (`aspect` = width / height) fills when contained in the screen, centered. */
export function fittedBox(aspect: number, screen: Size): Rect {
  'worklet';
  const full = { x: 0, y: 0, width: screen.width, height: screen.height };
  if (!Number.isFinite(aspect) || aspect <= 0 || screen.width <= 0 || screen.height <= 0) return full;
  const screenAspect = screen.width / screen.height;
  if (aspect >= screenAspect) {
    const height = screen.width / aspect;
    return { x: 0, y: (screen.height - height) / 2, width: screen.width, height };
  }
  const width = screen.height * aspect;
  return { x: (screen.width - width) / 2, y: 0, width, height: screen.height };
}

function mix(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

/** The frame at progress `t` (0 = the bubble, 1 = the screen). A spring may overshoot; sizes never go negative. */
export function interpolateRect(from: Rect, to: Rect, t: number): Rect {
  'worklet';
  return {
    x: mix(from.x, to.x, t),
    y: mix(from.y, to.y, t),
    width: Math.max(0, mix(from.width, to.width, t)),
    height: Math.max(0, mix(from.height, to.height, t)),
  };
}

/** Half a screen of drag and the chat behind is fully back in sight. */
const VANISH_AT_SCREEN_FRACTION = 0.5;

/** How open the photo still is while a finger drags it away: 1 at rest, 0 half a screen away. */
export function openingProgress(dragY: number, screenHeight: number): number {
  'worklet';
  if (screenHeight <= 0) return 1;
  return Math.max(0, 1 - Math.abs(dragY) / (screenHeight * VANISH_AT_SCREEN_FRACTION));
}
