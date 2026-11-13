/**
 * Zoom of the web camera (José 13/11: the PWA camera as the APK's). The browser says what its lens
 * allows (`MediaTrackCapabilities.zoom`): Android Chrome does, iPhone Safari does not, and there the
 * chips simply do not show. PURE.
 */
export type ZoomRange = { min: number; max: number };
export type ZoomChip = { label: string; ratio: number };

const WIDE = 0.6;
const TELE = 2;
const NEAR = 0.05;

const labelOf = (ratio: number) => `${(Math.round(ratio * 10) / 10).toString().replace(/^0\./, '.')}x`;

export function zoomChipsFor(range: ZoomRange | null): ZoomChip[] {
  if (!range || range.max <= range.min) return [];
  const ratios = [range.min <= WIDE ? WIDE : null, 1, Math.min(TELE, range.max)].filter((ratio): ratio is number => ratio !== null && ratio >= range.min && ratio <= range.max);
  return [...new Set(ratios)].map((ratio) => ({ label: labelOf(ratio), ratio }));
}

export function activeZoomChip(chips: readonly ZoomChip[], ratio: number): ZoomChip | undefined {
  return chips.find((chip) => Math.abs(chip.ratio - ratio) < NEAR);
}
