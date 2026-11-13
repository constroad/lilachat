/**
 * Zoom of the chat's camera (José 13/11: «no hay opción para hacer .6x 1x 2x»). expo-camera takes
 * `zoom` 0..1 as a share of the lens's maximum (ratio = max(1, zoom × max)); it cannot go under 1x
 * on Android, so «.6x» waits for the native change. The maximum is not exposed: phones are about 8x.
 */
export const ASSUMED_MAX_RATIO = 8;
/** How much a pinch moves the zoom: a full spread of the fingers is about half the range. */
const PINCH_GAIN = 0.5;

export const ZOOM_CHIPS = [
  { label: '1x', zoom: 0 },
  { label: '2x', zoom: 2 / ASSUMED_MAX_RATIO },
] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** The zoom after a pinch that started at `start` and now has this `scale`. PURE. */
export function zoomFromPinch(start: number, scale: number): number {
  return clamp(start + (scale - 1) * PINCH_GAIN);
}

/** «1x», «2.5x»: what the screen says while zooming. PURE. */
export function zoomLabel(zoom: number): string {
  const ratio = Math.max(1, clamp(zoom) * ASSUMED_MAX_RATIO);
  return `${Number.isInteger(ratio) ? ratio : ratio.toFixed(1)}x`;
}
