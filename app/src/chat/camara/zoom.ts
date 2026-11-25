import type { ZoomRange } from '@lilachat/shared';

/**
 * The APK's side of the camera zoom; the chips, slider and pinch math live in `@lilachat/shared`
 * (`cameraZoom.ts`, shared with the PWA). expo-camera on Android took `zoom` 0..1 as a share of the
 * maximum and never went under 1x; `patches/expo-camera+57.0.6.patch` reads a negative value as an
 * absolute ratio (down to the wide lens) and sends the lens's range with `onCameraReady`.
 * The patch only reaches the APK because `app/package.json` builds expo-camera from source.
 */

/** Until the camera says its range (or an APK without the patched ready event): what 0.1.192 offered. */
export const FALLBACK_RANGE: ZoomRange = { min: 0.6, max: 8 };

/** The range the patched ready event carries, or null when it carries none. PURE. */
export function zoomRangeOf(event: { minZoom?: unknown; maxZoom?: unknown } | undefined): ZoomRange | null {
  const min = Number(event?.minZoom);
  const max = Number(event?.maxZoom);
  return Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min ? { min, max } : null;
}

/** What the patched CameraView takes: the ratio as a negative number. PURE. */
export function nativeZoomOf(ratio: number): number {
  return -ratio;
}
