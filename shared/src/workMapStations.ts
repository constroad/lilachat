import { sliceLine, stationLabel, type WorkMap, type WorkMapLine, type WorkMapStreet } from './workMap.js';

/**
 * The stations written on the road (audit 08/11 item 10; designs o-01, o-14, o-15): «0+000», one
 * every hundred metres, and the end. A mark too close to the end gives way to it, so the labels
 * never sit on top of each other. PURE: the web and the APK paint them as a text layer.
 */
export type StationMark = { streetId: string; label: string; lat: number; lng: number };

export const STATION_STEP_M = 100;
/** Under this gap a hundred mark and the end would overlap on the map. */
const MIN_GAP_M = 30;

function marksOfStreet(street: WorkMapStreet): StationMark[] {
  if (street.line.length < 2) return [];
  const end = Math.round(street.lengthM);
  const stations: number[] = [];
  for (let meters = 0; meters < end; meters += STATION_STEP_M) {
    if (meters === 0 || end - meters >= MIN_GAP_M) stations.push(meters);
  }
  stations.push(end);
  return stations.flatMap((meters) => {
    const point = meters === 0 ? street.line[0] : sliceLine(street.line, 0, meters).at(-1);
    return point ? [{ streetId: street.id, label: stationLabel(meters), lat: point.lat, lng: point.lng }] : [];
  });
}

export const stationMarksOf = (streets: WorkMapStreet[]): StationMark[] => streets.flatMap(marksOfStreet);

export const stationMarkCollection = (marks: StationMark[]) => ({
  type: 'FeatureCollection' as const,
  features: marks.map((mark) => ({ type: 'Feature' as const, properties: { label: mark.label }, geometry: { type: 'Point' as const, coordinates: [mark.lng, mark.lat] as [number, number] } })),
});

/** How a station reads on the map, the same on the web and the APK; MapLibre paints hex, not tokens. */
export const STATION_DOT_PAINT = { 'circle-color': '#ffffff', 'circle-radius': 3.5, 'circle-stroke-color': '#334155', 'circle-stroke-width': 1.5 };
export const STATION_TEXT_LAYOUT = { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false };
export const STATION_TEXT_PAINT = { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 };

/** The marks of the streets the view shows (a stage or work filter hides the others). */
export const visibleStationMarks = (streets: WorkMapStreet[], shownIds: string[]): StationMark[] =>
  stationMarksOf(streets.filter((street) => shownIds.includes(street.id)));

/** The part of a street no stretch covers: faint, so the street reads whole without counting as pending. */
export const BARE_COLOR = '#cbd5e1';

function gapsOf(street: WorkMapStreet, covered: Array<[number, number]>): Array<[number, number]> {
  const gaps: Array<[number, number]> = [];
  let at = 0;
  for (const [from, to] of [...covered].sort((left, right) => left[0] - right[0])) {
    if (from > at + 1) gaps.push([at, from]);
    at = Math.max(at, to);
  }
  if (street.lengthM > at + 1) gaps.push([at, street.lengthM]);
  return gaps;
}

/** Only streets with stretches: one without any is already drawn whole as pending. */
export function bareLinesOf(map: Pick<WorkMap, 'streets' | 'scopes'>): WorkMapLine[] {
  return map.streets.flatMap((street) => {
    const covered = map.scopes.filter((scope) => scope.streetId === street.id).map((scope): [number, number] => [scope.fromM, scope.toM]);
    if (!covered.length) return [];
    return gapsOf(street, covered).flatMap(([fromM, toM]) => {
      const coordinates = sliceLine(street.line, fromM, toM).map((point): [number, number] => [point.lng, point.lat]);
      return coordinates.length >= 2 ? [{ streetId: street.id, color: BARE_COLOR, coordinates, fromM, toM }] : [];
    });
  });
}
