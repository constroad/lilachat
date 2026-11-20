/**
 * The map's photos split by the report they belong to (José 19/11: runway control, prime coat, extra
 * area, milling, observations and their closing, as sub-layers of «Fotos», each with its switch and
 * count). A photo with no report (a registered advance, a unit) goes to its own layer.
 * Ported from Portal's `src/lib/work-streets/reportPhotoLayers.ts` (f080f7c6a) so both apps agree.
 * PURE: web and APK.
 */
import { reportTypeLabel } from './reportCreation.js';

export const NO_REPORT_LAYER = 'sin-informe';
const NO_REPORT_LABEL = 'Otras fotos de campo';

type WithReport = { reportType?: string | null };

const layerKeyOf = (photo: WithReport): string => photo.reportType || NO_REPORT_LAYER;

/** One layer per report type with its photo count: the busiest first, the photos of no report last. */
export function reportPhotoLayersOf(photos: readonly WithReport[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  photos.forEach((photo) => counts.set(layerKeyOf(photo), (counts.get(layerKeyOf(photo)) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => Number(left.type === NO_REPORT_LAYER) - Number(right.type === NO_REPORT_LAYER) || right.count - left.count);
}

/** The photos of the layers that are on: hidden ones leave before the pins are built. */
export const photosOfShownReports = <T extends WithReport>(photos: T[], hidden: ReadonlySet<string>): T[] =>
  (hidden.size === 0 ? photos : photos.filter((photo) => !hidden.has(layerKeyOf(photo))));

export type ReportPhotoLayerRow = { type: string; label: string; count: number; shown: boolean };

/** The sub-rows under «Fotos» in «Capas y leyenda», with the report's readable name. */
export const reportPhotoLayerRows = (photos: readonly WithReport[], hidden: ReadonlySet<string>): ReportPhotoLayerRow[] =>
  reportPhotoLayersOf(photos).map(({ type, count }) => ({ type, label: type === NO_REPORT_LAYER ? NO_REPORT_LABEL : reportTypeLabel(type), count, shown: !hidden.has(type) }));

/** A sub-layer's switch: a new set, the given one untouched. */
export function toggleReportLayer(hidden: ReadonlySet<string>, type: string): ReadonlySet<string> {
  const next = new Set(hidden);
  if (next.has(type)) next.delete(type);
  else next.add(type);
  return next;
}
