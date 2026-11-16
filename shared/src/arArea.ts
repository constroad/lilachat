import type { AreaFigures, AreaMethod } from './areaMeasure.js';
import { thicknessAverage, type SideSource } from './photoArea.js';
import { adjustedZone, diameterM, newellNormal, planeCornersOf, type PlanePoint, type TapedLength } from './zoneAdjust.js';

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
/** A diagonal measured with the tape between two corners that are not neighbors (it fixes a quad's shape). */
export type ArDiagonal = { from: number; to: number; arMeters: number; meters: number; flag: ArSideFlag; centimeters?: true };
export type ArProblem = 'few-corners' | 'short-side' | 'crossed' | 'degenerate' | 'off-plane' | 'tracking-lost' | 'too-small' | 'too-large' | 'no-tape' | 'tape-mismatch' | 'tape-bends' | 'tape-contradicts' | 'tape-short';
/** `plane`: the AR corners laid flat on their own plane (meters), what a later edit recomputes from. */
export type ArArea = { sides: ArSide[]; diagonals: ArDiagonal[]; plane: PlanePoint[]; areaM2: number | null; thicknessCm: number | null; volumeM3: number | null; readings: number; problems: ArProblem[]; canSave: boolean };

/**
 * What only warns (José 15/11, after testing on his phone: nobody tapes every
 * zone in the street, so the tape must not block): the AR's figure saves without
 * a tape, and a corner that looks off the floor is shown, not refused. Portal
 * marks every `ar-app` area to verify.
 */
const WARNINGS: ReadonlySet<ArProblem> = new Set<ArProblem>(['no-tape', 'off-plane', 'tape-bends', 'tape-short']);
export const isArWarning = (problem: ArProblem): boolean => WARNINGS.has(problem);
export type ArInput = { points: readonly ArPoint[]; tapes: Readonly<Record<number, number>>; diagonals?: readonly TapedLength[]; readingsCm: readonly number[]; stable: boolean };

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
/**
 * How far the tapes may move an AR corner (after the scale): ARCore errs 5 to 10 cm per corner
 * and drifts with distance, so the limit grows with the zone's span (audit 16/11: a 36 m zone
 * taped exactly was blocked). Past the warning, the tapes and the AR disagree (measure a
 * diagonal); past the block, a tape is wrong.
 */
const SHIFT = { warn: { fixedM: 0.1, perMeter: 0.005 }, block: { fixedM: 0.25, perMeter: 0.025 } };
/** A tape that ends farther than 3 σ from its value: the tapes cannot close a zone together. */
const TAPE_CLOSURE_SIGMAS = 3;
/** One short tape sets the scale of the whole zone: under a quarter of the perimeter, say so. */
const SHORT_TAPE_SHARE = 0.25;
/** A fan triangle flatter than this (height over base) turns millimeters of tape into area: not offered. */
const FLAT_TRIANGLE = 0.04;
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

type TapeCheck = { ratio: number; flag: ArSideFlag; centimeters: boolean };

/** A tape against the AR's own length: 3 % warns, 15 % blocks, ~100× is centimeters typed as meters. */
function tapeCheck(meters: number, arMeters: number): TapeCheck {
  const ratio = meters / arMeters;
  const gap = Math.abs(ratio - 1);
  const flag: ArSideFlag = gap > GAP.block ? 'block' : gap > GAP.warn ? 'warn' : 'ok';
  return { ratio, flag, centimeters: ratio >= CENTIMETER_RATIO.min && ratio <= CENTIMETER_RATIO.max };
}

/** Each taped side against its AR length; the scale (for the untaped sides' starting point) is their mean. */
function tapedSides(arMeters: readonly number[], tapes: Readonly<Record<number, number>>) {
  const taped = Object.entries(tapes)
    .map(([key, meters]) => ({ index: Number(key), meters }))
    .filter(({ index, meters }) => Number.isInteger(index) && index >= 0 && index < arMeters.length && Number.isFinite(meters) && meters > 0 && arMeters[index]! > 0)
    .map(({ index, meters }) => ({ index, meters, ...tapeCheck(meters, arMeters[index]!) }));
  const counted = taped.filter((side) => side.flag !== 'block');
  // Weighted by length (audit 15/11): ARCore errs in centimeters, so a short side must not swing the zone.
  const scale = counted.length ? counted.reduce((sum, side) => sum + side.meters, 0) / counted.reduce((sum, side) => sum + arMeters[side.index]!, 0) : 1;
  return { taped, scale, ratios: counted.map((side) => side.ratio) };
}

const planeGap = (plane: readonly PlanePoint[], from: number, to: number) => Math.hypot(plane[to]!.x - plane[from]!.x, plane[to]!.y - plane[from]!.y);

/** Diagonals between two real corners that are not neighbors, checked against the AR's own diagonal. */
function checkedDiagonals(plane: readonly PlanePoint[], diagonals: readonly TapedLength[]): ArDiagonal[] {
  const count = plane.length;
  const neighbors = (from: number, to: number) => Math.abs(from - to) === 1 || Math.abs(from - to) === count - 1;
  return diagonals
    .filter(({ from, to, meters }) => [from, to].every((corner) => Number.isInteger(corner) && corner >= 0 && corner < count) && from !== to && !neighbors(from, to) && Number.isFinite(meters) && meters > 0)
    .map(({ from, to, meters }) => {
      const arMeters = planeGap(plane, from, to);
      const check = tapeCheck(meters, arMeters);
      return { from, to, arMeters, meters, flag: check.flag, ...(check.centimeters ? { centimeters: true as const } : {}) };
    });
}

export type ZoneSolution = { sides: ArSide[]; diagonals: ArDiagonal[]; areaM2: number; problems: ArProblem[] };

type TapeTally = { locked: number; mismatch: boolean; shortShare: boolean };

function tapeProblems(tally: TapeTally, zone: ReturnType<typeof adjustedZone>): ArProblem[] {
  if (tally.mismatch) return ['tape-mismatch'];
  if (!tally.locked) return ['no-tape'];
  const span = diameterM(zone.corners);
  const limit = (bound: { fixedM: number; perMeter: number }) => bound.fixedM + bound.perMeter * span;
  if (!zone.converged || zone.crossed || zone.tapeGapSigmas > TAPE_CLOSURE_SIGMAS || zone.shiftM > limit(SHIFT.block)) return ['tape-contradicts'];
  const problems: ArProblem[] = zone.shiftM > limit(SHIFT.warn) ? ['tape-bends'] : [];
  return tally.shortShare ? [...problems, 'tape-short'] : problems;
}

/** Two tapes (sides or diagonals) whose ratios to the AR differ by more than 15 %: one is wrong. */
const tapesDisagree = (ratios: readonly number[]) => ratios.length > 1 && Math.max(...ratios) / Math.min(...ratios) - 1 > GAP.block;

/**
 * The zone from its flat AR corners and its tapes (José 16/11): every taped side and diagonal is
 * held, and the AR corners move as little as they can (`zoneAdjust`). The measure and a later
 * edit share it.
 */
export function zoneSolutionOf(input: { plane: readonly PlanePoint[]; arMeters: readonly number[]; tapes: Readonly<Record<number, number>>; diagonals: readonly TapedLength[] }): ZoneSolution {
  const { plane, arMeters } = input;
  const count = plane.length;
  const { taped, scale, ratios } = tapedSides(arMeters, input.tapes);
  const diagonals = checkedDiagonals(plane, input.diagonals);
  const locked: TapedLength[] = [
    ...taped.filter((side) => side.flag !== 'block').map((side) => ({ from: side.index, to: (side.index + 1) % count, meters: side.meters })),
    ...diagonals.filter((diagonal) => diagonal.flag !== 'block').map(({ from, to, meters }) => ({ from, to, meters })),
  ];
  const zone = adjustedZone(plane.map((corner) => ({ x: corner.x * scale, y: corner.y * scale })), locked);
  const sides = arMeters.map((meters, index): ArSide => {
    const tape = taped.find((side) => side.index === index);
    if (!tape) return { index, arMeters: meters, meters: rounded(planeGap(zone.corners, index, (index + 1) % count), 2), source: 'escala', flag: 'ok' };
    return { index, arMeters: meters, meters: tape.meters, source: 'wincha', flag: tape.flag, ...(tape.centimeters ? { centimeters: true as const } : {}) };
  });
  const diagonalRatios = diagonals.filter((diagonal) => diagonal.flag !== 'block').map((diagonal) => diagonal.meters / diagonal.arMeters);
  const mismatch = tapesDisagree([...ratios, ...diagonalRatios]) || taped.some((side) => side.flag === 'block') || diagonals.some((diagonal) => diagonal.flag === 'block');
  const tapedMeters = taped.filter((side) => side.flag !== 'block').reduce((sum, side) => sum + arMeters[side.index]!, 0);
  const shortShare = diagonals.length === 0 && tapedMeters < SHORT_TAPE_SHARE * arMeters.reduce((sum, meters) => sum + meters, 0);
  return { sides, diagonals, areaM2: rounded(zone.areaM2, 2), problems: tapeProblems({ locked: taped.length + diagonals.length, mismatch, shortShare }, zone) };
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

const failed = (problems: ArProblem[], readings: number): ArArea => ({ sides: [], diagonals: [], plane: [], areaM2: null, thicknessCm: null, volumeM3: null, readings, problems, canSave: false });

export function arAreaOf(input: ArInput): ArArea {
  const { points, readingsCm } = input;
  if (points.length < MIN_CORNERS) return failed(['few-corners'], readingsCm.length);
  if (!points.every(isFinitePoint)) return failed(['tracking-lost'], readingsCm.length);
  const normal = newellNormal(points);
  const arMeters = points.map((point, index) => distance(point, next(points, index)));
  const plane = planeCornersOf(points);
  const solution = zoneSolutionOf({ plane, arMeters, tapes: input.tapes, diagonals: input.diagonals ?? [] });
  const { sides, diagonals, areaM2 } = solution;
  const problems = shapeProblems(points, normal, arMeters, input.stable);
  if (areaM2 < AREA_LIMITS_M2.min) problems.push('too-small');
  if (areaM2 > AREA_LIMITS_M2.max) problems.push('too-large');
  problems.push(...solution.problems);
  const thicknessCm = thicknessAverage(readingsCm);
  const volumeM3 = thicknessCm === null ? null : rounded((areaM2 * thicknessCm) / CENTI, 3);
  return { sides, diagonals, plane, areaM2, thicknessCm, volumeM3, readings: readingsCm.length, problems, canSave: problems.every(isArWarning) };
}

/** Corner `to`'s neighbors lie almost on the diagonal A–`to`: its triangle is too flat to fix anything. */
function flatFan(plane: readonly PlanePoint[], to: number): boolean {
  const [a, b] = [plane[0]!, plane[to]!];
  const base = planeGap(plane, 0, to);
  const height = (apex: PlanePoint) => Math.abs((b.x - a.x) * (apex.y - a.y) - (b.y - a.y) * (apex.x - a.x)) / base;
  return !(base > 0) || [plane[to - 1]!, plane[(to + 1) % plane.length]!].some((apex) => height(apex) / base < FLAT_TRIANGLE);
}

/** A…Z, then a number: the plan names its corners so a diagonal can be named («A–C»). */
export const arCornerName = (index: number): string => (index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1));

export type ArDiagonalRow = { from: number; to: number; label: string; arMeters: number; meters: number; taped: boolean; flag: ArSideFlag; centimeters?: true };

/**
 * The diagonals offered to tape: a fan from corner A (n − 3 of them). With every side taped they make
 * the zone rigid, so its area comes from the tapes alone. Each row says its AR length and its tape.
 */
export function arDiagonalRows(result: Pick<ArArea, 'plane' | 'diagonals'>): ArDiagonalRow[] {
  const count = result.plane.length;
  if (count < 4) return [];
  return Array.from({ length: count - 3 }, (_, offset) => offset + 2).filter((to) => !flatFan(result.plane, to)).map((to) => {
    const from = 0;
    const taped = result.diagonals.find((diagonal) => Math.min(diagonal.from, diagonal.to) === from && Math.max(diagonal.from, diagonal.to) === to);
    const arMeters = planeGap(result.plane, from, to);
    const label = `Diagonal ${arCornerName(from)}–${arCornerName(to)}`;
    if (!taped) return { from, to, label, arMeters, meters: rounded(arMeters, 2), taped: false, flag: 'ok' as const };
    return { from, to, label, arMeters, meters: taped.meters, taped: true, flag: taped.flag, ...(taped.centimeters ? { centimeters: true as const } : {}) };
  });
}

/** What Portal stores: the area alone (a polygon is not length × width), with the thickness when there is one. */
/** «AR» when no side was taped, «AR + wincha» when one was (José 15/11: the PDF must not claim a tape). */
export function arMethodOf(result: Pick<ArArea, 'sides' | 'diagonals'>): Extract<AreaMethod, 'ar' | 'ar-app'> {
  return result.sides.some((side) => side.source === 'wincha') || result.diagonals.length > 0 ? 'ar-app' : 'ar';
}

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
/** The native close snaps within this, on the floor's plane: the same rule drops a corner marked on the first. */
export const AR_SNAP_M = 0.15;

/** One square meter of floor seen before the first corner: less and the first anchors drift (José 15/11). */
export const AR_SCAN_AREA_M2 = 1;
export const arScanProgress = (floorM2: number | undefined): number => Math.min(1, Math.max(0, (floorM2 ?? 0) / AR_SCAN_AREA_M2));

export type ArAimFrame = { state: string; floor: boolean; distance?: number | null; floorM2?: number; closing?: boolean; closed?: boolean };

/** The guide under the reticle (la-02): scan, then tap the screen; on the first corner, close. */
export function arAimLine(frame: ArAimFrame, corners: number): string {
  if (frame.closed) return 'Zona cerrada: revisa el contorno y toca «Listo», o «Deshacer» para corregir.';
  if (frame.state !== 'tracking') return 'Mueve el teléfono despacio, apuntando al piso.';
  if (!corners && arScanProgress(frame.floorM2) < 1) return 'Mueve el teléfono despacio sobre el piso para escanearlo.';
  if (!frame.floor) return 'Apunta al piso hasta que el círculo se llene.';
  if ((frame.distance ?? 0) > AR_MAX_AIM_M) return 'Acércate: la esquina está a más de 6 m.';
  if (frame.closing) return 'Toca para cerrar la zona';
  return corners >= MIN_CORNERS ? `Toca para marcar la esquina ${corners + 1}, o apunta a la 1 para cerrar` : `Toca la pantalla para marcar la esquina ${corners + 1}`;
}

/** The side being drawn, as it grows while the phone moves. */
export const arLiveLabel = (meters: number | null | undefined): string | null => (meters == null || !Number.isFinite(meters) ? null : `${decimalLabel(meters, 2)} m`);

/**
 * A last corner marked on the first one closes the zone, it is not a side
 * (José 15/11: a 5th corner 4 cm from the 1st blocked the save).
 */
export function closedRing(points: readonly ArPoint[]): ArPoint[] {
  const last = points[points.length - 1];
  const first = points[0];
  if (points.length <= MIN_CORNERS || !last || !first || Math.hypot(last.x - first.x, last.z - first.z) >= AR_SNAP_M) return [...points];
  return points.slice(0, -1);
}

const PROBLEM_LINES: Record<ArProblem, string> = {
  'few-corners': 'Marca al menos tres esquinas.',
  'short-side': 'Dos esquinas están casi en el mismo punto: deshaz la última.',
  crossed: 'Los lados se cruzan: marca las esquinas en orden, dando la vuelta a la zona.',
  degenerate: 'Una esquina quedó sobre otro lado o hace un pico: deshazla y márcala de nuevo.',
  'off-plane': 'Una esquina parece fuera del piso (pared, sardinel o un auto): revisa la foto antes de guardar.',
  'tracking-lost': 'El AR perdió la referencia mientras medías: vuelve a marcar las esquinas.',
  'too-small': 'La zona mide menos de 0,05 m²: revisa las esquinas.',
  'too-large': 'La zona mide más de 5 000 m²: revisa las esquinas o la wincha.',
  'no-tape': 'Sin wincha: el área sale solo del AR. Si mides un lado, la wincha manda.',
  'tape-mismatch': 'La wincha difiere más de 15 % del AR (o dos winchas no coinciden entre sí): revisa los lados o si escribiste centímetros.',
  'tape-bends': 'Las winchas mueven una esquina más de lo que se equivoca el AR: revisa las medidas o mide una diagonal.',
  'tape-contradicts': 'Las winchas y el AR no cuadran: una esquina se movería demasiado o la zona se doblaría. Revisa cada medida.',
  'tape-short': 'Mediste solo un tramo corto: la escala de toda la zona sale de él. Mide también el lado más largo.',
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

/** A side's meters burned on the zone's photo, at its middle, as fractions (0..1) of the frame. */
export type ShotLabel = { x: number; y: number; text: string };
export type ShotCorner = { x: number; y: number; visible: boolean };
export type SummaryChip = { label: string; value: string };

const MAX_SHOT_LABELS = 32;
const SHOT_TEXT = /^[\p{L}\p{N} ·,.²³]{1,24}$/u;
const isFraction = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * José 15/11 («no se muestra el metraje»): like his reference app, each side's FINAL meters
 * (tape-scaled) at the middle of its two corners. A side with a corner off the frame says nothing;
 * a ring that does not match the sides says nothing at all.
 */
export function arShotLabels(corners: readonly ShotCorner[] | undefined, frame: Box, sides: readonly ArSide[]): ShotLabel[] {
  if (!corners || corners.length !== sides.length || corners.length < MIN_CORNERS || frame.width <= 0 || frame.height <= 0) return [];
  return sides.flatMap((side, index) => {
    const at = shotLabelPoint(corners[index]!, next(corners, index), frame);
    if (!at) return [];
    const x = rounded(at.x / frame.width, 4);
    const y = rounded(at.y / frame.height, 4);
    return isFraction(x) && isFraction(y) ? [{ x, y, text: `${index + 1} · ${decimalLabel(side.meters, 2)} m` }] : [];
  });
}

type FramePoint = { x: number; y: number };

/** The native side sends a corner behind the camera as (0, 0) and not visible: it has no place on the photo. */
const behindCamera = (corner: ShotCorner) => !corner.visible && corner.x === 0 && corner.y === 0;
const insideFrame = (point: FramePoint, frame: Box): FramePoint => ({ x: Math.min(Math.max(point.x, 0), frame.width), y: Math.min(Math.max(point.y, 0), frame.height) });
const middleOf = (a: FramePoint, b: FramePoint): FramePoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Where a side's meters go (José 16/11: five corners, only three measures on the photo). A corner off
 * the frame still has its place, so the label sits in the middle of the part of the side that shows;
 * a side wholly off the photo goes to the edge nearest to it; a corner behind the camera leaves the
 * label at the corner that shows. Never nothing while one end can be drawn.
 */
function shotLabelPoint(from: ShotCorner, to: ShotCorner, frame: Box): FramePoint | null {
  const fromBehind = behindCamera(from);
  const toBehind = behindCamera(to);
  if (fromBehind && toBehind) return null;
  if (fromBehind || toBehind) return insideFrame(fromBehind ? to : from, frame);
  const shown = clippedToFrame(from, to, frame);
  return insideFrame(shown ? middleOf(shown[0], shown[1]) : middleOf(from, to), frame);
}

/** The part of the segment inside the frame (Liang–Barsky), or null when none of it is. */
function clippedToFrame(from: FramePoint, to: FramePoint, frame: Box): [FramePoint, FramePoint] | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const edges: [number, number][] = [[-dx, from.x], [dx, frame.width - from.x], [-dy, from.y], [dy, frame.height - from.y]];
  let enter = 0;
  let leave = 1;
  for (const [step, room] of edges) {
    if (step === 0) {
      if (room < 0) return null;
      continue;
    }
    const t = room / step;
    if (step < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
  }
  if (enter > leave) return null;
  return [{ x: from.x + enter * dx, y: from.y + enter * dy }, { x: from.x + leave * dx, y: from.y + leave * dy }];
}

/** The labels as one form field (absent when there are none). */
export const shotLabelsField = (labels: readonly ShotLabel[]): string | undefined => (labels.length ? JSON.stringify(labels.slice(0, MAX_SHOT_LABELS)) : undefined);

/** Back from the form: only sane labels (fractions, short plain text), at most 32. */
export function shotLabelsOf(field: unknown): ShotLabel[] {
  if (typeof field !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(field);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const sane = (label: unknown): label is ShotLabel => {
    const candidate = label as Partial<ShotLabel> | null;
    return Boolean(candidate) && isFraction(candidate?.x) && isFraction(candidate?.y) && typeof candidate?.text === 'string' && SHOT_TEXT.test(candidate.text);
  };
  return parsed.every(sane) ? parsed.slice(0, MAX_SHOT_LABELS).map(({ x, y, text }: ShotLabel) => ({ x, y, text })) : [];
}

export const arPerimeterM = (sides: readonly Pick<ArSide, 'meters'>[]): number => sides.reduce((sum, side) => sum + side.meters, 0);

/** The zone's summary chips: area always, volume only with a thickness, perimeter and sides when known. */
export function arSummaryChips(summary: { areaM2: number; volumeM3: number | null; perimeterM: number | null; sides: number | null }): SummaryChip[] {
  return [
    { label: 'Área', value: `${decimalLabel(summary.areaM2, 2)} m²` },
    ...(summary.volumeM3 !== null ? [{ label: 'Volumen', value: `${decimalLabel(summary.volumeM3, 3)} m³` }] : []),
    ...(summary.perimeterM ? [{ label: 'Perímetro', value: `${decimalLabel(summary.perimeterM, 2)} m` }] : []),
    ...(summary.sides ? [{ label: 'Lados', value: String(summary.sides) }] : []),
  ];
}

/** The AR screen's live chips: the meters traced while drawing, the area once closed. */
export function arLiveChips(frame: { sides?: readonly number[]; live?: number | null; closed?: boolean; areaM2?: number | null }): SummaryChip[] {
  const sides = frame.sides ?? [];
  if (!sides.length) return [];
  if (frame.closed && frame.areaM2) return [{ label: 'Área AR', value: `${decimalLabel(frame.areaM2, 2)} m²` }, { label: 'Lados', value: String(sides.length + 1) }];
  const traced = sides.reduce((sum, side) => sum + side, 0) + (frame.live ?? 0);
  return [{ label: 'Trazado', value: `${decimalLabel(traced, 2)} m` }, { label: 'Esquinas', value: String(sides.length + 1) }];
}

const MAX_PANEL_LINES = 4;

/**
 * The zone's figures in a corner of the photo, like José's reference app (15/11: «no dentro de la
 * figura»): the billed area and the perimeter. Not the volume: the thickness can be edited after
 * the photo is burned, and the photo would then contradict the billed m³ (audit 15/11).
 */
export function arShotPanel(summary: { areaM2: number; perimeterM: number | null }): string[] {
  return arSummaryChips({ ...summary, volumeM3: null, sides: null }).map((chip) => `${chip.label} ${chip.value}`);
}

export const shotPanelField = (lines: readonly string[]): string | undefined => (lines.length ? JSON.stringify(lines.slice(0, MAX_PANEL_LINES)) : undefined);

/** Back from the form: at most 4 short plain lines, or nothing. */
export function shotPanelOf(field: unknown): string[] {
  if (typeof field !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(field);
  } catch {
    return [];
  }
  const sane = Array.isArray(parsed) && parsed.length <= MAX_PANEL_LINES && parsed.every((line) => typeof line === 'string' && SHOT_TEXT.test(line));
  return sane ? (parsed as string[]) : [];
}
