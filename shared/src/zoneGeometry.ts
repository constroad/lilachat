import type { ArArea } from './arArea.js';
import type { PlanePoint, TapedLength } from './zoneAdjust.js';

/**
 * What a zone measured with the AR keeps so a side can be corrected after saving (José 16/11, the
 * way magicplan locks a wall): the corners laid on their plane, each side's AR length and tape,
 * and the taped diagonals. It travels to Portal as ONE JSON string (`geometria`, Portal's Spanish
 * keys; its context is flat) and comes back on the report's area. PURE.
 */
export type ZoneGeometry = { corners: PlanePoint[]; sides: { arMeters: number; tapeMeters?: number }[]; diagonals: TapedLength[] };

/**
 * Portal stores `geometria` from commit 2d1252ca (16/11, strict v1). Off until it is in production
 * and José re-approves `registrar_area_adicional` (its input changed): before that, Portal refuses
 * an unknown key and the zone would not save. The server drops the field while this is false.
 */
export const ZONE_GEOMETRY_TO_PORTAL = false;

const VERSION = 1;
const CORNERS = { min: 3, max: 32 };
const LENGTH_M = { min: 0.1, max: 500 };
/** Corners far beyond Portal's 500 m sides are not a zone. */
const COORDINATE_MAX_M = 1000;
export const ZONE_GEOMETRY_MAX = 4096;
/** A tenth of a millimeter: the round trip recomputes the same area to the cent. */
const COORDINATE_DECIMALS = 4;
const LENGTH_DECIMALS = 3;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const fixed = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const isLength = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= LENGTH_M.min && value <= LENGTH_M.max;
const isCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= COORDINATE_MAX_M;

/** What a measure keeps, or null when it has no shape to keep. */
export function zoneGeometryOfArea(result: Pick<ArArea, 'plane' | 'sides' | 'diagonals'>): ZoneGeometry | null {
  if (result.plane.length < CORNERS.min || result.plane.length > CORNERS.max || result.sides.length !== result.plane.length) return null;
  return {
    corners: result.plane.map((corner) => ({ x: fixed(corner.x, COORDINATE_DECIMALS), y: fixed(corner.y, COORDINATE_DECIMALS) })),
    sides: result.sides.map((side) => ({ arMeters: fixed(side.arMeters, LENGTH_DECIMALS), ...(side.source === 'wincha' ? { tapeMeters: side.meters } : {}) })),
    diagonals: result.diagonals.map(({ from, to, meters }) => ({ from, to, meters })),
  };
}

/** Portal's v1 string, with only its own keys; nothing when it would not fit. */
export function zoneGeometryString(geometry: ZoneGeometry): string | undefined {
  const field = JSON.stringify({
    v: VERSION,
    esquinas: geometry.corners.map(({ x, y }) => ({ x, y })),
    lados: geometry.sides.map((side) => ({ arM: side.arMeters, ...(side.tapeMeters === undefined ? {} : { winchaM: side.tapeMeters }) })),
    ...(geometry.diagonals.length ? { diagonales: geometry.diagonals.map(({ from, to, meters }) => ({ desde: from, hasta: to, winchaM: meters })) } : {}),
  });
  return field.length <= ZONE_GEOMETRY_MAX ? field : undefined;
}

/** The field for Portal, or nothing when the measure has no shape to keep. */
export function zoneGeometryField(result: Pick<ArArea, 'plane' | 'sides' | 'diagonals'>): string | undefined {
  const geometry = zoneGeometryOfArea(result);
  return geometry ? zoneGeometryString(geometry) : undefined;
}

function cornersOf(raw: unknown): PlanePoint[] | null {
  const corners = list(raw).map(record);
  if (corners.length < CORNERS.min || corners.length > CORNERS.max) return null;
  return corners.every((corner) => isCoordinate(corner.x) && isCoordinate(corner.y)) ? corners.map((corner) => ({ x: corner.x as number, y: corner.y as number })) : null;
}

function sidesOf(raw: unknown, count: number): ZoneGeometry['sides'] | null {
  const sides = list(raw).map(record);
  if (sides.length !== count || !sides.every((side) => isLength(side.arM) && (side.winchaM === undefined || isLength(side.winchaM)))) return null;
  return sides.map((side) => ({ arMeters: side.arM as number, ...(side.winchaM === undefined ? {} : { tapeMeters: side.winchaM as number }) }));
}

/** Only diagonals between two real corners that are not neighbors, with a tape. */
function diagonalsOf(raw: unknown, count: number): TapedLength[] {
  const isCorner = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < count;
  return list(raw).map(record).flatMap((diagonal) => {
    const [from, to, meters] = [diagonal.desde, diagonal.hasta, diagonal.winchaM];
    if (!isCorner(from) || !isCorner(to) || !isLength(meters)) return [];
    const apart = Math.abs(from - to);
    return apart > 1 && apart < count - 1 ? [{ from, to, meters }] : [];
  });
}

/** Portal's `geometria`, as a string or already parsed; null when it is not this shape. */
export function zoneGeometryOf(raw: unknown): ZoneGeometry | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > ZONE_GEOMETRY_MAX) return null;
    try { parsed = JSON.parse(raw); } catch { return null; }
  }
  const geometry = record(parsed);
  if (geometry.v !== VERSION) return null;
  const corners = cornersOf(geometry.esquinas);
  const sides = corners ? sidesOf(geometry.lados, corners.length) : null;
  if (!corners || !sides) return null;
  return { corners, sides, diagonals: diagonalsOf(geometry.diagonales, corners.length) };
}

/** What `zoneSolutionOf` takes to recompute the zone after a correction. */
export function zoneGeometryInput(geometry: ZoneGeometry): { plane: PlanePoint[]; arMeters: number[]; tapes: Record<number, number>; diagonals: TapedLength[] } {
  const tapes = Object.fromEntries(geometry.sides.flatMap((side, index) => (side.tapeMeters === undefined ? [] : [[index, side.tapeMeters]])));
  return { plane: geometry.corners, arMeters: geometry.sides.map((side) => side.arMeters), tapes, diagonals: geometry.diagonals };
}
