/**
 * Zoom of the chat's camera (José 13/11: «no hay opción para hacer .6x 1x 2x»), as a RATIO.
 * expo-camera on Android took `zoom` 0..1 as a share of the maximum and never went under 1x; the
 * patch in `patches/expo-camera+57.0.6.patch` reads a negative value as an absolute ratio, which
 * reaches the wide lens (0.6x) where the phone has one. Phones top out around 8x.
 */
export const MIN_RATIO = 0.6;
export const MAX_RATIO = 8;

export const ZOOM_CHIPS = [
  { label: '.6x', ratio: 0.6 },
  { label: '1x', ratio: 1 },
  { label: '2x', ratio: 2 },
] as const;

const clamp = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

/** The ratio after a pinch that started at `start` and now has this `scale`. PURE. */
export function zoomFromPinch(start: number, scale: number): number {
  return clamp(start * scale);
}

/** «.6x», «1x», «2.5x»: what the screen says while zooming. PURE. */
export function zoomLabel(ratio: number): string {
  const rounded = Math.round(clamp(ratio) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text.replace(/^0\./, '.')}x`;
}

/** What the patched CameraView takes: the ratio as a negative number. PURE. */
export function nativeZoomOf(ratio: number): number {
  return -clamp(ratio);
}
