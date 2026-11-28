import { metersLabel, projectOntoLine, sliceLine, stationLabel, type WorkMap, type WorkMapLine, type WorkMapPoint, type WorkMapStreet } from './workMap.js';
import { BRUSH_REACH_M, brushLinesOf } from './workMapBrush.js';
import { stretchLineOf } from './workMapProgress.js';
import type { ManualRange } from './workAvanceMode.js';
import type { StreetEnd, StreetHandle } from './workStreetPick.js';

/**
 * «Marcar a mano» in Modo Avance (José 28/11: «hemos intervenido partes de una calle»). The work's
 * streets are short patches on long roads: a tap snaps to the nearest one with a reach that grows
 * as the map zooms out, and two taps on the street set «desde» and «hasta». PURE: the APK and the
 * web draw the rings and send what this decides.
 */

export const AVANCE_MANUAL_LABEL = 'Marcar a mano';
export const AVANCE_MANUAL_HINT = 'Toca en la calle dónde empieza y dónde termina el avance';
export const AVANCE_MANUAL_ONE = 'Ahora toca dónde termina el avance';

/** A finger misses by this many pixels whatever the zoom; at street zoom the metres rule. */
export const TAP_REACH_PX = 30;
const EQUATOR_M_PER_PX = 156_543.03392;
const DEGREES_TO_RADIANS = Math.PI / 180;
const PAIR = 2;

/** How far from a street a tap still picks it: 30 px at the map's zoom, never under the brush's reach. */
export function tapReachM(zoom: number | undefined, lat: number): number {
  if (zoom === undefined || !Number.isFinite(zoom)) return BRUSH_REACH_M;
  const metersPerPx = (EQUATOR_M_PER_PX * Math.cos(lat * DEGREES_TO_RADIANS)) / 2 ** zoom;
  return Math.max(BRUSH_REACH_M, metersPerPx * TAP_REACH_PX);
}

/** The nearest street of the work within reach of the tap; null when the tap is off every street. */
export function avanceStreetAtTap(map: Pick<WorkMap, 'streets'>, place: WorkMapPoint, reachM: number): string | null {
  let best: { id: string; distanceM: number } | null = null;
  for (const street of map.streets) {
    const foot = street.line.length >= PAIR ? projectOntoLine(street.line, place) : null;
    if (foot && foot.distanceM <= reachM && (!best || foot.distanceM < best.distanceM)) best = { id: street.id, distanceM: foot.distanceM };
  }
  return best?.id ?? null;
}

/** Where a tap falls on the street's axis, in whole metres; past an end it snaps to that end. */
export function measureOnStreet(street: Pick<WorkMapStreet, 'line' | 'lengthM'>, place: WorkMapPoint): number {
  const foot = street.line.length >= PAIR ? projectOntoLine(street.line, place) : null;
  return Math.round(Math.min(Math.max(foot?.measureM ?? 0, 0), street.lengthM));
}

/** First tap «desde», second «hasta»; a third starts over. */
export const addManualMark = (marks: readonly number[], measureM: number): number[] => (marks.length === 1 ? [marks[0]!, measureM] : [measureM]);

/** The stretch in order, whichever end was tapped first; null until both are on the street. */
export function manualRangeOf(marks: readonly number[]): ManualRange | null {
  if (marks.length < PAIR) return null;
  const [first, second] = [marks[0]!, marks[1]!];
  return { fromM: Math.min(first, second), toM: Math.max(first, second) };
}

/** A ring dragged to a new place moves its end; the pair stays ordered. */
export function moveManualMark(marks: readonly number[], handle: StreetEnd, measureM: number): number[] {
  const range = manualRangeOf(marks);
  if (!range) return [measureM];
  return handle === 'start' ? [measureM, range.toM] : [range.fromM, measureM];
}

/** The rings over the street with their chainage; `key` changes with the place so a native ring redraws. */
export function manualHandlesOf(street: Pick<WorkMapStreet, 'line'> | undefined, marks: readonly number[]): StreetHandle[] {
  if (!street || street.line.length < PAIR) return [];
  const range = manualRangeOf(marks);
  const ends: Array<[StreetEnd, number]> = range ? [['start', range.fromM], ['end', range.toM]] : marks.map((measureM): [StreetEnd, number] => ['start', measureM]);
  return ends.flatMap(([handle, measureM]) => {
    const point = measureM > 0 ? sliceLine(street.line, 0, measureM).at(-1) : street.line[0];
    return point ? [{ handle, point, label: stationLabel(measureM), key: `${handle}-${measureM}` }] : [];
  });
}

/** «+4 m · 0+002 → 0+006». */
export const manualRangeSummary = (range: ManualRange): string => `+${metersLabel(range.toM - range.fromM)} · ${stationLabel(range.fromM)} → ${stationLabel(range.toM)}`;

/** Modo Avance's lines: the work's stretches in its colour, and the picked street (or the hand-marked stretch) thick on top in the same colour. */
export function avanceLinesOf(map: WorkMap, workId: string | null, streetId: string | null, range: ManualRange | null): WorkMapLine[] {
  const own = workId ? brushLinesOf(map, { kind: 'work', id: workId }) : [];
  const street = map.streets.find((one) => one.id === streetId);
  const picked = street ? stretchLineOf(map, street.id, range?.fromM ?? 0, range?.toM ?? street.lengthM) : null;
  const color = map.works.find((work) => work.id === workId)?.color;
  return picked ? [...own, color ? { ...picked, color } : picked] : own;
}

/** A chip's name, cut with «…» so its % is never the part that hides (José 28/11). */
export const CHIP_NAME_MAX = 14;
export const chipNameOf = (name: string): string => (name.length > CHIP_NAME_MAX ? `${name.slice(0, CHIP_NAME_MAX - 1).trimEnd()}…` : name);
