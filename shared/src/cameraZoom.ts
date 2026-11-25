/**
 * Zoom of the chat camera, shared by the APK and the PWA (José 25/11: like Samsung's camera,
 * .6, 1, 2, 3, 5, 10 and a slider). The lens says its own range (the APK through the patched
 * expo-camera's ready event, the browser through `MediaTrackCapabilities.zoom`): the chips are the
 * stops it reaches, and the slider covers the whole range, logarithmic like the phone's. PURE.
 */
export type ZoomRange = { min: number; max: number };
export type ZoomChip = { label: string; ratio: number };

/** The chips of a Samsung camera; beyond 10x it is the slider. */
const ZOOM_STOPS = [0.6, 1, 2, 3, 5, 10] as const;
/** How near a ratio counts as a chip, and how far under its stop a lens still offers it (0.55 → .6x). */
const NEAR = 0.05;
/** From here the readout drops the decimal (28x, not 27,6x). */
const WHOLE_FROM = 10;

const chipLabel = (ratio: number) => `${(Math.round(ratio * 10) / 10).toString().replace(/^0\./, '.')}x`;

export function clampZoom(ratio: number, range: ZoomRange): number {
  return Math.min(range.max, Math.max(range.min, ratio));
}

/** The stops this lens reaches; a lens that barely zooms gets 1x and its top. None without zoom. */
export function zoomChipsFor(range: ZoomRange | null): ZoomChip[] {
  if (!range || range.max <= range.min) return [];
  const reached: number[] = ZOOM_STOPS.filter((stop) => stop >= range.min - NEAR && stop <= range.max + NEAR);
  const ratios = reached.length > 1 ? reached : [1, range.max].filter((ratio) => ratio >= range.min);
  return [...new Set(ratios)].map((ratio) => ({ label: chipLabel(ratio), ratio }));
}

export function activeZoomChip(chips: readonly ZoomChip[], ratio: number): ZoomChip | undefined {
  return chips.find((chip) => Math.abs(chip.ratio - ratio) < NEAR);
}

/** A slider position (0..1) as a ratio: logarithmic, so 1x→10x takes as much track as 10x→100x. */
export function sliderToZoom(position: number, range: ZoomRange): number {
  if (range.max <= range.min) return range.min;
  const share = Math.min(1, Math.max(0, position));
  return range.min * (range.max / range.min) ** share;
}

export function zoomToSlider(ratio: number, range: ZoomRange): number {
  if (range.max <= range.min) return 0;
  return Math.log(clampZoom(ratio, range) / range.min) / Math.log(range.max / range.min);
}

/** The ratio after a pinch that started at `start` and now has this `scale`. */
export function zoomFromPinch(start: number, scale: number, range: ZoomRange): number {
  return clampZoom(start * scale, range);
}

/** What the screen says while zooming: «.6x», «3,4x», «28x». */
export function zoomLabel(ratio: number): string {
  if (ratio >= WHOLE_FROM) return `${Math.round(ratio)}x`;
  const rounded = Math.round(ratio * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text.replace(/^0,/, '.')}x`;
}
