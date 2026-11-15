import type { AreaFigures } from './areaMeasure.js';
import { thicknessAverage, type SideSource } from './photoArea.js';

/**
 * A zone measured with the APK's AR (designs la-02/la-03; José 15/11: «AR +
 * wincha», money for the client). ARCore gives each corner in meters (y up);
 * the AR fixes the SHAPE, and at least one side measured with the tape fixes
 * the SCALE of every side. A tape 3 % off the AR warns, 15 % off blocks.
 * Everything that could bill a wrong figure never saves. PURE.
 */
/** A corner in ARCore's world (meters, y up); `floorY` is the height of the floor plane it landed on. */
export type ArPoint = { x: number; y: number; z: number; floorY?: number };
export type ArSideFlag = 'ok' | 'warn' | 'block';
export type ArSide = { index: number; arMeters: number; meters: number; source: SideSource; flag: ArSideFlag; centimeters?: true };
export type ArProblem = 'few-corners' | 'short-side' | 'crossed' | 'degenerate' | 'off-plane' | 'tracking-lost' | 'too-small' | 'too-large' | 'no-tape' | 'tape-mismatch';
export type ArArea = { sides: ArSide[]; areaM2: number | null; thicknessCm: number | null; volumeM3: number | null; readings: number; problems: ArProblem[]; canSave: boolean };
export type ArInput = { points: readonly ArPoint[]; tapes: Readonly<Record<number, number>>; readingsCm: readonly number[]; stable: boolean };

const MIN_CORNERS = 3;
const SIDE_MIN_M = 0.1;
/** Residual from the best plane: one corner 12 cm off a quad's floor shows as 3 cm on each. */
const OFF_PLANE_M = 0.03;
/** Corners on floor planes this far apart in height are on another level (a curb top, a car roof). */
const FLOOR_LEVELS_M = 0.08;
/** A corner this close to a side that is not its own, or a corner sharper than this, is a mis-mark. */
const NEAR_SIDE_M = 0.1;
const SHARP_DEGREES = 10;
const AREA_LIMITS_M2 = { min: 0.05, max: 5000 };
const GAP = { warn: 0.03, block: 0.15 };
/** A tape about 100 times the AR is the right length typed in centimeters. */
const CENTIMETER_RATIO = { min: 50, max: 150 };
const CENTI = 100;
const LARGE_M2 = 1000;

type Vector = { x: number; y: number; z: number };
const rounded = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const decimalLabel = (value: number, decimals: number) => value.toFixed(decimals).replace('.', ',');
const distance = (from: Vector, to: Vector) => Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
const isFinitePoint = (point: ArPoint) => [point.x, point.y, point.z].every(Number.isFinite);
const next = <T>(items: readonly T[], index: number): T => items[(index + 1) % items.length]!;

/** Newell's normal: twice the polygon's vector area, for any plane and either winding. */
function newellNormal(points: readonly ArPoint[]): Vector {
  return points.reduce((sum, point, index) => {
    const after = next(points, index);
    return { x: sum.x + (point.y - after.y) * (point.z + after.z), y: sum.y + (point.z - after.z) * (point.x + after.x), z: sum.z + (point.x - after.x) * (point.y + after.y) };
  }, { x: 0, y: 0, z: 0 });
}

/** How far the farthest corner is from the polygon's own plane. */
function offPlane(points: readonly ArPoint[], normal: Vector): number {
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (!length) return 0;
  const unit = { x: normal.x / length, y: normal.y / length, z: normal.z / length };
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length, z: sum.z + point.z / points.length }), { x: 0, y: 0, z: 0 });
  return Math.max(...points.map((point) => Math.abs((point.x - center.x) * unit.x + (point.y - center.y) * unit.y + (point.z - center.z) * unit.z)));
}

type Flat = { u: number; v: number };

/** The corners on the plane's two widest axes, to look for crossing sides. */
function flattened(points: readonly ArPoint[], normal: Vector): Flat[] {
  const [ax, ay, az] = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  if (ay >= ax && ay >= az) return points.map((point) => ({ u: point.x, v: point.z }));
  if (ax >= az) return points.map((point) => ({ u: point.y, v: point.z }));
  return points.map((point) => ({ u: point.x, v: point.y }));
}

const turn = (a: Flat, b: Flat, c: Flat) => Math.sign((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u));
const segmentsCross = (a: Flat, b: Flat, c: Flat, d: Flat) => turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0;

function pointToSegment(point: Flat, a: Flat, b: Flat): number {
  const [du, dv] = [b.u - a.u, b.v - a.v];
  const length = du * du + dv * dv;
  const t = length ? Math.max(0, Math.min(1, ((point.u - a.u) * du + (point.v - a.v) * dv) / length)) : 0;
  return Math.hypot(point.u - (a.u + t * du), point.v - (a.v + t * dv));
}

const segmentGap = (a: Flat, b: Flat, c: Flat, d: Flat) =>
  segmentsCross(a, b, c, d) ? 0 : Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));

/** Pairs of sides that do not share a corner. */
function nonNeighbors(count: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let first = 0; first < count; first += 1) {
    for (let second = first + 2; second < count; second += 1) if (!(first === 0 && second === count - 1)) pairs.push([first, second]);
  }
  return pairs;
}

/** A corner on top of another side (T, overlap) or a spike that comes back on itself. */
function isDegenerate(points: readonly ArPoint[], flat: readonly Flat[]): boolean {
  const touching = nonNeighbors(flat.length).some(([first, second]) => segmentGap(flat[first]!, next(flat, first), flat[second]!, next(flat, second)) < NEAR_SIDE_M);
  return touching || points.some((point, index) => cornerDegrees(points[(index + points.length - 1) % points.length]!, point, next(points, index)) < SHARP_DEGREES);
}

function cornerDegrees(before: ArPoint, corner: ArPoint, after: ArPoint): number {
  const a = { x: before.x - corner.x, y: before.y - corner.y, z: before.z - corner.z };
  const b = { x: after.x - corner.x, y: after.y - corner.y, z: after.z - corner.z };
  const lengths = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  if (!lengths) return 0;
  const cosine = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / lengths));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Corners whose floor planes are at different heights. */
function onSeveralLevels(points: readonly ArPoint[]): boolean {
  const levels = points.map((point) => point.floorY).filter((level): level is number => level !== undefined && Number.isFinite(level));
  return levels.length > 1 && Math.max(...levels) - Math.min(...levels) > FLOOR_LEVELS_M;
}

/** Two sides that are not neighbors cross: the corners were marked out of order. */
function isCrossed(flat: readonly Flat[]): boolean {
  return nonNeighbors(flat.length).some(([first, second]) => segmentsCross(flat[first]!, next(flat, first), flat[second]!, next(flat, second)));
}

/** Each taped side against its AR length; the scale is the mean of the sides that do not block. */
function tapedSides(arMeters: readonly number[], tapes: Readonly<Record<number, number>>) {
  const taped = Object.entries(tapes)
    .map(([key, meters]) => ({ index: Number(key), meters }))
    .filter(({ index, meters }) => Number.isInteger(index) && index >= 0 && index < arMeters.length && Number.isFinite(meters) && meters > 0 && arMeters[index]! > 0)
    .map(({ index, meters }) => {
      const ratio = meters / arMeters[index]!;
      const gap = Math.abs(ratio - 1);
      const flag: ArSideFlag = gap > GAP.block ? 'block' : gap > GAP.warn ? 'warn' : 'ok';
      return { index, meters, ratio, flag, centimeters: ratio >= CENTIMETER_RATIO.min && ratio <= CENTIMETER_RATIO.max };
    });
  const counted = taped.filter((side) => side.flag !== 'block');
  // Weighted by length (audit 15/11): ARCore errs in centimeters, so a short side must not swing the zone.
  const scale = counted.length ? counted.reduce((sum, side) => sum + side.meters, 0) / counted.reduce((sum, side) => sum + arMeters[side.index]!, 0) : 1;
  const ratios = counted.map((side) => side.ratio);
  const disagree = ratios.length > 1 && Math.max(...ratios) / Math.min(...ratios) - 1 > GAP.block;
  return { taped, scale, disagree };
}

function shapeProblems(points: readonly ArPoint[], normal: Vector, arMeters: readonly number[], stable: boolean): ArProblem[] {
  const problems: ArProblem[] = [];
  if (!stable) problems.push('tracking-lost');
  if (arMeters.some((meters) => meters < SIDE_MIN_M)) problems.push('short-side');
  if (offPlane(points, normal) > OFF_PLANE_M || onSeveralLevels(points)) problems.push('off-plane');
  const flat = flattened(points, normal);
  if (isCrossed(flat)) problems.push('crossed');
  else if (isDegenerate(points, flat)) problems.push('degenerate');
  return problems;
}

const failed = (problems: ArProblem[], readings: number): ArArea => ({ sides: [], areaM2: null, thicknessCm: null, volumeM3: null, readings, problems, canSave: false });

export function arAreaOf(input: ArInput): ArArea {
  const { points, readingsCm } = input;
  if (points.length < MIN_CORNERS) return failed(['few-corners'], readingsCm.length);
  if (!points.every(isFinitePoint)) return failed(['tracking-lost'], readingsCm.length);
  const normal = newellNormal(points);
  const arMeters = points.map((point, index) => distance(point, next(points, index)));
  const { taped, scale, disagree } = tapedSides(arMeters, input.tapes);
  const sides = arMeters.map((meters, index): ArSide => {
    const tape = taped.find((side) => side.index === index);
    if (!tape) return { index, arMeters: meters, meters: rounded(meters * scale, 2), source: 'escala', flag: 'ok' };
    return { index, arMeters: meters, meters: tape.meters, source: 'wincha', flag: tape.flag, ...(tape.centimeters ? { centimeters: true as const } : {}) };
  });
  const areaM2 = rounded((Math.hypot(normal.x, normal.y, normal.z) / 2) * scale * scale, 2);
  const problems = shapeProblems(points, normal, arMeters, input.stable);
  if (areaM2 < AREA_LIMITS_M2.min) problems.push('too-small');
  if (areaM2 > AREA_LIMITS_M2.max) problems.push('too-large');
  if (!taped.length) problems.push('no-tape');
  if (disagree || taped.some((side) => side.flag === 'block')) problems.push('tape-mismatch');
  const thicknessCm = thicknessAverage(readingsCm);
  const volumeM3 = thicknessCm === null ? null : rounded((areaM2 * thicknessCm) / CENTI, 3);
  return { sides, areaM2, thicknessCm, volumeM3, readings: readingsCm.length, problems, canSave: problems.length === 0 };
}

/** What Portal stores: the area alone (a polygon is not length × width), with the thickness when there is one. */
export function arAreaFigures(result: ArArea): AreaFigures {
  const areaM2 = result.areaM2 ?? 0;
  const volume = result.thicknessCm === null || result.volumeM3 === null ? {} : { thicknessCm: result.thicknessCm, volumeM3: result.volumeM3 };
  const tail = volume.volumeM3 === undefined ? '' : ` · ${decimalLabel(volume.volumeM3, 3)} m³`;
  return { areaM2, ...volume, line: `${decimalLabel(areaM2, 2)} m²${tail}`, large: areaM2 > LARGE_M2 };
}

type Box = { width: number; height: number };

/** The corners seen from above, fitted in the box (contain) with a margin: la-03's plan. */
export function arPlanOf(points: readonly ArPoint[], box: Box, margin: number): { x: number; y: number }[] {
  if (points.length < 2 || !points.every(isFinitePoint)) return [];
  const flat = flattened(points, points.length >= MIN_CORNERS ? newellNormal(points) : { x: 0, y: 1, z: 0 });
  const [minU, maxU] = [Math.min(...flat.map((p) => p.u)), Math.max(...flat.map((p) => p.u))];
  const [minV, maxV] = [Math.min(...flat.map((p) => p.v)), Math.max(...flat.map((p) => p.v))];
  const spanU = maxU - minU || 1;
  const spanV = maxV - minV || 1;
  const scale = Math.min((box.width - 2 * margin) / spanU, (box.height - 2 * margin) / spanV);
  const left = (box.width - spanU * scale) / 2;
  const top = (box.height - spanV * scale) / 2;
  return flat.map((p) => ({ x: left + (p.u - minU) * scale, y: top + (p.v - minV) * scale }));
}

/** Farther than this the native side refuses the corner too (ARCore's floor gets uncertain). */
export const AR_MAX_AIM_M = 6;

/** la-02's guide line: what to do next, by what the AR sees under the center. */
export function arAimLine(frame: { state: string; floor: boolean; distance?: number | null }, corners: number): string {
  if (frame.state !== 'tracking') return 'Mueve el teléfono despacio, apuntando al piso.';
  if (!frame.floor) return 'Apunta al piso hasta que el círculo se llene.';
  if ((frame.distance ?? 0) > AR_MAX_AIM_M) return 'Acércate: la esquina está a más de 6 m.';
  return corners >= MIN_CORNERS ? `Apunta a la esquina ${corners + 1} o toca «Cerrar»` : `Apunta a la esquina ${corners + 1}`;
}

const PROBLEM_LINES: Record<ArProblem, string> = {
  'few-corners': 'Marca al menos tres esquinas.',
  'short-side': 'Dos esquinas están casi en el mismo punto: deshaz la última.',
  crossed: 'Los lados se cruzan: marca las esquinas en orden, dando la vuelta a la zona.',
  degenerate: 'Una esquina quedó sobre otro lado o hace un pico: deshazla y márcala de nuevo.',
  'off-plane': 'Una esquina no está en el piso (pared, sardinel o un auto): deshazla y márcala en el piso.',
  'tracking-lost': 'El AR perdió la referencia mientras medías: vuelve a marcar las esquinas.',
  'too-small': 'La zona mide menos de 0,05 m²: revisa las esquinas.',
  'too-large': 'La zona mide más de 5 000 m²: revisa las esquinas o la wincha.',
  'no-tape': 'Mide al menos un lado con la wincha: fija la escala de todos.',
  'tape-mismatch': 'La wincha difiere más de 15 % del AR (o dos winchas no coinciden entre sí): revisa los lados o si escribiste centímetros.',
};

export const arProblemLine = (problem: ArProblem): string => PROBLEM_LINES[problem];

/**
 * The overlay's sides, split where a corner is behind the camera or off the
 * screen: such a corner comes back at (0, 0), and a line to it crosses the view.
 */
export function visibleRuns<T extends { visible: boolean }>(points: readonly T[]): T[][] {
  const runs: T[][] = [[]];
  for (const point of points) {
    if (point.visible) runs[runs.length - 1]!.push(point);
    else if (runs[runs.length - 1]!.length) runs.push([]);
  }
  return runs.filter((run) => run.length >= 2);
}
