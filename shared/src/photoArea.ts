import type { AreaFigures } from './areaMeasure.js';

/**
 * Measuring a zone on its photo with the tape (design la-05, the APK without
 * AR; José 15/11: the phone measures, the PWA does not). The corners are
 * touched on the photo, in its own pixels; one side measured with the tape
 * fixes the scale, and every measured side counts in it. PURE.
 */
export type PhotoPoint = { x: number; y: number };
export type SideSource = 'wincha' | 'escala';
export type PhotoSide = { index: number; meters: number; source: SideSource };
export type PhotoArea = { sides: PhotoSide[]; areaM2: number; thicknessCm: number | null; volumeM3: number | null; readings: number };

const MIN_CORNERS = 3;
const CENTI = 100;
const LARGE_M2 = 1000;
const THICKNESS_CM = { min: 1, max: 50 };

const rounded = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const decimalLabel = (value: number, decimals: number) => value.toFixed(decimals).replace('.', ',');

const sidePx = (points: readonly PhotoPoint[], index: number): number => {
  const from = points[index]!;
  const to = points[(index + 1) % points.length]!;
  return Math.hypot(to.x - from.x, to.y - from.y);
};

/** Shoelace: the area in square pixels, the same whichever way the corners go round. */
const polygonPx = (points: readonly PhotoPoint[]): number =>
  Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;

/** Meters per pixel from the measured sides; null when none of them counts. */
function scaleOf(points: readonly PhotoPoint[], measured: Readonly<Record<number, number>>): number | null {
  const ratios = Object.entries(measured)
    .map(([key, meters]) => ({ index: Number(key), meters }))
    .filter(({ index, meters }) => Number.isInteger(index) && index >= 0 && index < points.length && meters > 0 && sidePx(points, index) > 0)
    .map(({ index, meters }) => meters / sidePx(points, index));
  return ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null;
}

/** The mean thickness of the readings between 1 and 50 cm, to one decimal. */
export function thicknessAverage(readingsCm: readonly number[]): number | null {
  const valid = readingsCm.filter((reading) => reading >= THICKNESS_CM.min && reading <= THICKNESS_CM.max);
  return valid.length ? rounded(valid.reduce((sum, reading) => sum + reading, 0) / valid.length, 1) : null;
}

export function photoAreaOf(points: readonly PhotoPoint[], measured: Readonly<Record<number, number>>, readingsCm: readonly number[]): PhotoArea | null {
  if (points.length < MIN_CORNERS) return null;
  const scale = scaleOf(points, measured);
  const areaPx = polygonPx(points);
  if (scale === null || areaPx === 0) return null;
  const sides = points.map((_, index): PhotoSide => {
    const taped = measured[index];
    return taped !== undefined && taped > 0 ? { index, meters: taped, source: 'wincha' } : { index, meters: rounded(sidePx(points, index) * scale, 2), source: 'escala' };
  });
  const areaM2 = rounded(areaPx * scale * scale, 2);
  const thicknessCm = thicknessAverage(readingsCm);
  const volumeM3 = thicknessCm === null ? null : rounded((areaM2 * thicknessCm) / CENTI, 3);
  return { sides, areaM2, thicknessCm, volumeM3, readings: readingsCm.length };
}

/** What Portal stores: the area alone (a polygon is not length × width), with the thickness when there is one. */
export function photoAreaFigures(result: PhotoArea): AreaFigures {
  const volume = result.thicknessCm === null || result.volumeM3 === null ? {} : { thicknessCm: result.thicknessCm, volumeM3: result.volumeM3 };
  const tail = volume.volumeM3 === undefined ? '' : ` · ${decimalLabel(volume.volumeM3, 3)} m³`;
  return { areaM2: result.areaM2, ...volume, line: `${decimalLabel(result.areaM2, 2)} m²${tail}`, large: result.areaM2 > LARGE_M2 };
}

/** «L1 2,00 m», as the label on the photo. */
export const photoSideLabel = (side: PhotoSide): string => `L${side.index + 1} ${decimalLabel(rounded(side.meters, 2), 2)} m`;

/** The keys of the tape keypad (56 px, used with gloves): digits, the point and «borrar». */
export type TapeKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'borrar';
const TAPE_WHOLE_DIGITS = 3;
const TAPE_DECIMALS = 2;

/** What the field shows after a key: one point, two decimals at most, three whole digits (up to 999 m). */
export function tapeKey(current: string, key: TapeKey): string {
  if (key === 'borrar') return current.slice(0, -1);
  const [whole = '', fraction] = current.split('.');
  if (key === '.') return fraction !== undefined ? current : `${whole || '0'}.`;
  if (fraction !== undefined) return fraction.length < TAPE_DECIMALS ? `${current}${key}` : current;
  return whole.length < TAPE_WHOLE_DIGITS ? `${current}${key}` : current;
}

/** The typed length in meters; null while it is not a positive number. */
export function tapeMeters(typed: string): number | null {
  const value = Number(typed);
  return typed !== '' && !typed.endsWith('.') && Number.isFinite(value) && value > 0 ? value : null;
}

type Size = { width: number; height: number };

/** The photo fitted inside its box («contain»): its scale and where it starts. */
function fitted(box: Size, photo: Size): { scale: number; left: number; top: number } {
  const scale = Math.min(box.width / photo.width, box.height / photo.height);
  return { scale, left: (box.width - photo.width * scale) / 2, top: (box.height - photo.height * scale) / 2 };
}

/** A touch on the box in the photo's own pixels; null off the photo. */
export function photoPointOf(touch: PhotoPoint, box: Size, photo: Size): PhotoPoint | null {
  const { scale, left, top } = fitted(box, photo);
  const x = (touch.x - left) / scale;
  const y = (touch.y - top) / scale;
  return x < 0 || y < 0 || x > photo.width || y > photo.height ? null : { x: Math.round(x), y: Math.round(y) };
}

/** Where a photo point is drawn on the box. */
export function screenPointOf(point: PhotoPoint, box: Size, photo: Size): PhotoPoint {
  const { scale, left, top } = fitted(box, photo);
  return { x: left + point.x * scale, y: top + point.y * scale };
}
