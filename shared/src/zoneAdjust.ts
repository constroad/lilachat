/**
 * A zone's sides locked by the tape (José 16/11: let him correct a measure after measuring and
 * recompute; the way magicplan locks a wall). It is solved by least squares under the AR's real
 * errors: every AR corner is off by a few centimeters (José's tapes: 5 to 10 cm) and the whole
 * drawing may be off in scale. So the unknowns are the true corners and one scale, and:
 *   - each AR corner, times the scale, is where its true corner should be (σ 5 cm);
 *   - each taped length (side or diagonal) is a tape (σ 2 mm + 0.05 %).
 * The zone moves its corners as little as the tapes allow, and `shiftM` says how far the
 * farthest one had to go: past a few centimeters, the tapes and the AR disagree. PURE.
 * (An earlier model held the AR's ANGLES stiff; the audit of 16/11 showed two tapes on opposite
 * sides could then stretch the untaped ones 20 % in silence.)
 */
export type PlanePoint = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };
/** A length measured with the tape between two corners: a side (i, i+1) or a diagonal. */
export type TapedLength = { from: number; to: number; meters: number };
/**
 * `shiftM`: the farthest a corner moved from the AR's (scaled) corner. `tapeGapM`: the farthest a
 * taped length ended from its tape, and `tapeGapSigmas` the same in its tape's own σ (a 36 m tape
 * may end a centimeter off; a 2 m one may not). `crossed`: the solved corners make sides that cross.
 */
export type AdjustedZone = { corners: PlanePoint[]; areaM2: number; scale: number; shiftM: number; tapeGapM: number; tapeGapSigmas: number; crossed: boolean; converged: boolean };

const CORNER_SIGMA_M = 0.05;
const TAPE_SIGMA = { fixedM: 0.002, relative: 0.0005 };
/** Only to keep the scale defined with no tape at all: far too weak to change it otherwise. */
const SCALE_PRIOR_SIGMA = 10;
const MAX_ITERATIONS = 60;
const MAX_HALVINGS = 20;
const CONVERGED_M = 1e-10;
const SHORTEST_SIDE_M = 0.001;

const nextIndex = (index: number, count: number) => (index + 1) % count;
const gap = (corners: readonly PlanePoint[], from: number, to: number) => Math.hypot(corners[to]!.x - corners[from]!.x, corners[to]!.y - corners[from]!.y);
/** Newell's normal: twice the polygon's vector area, for any plane and either winding. */
export function newellNormal(points: readonly Vector3[]): Vector3 {
  return points.reduce((sum, point, index) => {
    const after = points[nextIndex(index, points.length)]!;
    return { x: sum.x + (point.y - after.y) * (point.z + after.z), y: sum.y + (point.z - after.z) * (point.x + after.x), z: sum.z + (point.x - after.x) * (point.y + after.y) };
  }, { x: 0, y: 0, z: 0 });
}

const unit = (vector: Vector3): Vector3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const minus = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * The AR corners laid flat on their own plane, the first at (0, 0) and the first side along x:
 * what the zone keeps to be corrected later, with its real lengths (a slope is not its shadow).
 */
export function planeCornersOf(points: readonly Vector3[]): PlanePoint[] {
  if (points.length < 2) return points.map(() => ({ x: 0, y: 0 }));
  const normal = unit(newellNormal(points));
  const origin = points[0]!;
  const along = minus(points[1]!, origin);
  const first = unit(minus(along, { x: normal.x * dot(along, normal), y: normal.y * dot(along, normal), z: normal.z * dot(along, normal) }));
  const second = cross(normal, first);
  return points.map((point) => {
    const offset = minus(point, origin);
    return { x: dot(offset, first) + 0, y: dot(offset, second) + 0 };
  });
}

/** The shoelace area, whichever way the corners go round. */
export function polygonAreaM2(corners: readonly PlanePoint[]): number {
  const twice = corners.reduce((sum, corner, index) => {
    const after = corners[nextIndex(index, corners.length)]!;
    return sum + corner.x * after.y - after.x * corner.y;
  }, 0);
  return Math.abs(twice) / 2;
}

type Row = { coefficients: Map<number, number>; residual: number; weight: number };
/** The unknowns: each corner's x and y, then the scale at the end. */
type State = { corners: PlanePoint[]; scale: number };

const pairKey = (tape: TapedLength) => `${Math.min(tape.from, tape.to)}-${Math.max(tape.from, tape.to)}`;
export const tapeSigma = (meters: number) => TAPE_SIGMA.fixedM + TAPE_SIGMA.relative * meters;

/** Tapes between two real, different corners, with a length; the last one of a pair wins. */
function usableTapes(tapes: readonly TapedLength[], count: number): TapedLength[] {
  const valid = tapes.filter((tape) => [tape.from, tape.to].every((corner) => Number.isInteger(corner) && corner >= 0 && corner < count) && tape.from !== tape.to && Number.isFinite(tape.meters) && tape.meters > 0);
  return [...new Map(valid.map((tape) => [pairKey(tape), tape])).values()];
}

function tapeRow(corners: readonly PlanePoint[], tape: TapedLength): Row {
  const { from, to, meters } = tape;
  const length = gap(corners, from, to);
  const [ux, uy] = [(corners[to]!.x - corners[from]!.x) / length, (corners[to]!.y - corners[from]!.y) / length];
  const coefficients = new Map([[2 * to, ux], [2 * to + 1, uy], [2 * from, -ux], [2 * from + 1, -uy]]);
  return { coefficients, residual: meters - length, weight: 1 / tapeSigma(meters) ** 2 };
}

/** Each true corner against the AR's corner times the scale (both coordinates). */
function cornerRows(state: State, prior: readonly PlanePoint[]): Row[] {
  const scaleAt = 2 * prior.length;
  const weight = 1 / CORNER_SIGMA_M ** 2;
  return prior.flatMap((seen, index): Row[] => [
    { coefficients: new Map([[2 * index, 1], [scaleAt, -seen.x]]), residual: state.scale * seen.x - state.corners[index]!.x, weight },
    { coefficients: new Map([[2 * index + 1, 1], [scaleAt, -seen.y]]), residual: state.scale * seen.y - state.corners[index]!.y, weight },
  ]);
}

function rowsAt(state: State, prior: readonly PlanePoint[], tapes: readonly TapedLength[]): Row[] {
  const scaleRow: Row = { coefficients: new Map([[2 * prior.length, 1]]), residual: 1 - state.scale, weight: 1 / SCALE_PRIOR_SIGMA ** 2 };
  return [...cornerRows(state, prior), ...tapes.map((tape) => tapeRow(state.corners, tape)), scaleRow];
}

const costOf = (rows: readonly Row[]) => rows.reduce((sum, row) => sum + row.weight * row.residual ** 2, 0);

/** Gaussian elimination with partial pivoting; null when the system has no single answer. */
function solved(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    const pivot = rows.slice(column).reduce((best, row, offset) => (Math.abs(row[column]!) > Math.abs(rows[best]![column]!) ? column + offset : best), column);
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const lead = rows[column]![column]!;
    if (!Number.isFinite(lead) || Math.abs(lead) < 1e-300) return null;
    for (let below = column + 1; below < size; below += 1) {
      const factor = rows[below]![column]! / lead;
      for (let entry = column; entry <= size; entry += 1) rows[below]![entry]! -= factor * rows[column]![entry]!;
    }
  }
  const answer = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    const known = rows[row]!.slice(row + 1, size).reduce((sum, value, offset) => sum + value * answer[row + 1 + offset]!, 0);
    answer[row] = (rows[row]![size]! - known) / rows[row]![row]!;
  }
  return answer.every(Number.isFinite) ? answer : null;
}

/** One Gauss-Newton step: the normal equations of the weighted rows. */
function step(rows: readonly Row[], size: number): number[] | null {
  const normal = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const right = new Array<number>(size).fill(0);
  rows.forEach(({ coefficients, residual, weight }) => {
    coefficients.forEach((first, i) => {
      right[i]! += weight * first * residual;
      coefficients.forEach((second, j) => { normal[i]![j]! += weight * first * second; });
    });
  });
  return solved(normal, right);
}

const isDegenerate = (corners: readonly PlanePoint[]) => corners.length < 3 || corners.some((_, index) => !(gap(corners, index, nextIndex(index, corners.length)) >= SHORTEST_SIDE_M));
const moved = (state: State, change: readonly number[], factor: number): State => ({
  corners: state.corners.map((corner, index) => ({ x: corner.x + factor * change[2 * index]!, y: corner.y + factor * change[2 * index + 1]! })),
  scale: state.scale + factor * change[change.length - 1]!,
});

/** A step that does not lower the cost is halved (the tapes can pull hard on a flat triangle). */
function nextState(state: State, prior: readonly PlanePoint[], tapes: readonly TapedLength[]): { state: State; size: number } | null {
  const rows = rowsAt(state, prior, tapes);
  const change = step(rows, 2 * prior.length + 1);
  if (!change) return null;
  const cost = costOf(rows);
  for (let halving = 0, factor = 1; halving < MAX_HALVINGS; halving += 1, factor /= 2) {
    const candidate = moved(state, change, factor);
    if (!isDegenerate(candidate.corners) && costOf(rowsAt(candidate, prior, tapes)) <= cost) return { state: candidate, size: factor * Math.max(...change.map(Math.abs)) };
  }
  return { state, size: 0 };
}

const turn = (a: PlanePoint, b: PlanePoint, c: PlanePoint) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const segmentsCross = (a: PlanePoint, b: PlanePoint, c: PlanePoint, d: PlanePoint) => turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0;

/** Two sides that are not neighbors cross: the solved zone folded over itself. */
export function isCrossedPolygon(corners: readonly PlanePoint[]): boolean {
  const count = corners.length;
  for (let first = 0; first < count; first += 1) {
    for (let second = first + 2; second < count; second += 1) {
      if (first === 0 && second === count - 1) continue;
      if (segmentsCross(corners[first]!, corners[nextIndex(first, count)]!, corners[second]!, corners[nextIndex(second, count)]!)) return true;
    }
  }
  return false;
}

/** The widest span between two corners: the AR drifts with distance, so limits grow with it. */
export function diameterM(corners: readonly PlanePoint[]): number {
  return Math.max(0, ...corners.flatMap((corner, index) => corners.slice(index + 1).map((other) => Math.hypot(other.x - corner.x, other.y - corner.y))));
}

const signedTwiceArea = (corners: readonly PlanePoint[]) => corners.reduce((sum, corner, index) => {
  const after = corners[nextIndex(index, corners.length)]!;
  return sum + corner.x * after.y - after.x * corner.y;
}, 0);

function finished(state: State, prior: readonly PlanePoint[], tapes: readonly TapedLength[]): AdjustedZone {
  const { corners, scale } = state;
  const shiftM = Math.max(...corners.map((corner, index) => Math.hypot(corner.x - scale * prior[index]!.x, corner.y - scale * prior[index]!.y)));
  const gaps = tapes.map((tape) => Math.abs(gap(corners, tape.from, tape.to) - tape.meters));
  const tapeGapM = Math.max(0, ...gaps);
  const tapeGapSigmas = Math.max(0, ...gaps.map((one, index) => one / tapeSigma(tapes[index]!.meters)));
  // Turned inside out (the other winding) is a fold too, even when no two sides cross.
  const crossed = isCrossedPolygon(corners) || Math.sign(signedTwiceArea(corners)) !== Math.sign(signedTwiceArea(prior));
  return { corners, areaM2: polygonAreaM2(corners), scale, shiftM, tapeGapM, tapeGapSigmas, crossed, converged: true };
}

/** The zone the tapes and the AR agree on best; `prior` is the AR's corners on their plane. */
export function adjustedZone(prior: readonly PlanePoint[], tapes: readonly TapedLength[]): AdjustedZone {
  const usable = usableTapes(tapes, prior.length);
  const asCame: AdjustedZone = { corners: prior.map((corner) => ({ ...corner })), areaM2: polygonAreaM2(prior), scale: 1, shiftM: 0, tapeGapM: 0, tapeGapSigmas: 0, crossed: false, converged: false };
  if (isDegenerate(prior) || !Number.isFinite(asCame.areaM2)) return { ...asCame, areaM2: Number.isFinite(asCame.areaM2) ? asCame.areaM2 : 0 };
  let state: State = { corners: asCame.corners, scale: 1 };
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const next = nextState(state, prior, usable);
    if (!next) return asCame;
    state = next.state;
    if (next.size < CONVERGED_M) return finished(state, prior, usable);
  }
  return asCame;
}
