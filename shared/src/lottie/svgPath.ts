import { roundNumber, roundPoint, type LottieBezier } from './lottieJson.js';

/**
 * SVG path data (`d`) → contours of cubic segments → Lottie paths. Every
 * command, absolute and relative: lines, cubics (C, S), quadratics (Q, T,
 * raised to the exact cubic) and arcs (cubics of at most a quarter turn).
 * Parsing stops at the first error, keeping what came before, like SVG. PURE.
 */
export type Point = readonly [number, number];
export type CubicSegment = { c1: Point; c2: Point; to: Point };
export type SvgContour = { start: Point; segments: CubicSegment[]; closed: boolean };

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const COMMAND_LETTER = /[MmLlHhVvCcSsQqTtAaZz]/;
const SEPARATOR = /[\s,]/;
const TWO_THIRDS = 2 / 3;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const DEGREES = 180 / Math.PI;
/** Control distance of a cubic arc, over tan(angle / 4). */
const ARC_TANGENT = 4 / 3;
const ANGLE_EPSILON = 1e-9;

/** Reads a `d` attribute one command letter, number or arc flag at a time. */
class PathScanner {
  private index = 0;

  constructor(private readonly text: string) {}

  private skipSeparators(): void {
    while (SEPARATOR.test(this.text[this.index] ?? '')) this.index += 1;
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.index >= this.text.length;
  }

  command(): string | null {
    this.skipSeparators();
    const letter = this.text[this.index] ?? '';
    if (!COMMAND_LETTER.test(letter)) return null;
    this.index += 1;
    return letter;
  }

  number(): number | null {
    this.skipSeparators();
    NUMBER.lastIndex = this.index;
    const match = NUMBER.exec(this.text);
    if (!match) return null;
    this.index = NUMBER.lastIndex;
    return Number(match[0]);
  }

  /** Arc flags are one digit and may touch the next number: `a10 10 0 0120 0`. */
  flag(): number | null {
    this.skipSeparators();
    const digit = this.text[this.index];
    if (digit !== '0' && digit !== '1') return null;
    this.index += 1;
    return Number(digit);
  }
}

function lerp(from: Point, to: Point, share: number): Point {
  return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
}

/** `control` mirrored through `center`: the first control point of an S or T. */
function reflect(control: Point, center: Point): Point {
  return [2 * center[0] - control[0], 2 * center[1] - control[1]];
}

export function samePoint(first: Point, second: Point): boolean {
  return roundNumber(first[0]) === roundNumber(second[0]) && roundNumber(first[1]) === roundNumber(second[1]);
}

type ArcGeometry = { center: Point; radii: Point; cos: number; sin: number; startAngle: number; sweepAngle: number };
type ArcRequest = { from: Point; to: Point; radii: Point; degrees: number; largeArc: boolean; sweep: boolean };

/** The radii, grown when they do not reach the end point (SVG 1.1, F.6.6). */
function reachingRadii(radii: Point, local: Point): Point {
  const [rx, ry] = [Math.abs(radii[0]), Math.abs(radii[1])];
  const growth = Math.sqrt(Math.max(1, (local[0] / rx) ** 2 + (local[1] / ry) ** 2));
  return [rx * growth, ry * growth];
}

/** SVG's endpoint → center conversion (SVG 1.1, F.6.5). */
function arcGeometry({ from, to, radii, degrees, largeArc, sweep }: ArcRequest): ArcGeometry {
  const [cos, sin] = [Math.cos(degrees / DEGREES), Math.sin(degrees / DEGREES)];
  const [halfX, halfY] = [(from[0] - to[0]) / 2, (from[1] - to[1]) / 2];
  const local: Point = [cos * halfX + sin * halfY, -sin * halfX + cos * halfY];
  const [rx, ry] = reachingRadii(radii, local);
  const [x1, y1] = local;
  const spread = (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1);
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, spread));
  const [centerX, centerY] = [(factor * rx * y1) / ry, (-factor * ry * x1) / rx];
  const center: Point = [cos * centerX - sin * centerY + (from[0] + to[0]) / 2, sin * centerX + cos * centerY + (from[1] + to[1]) / 2];
  const [ux, uy, vx, vy] = [(x1 - centerX) / rx, (y1 - centerY) / ry, (-x1 - centerX) / rx, (-y1 - centerY) / ry];
  let sweepAngle = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && sweepAngle > 0) sweepAngle -= FULL_TURN;
  if (sweep && sweepAngle < 0) sweepAngle += FULL_TURN;
  return { center, radii: [rx, ry], cos, sin, startAngle: Math.atan2(uy, ux), sweepAngle };
}

function onEllipse(arc: ArcGeometry, u: number, v: number): Point {
  const [rx, ry] = arc.radii;
  return [arc.center[0] + rx * arc.cos * u - ry * arc.sin * v, arc.center[1] + rx * arc.sin * u + ry * arc.cos * v];
}

/** An SVG arc as cubics of at most a quarter turn each; nothing when it ends where it starts, a line when a radius is 0. */
export function arcToCubics(request: ArcRequest): CubicSegment[] {
  const { from, to, radii } = request;
  if (samePoint(from, to)) return [];
  if (radii[0] === 0 || radii[1] === 0) return [{ c1: from, c2: to, to }];
  const arc = arcGeometry(request);
  const count = Math.max(1, Math.ceil(Math.abs(arc.sweepAngle) / QUARTER_TURN - ANGLE_EPSILON));
  const step = arc.sweepAngle / count;
  const tangent = ARC_TANGENT * Math.tan(step / 4);
  return Array.from({ length: count }, (_, index) => {
    const [start, end] = [arc.startAngle + index * step, arc.startAngle + (index + 1) * step];
    return {
      c1: onEllipse(arc, Math.cos(start) - tangent * Math.sin(start), Math.sin(start) + tangent * Math.cos(start)),
      c2: onEllipse(arc, Math.cos(end) + tangent * Math.sin(end), Math.sin(end) - tangent * Math.cos(end)),
      to: index === count - 1 ? to : onEllipse(arc, Math.cos(end), Math.sin(end)),
    };
  });
}

/** Builds the contours while the commands play: current point, subpath start, last control points. */
class ContourBuilder {
  readonly contours: SvgContour[] = [];
  point: Point = [0, 0];
  private start: Point = [0, 0];
  private current: SvgContour | null = null;
  /** The previous command's second cubic control point (for S) or quadratic control point (for T). */
  private lastCubic: Point | null = null;
  private lastQuadratic: Point | null = null;

  resolve(x: number, y: number, relative: boolean): Point {
    return relative ? [this.point[0] + x, this.point[1] + y] : [x, y];
  }

  moveTo(point: Point): void {
    this.current = { start: point, segments: [], closed: false };
    this.contours.push(this.current);
    [this.start, this.point] = [point, point];
    [this.lastCubic, this.lastQuadratic] = [null, null];
  }

  /** After a Z, a drawing command opens the next subpath at the same start point. */
  private push(segment: CubicSegment): void {
    if (!this.current) this.moveTo(this.point);
    this.current?.segments.push(segment);
    this.point = segment.to;
    [this.lastCubic, this.lastQuadratic] = [null, null];
  }

  lineTo(point: Point): void {
    this.push({ c1: this.point, c2: point, to: point });
  }

  cubicTo(c1: Point, c2: Point, to: Point): void {
    this.push({ c1, c2, to });
    this.lastCubic = c2;
  }

  smoothCubicTo(c2: Point, to: Point): void {
    this.cubicTo(this.lastCubic ? reflect(this.lastCubic, this.point) : this.point, c2, to);
  }

  quadraticTo(control: Point, to: Point): void {
    this.push({ c1: lerp(this.point, control, TWO_THIRDS), c2: lerp(to, control, TWO_THIRDS), to });
    this.lastQuadratic = control;
  }

  smoothQuadraticTo(to: Point): void {
    this.quadraticTo(this.lastQuadratic ? reflect(this.lastQuadratic, this.point) : this.point, to);
  }

  arcTo(request: Omit<ArcRequest, 'from'>): void {
    for (const segment of arcToCubics({ ...request, from: this.point })) this.push(segment);
    [this.lastCubic, this.lastQuadratic] = [null, null];
  }

  close(): void {
    if (this.current) this.current.closed = true;
    this.current = null;
    this.point = this.start;
    [this.lastCubic, this.lastQuadratic] = [null, null];
  }
}

/** `n` a number, `f` an arc flag. */
type CommandSpec = { arguments: string; apply: (path: ContourBuilder, values: readonly number[], relative: boolean) => void };
const COMMANDS: Readonly<Record<string, CommandSpec>> = {
  m: { arguments: 'nn', apply: (path, [x = 0, y = 0], relative) => path.moveTo(path.resolve(x, y, relative)) },
  l: { arguments: 'nn', apply: (path, [x = 0, y = 0], relative) => path.lineTo(path.resolve(x, y, relative)) },
  h: { arguments: 'n', apply: (path, [x = 0], relative) => path.lineTo([relative ? path.point[0] + x : x, path.point[1]]) },
  v: { arguments: 'n', apply: (path, [y = 0], relative) => path.lineTo([path.point[0], relative ? path.point[1] + y : y]) },
  c: {
    arguments: 'nnnnnn',
    apply: (path, [x1 = 0, y1 = 0, x2 = 0, y2 = 0, x = 0, y = 0], relative) => path.cubicTo(path.resolve(x1, y1, relative), path.resolve(x2, y2, relative), path.resolve(x, y, relative)),
  },
  s: { arguments: 'nnnn', apply: (path, [x2 = 0, y2 = 0, x = 0, y = 0], relative) => path.smoothCubicTo(path.resolve(x2, y2, relative), path.resolve(x, y, relative)) },
  q: { arguments: 'nnnn', apply: (path, [x1 = 0, y1 = 0, x = 0, y = 0], relative) => path.quadraticTo(path.resolve(x1, y1, relative), path.resolve(x, y, relative)) },
  t: { arguments: 'nn', apply: (path, [x = 0, y = 0], relative) => path.smoothQuadraticTo(path.resolve(x, y, relative)) },
  a: {
    arguments: 'nnnffnn',
    apply: (path, [rx = 0, ry = 0, degrees = 0, largeArc = 0, sweep = 0, x = 0, y = 0], relative) =>
      path.arcTo({ radii: [rx, ry], degrees, largeArc: largeArc === 1, sweep: sweep === 1, to: path.resolve(x, y, relative) }),
  },
  z: { arguments: '', apply: (path) => path.close() },
};

function readArguments(scanner: PathScanner, kinds: string): number[] | null {
  const values: number[] = [];
  for (const kind of kinds) {
    const value = kind === 'f' ? scanner.flag() : scanner.number();
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

/** The next command: a new letter, or the same one repeated (pairs after M are L); null at the end or on an error. */
function nextCommand(scanner: PathScanner, previous: string): string | null {
  if (scanner.atEnd()) return null;
  const letter = scanner.command();
  if (letter) return letter;
  if (previous === 'z' || previous === 'Z') return null;
  if (previous === 'M') return 'L';
  return previous === 'm' ? 'l' : previous;
}

export function parsePathData(data: string): SvgContour[] {
  const scanner = new PathScanner(data);
  const path = new ContourBuilder();
  let command = scanner.command();
  if (command !== 'M' && command !== 'm') return [];
  while (command) {
    const spec = COMMANDS[command.toLowerCase()];
    const values = spec ? readArguments(scanner, spec.arguments) : null;
    if (!spec || !values) break;
    spec.apply(path, values, command !== command.toUpperCase());
    command = nextCommand(scanner, command);
  }
  return path.contours;
}

function minus(point: Point, origin: Point): Point {
  return [point[0] - origin[0], point[1] - origin[1]];
}

/** A contour as a Lottie path; a closed one that ends on its start does not repeat that vertex. Null without segments. */
export function contourToBezier({ start, segments, closed }: SvgContour): LottieBezier | null {
  if (segments.length === 0) return null;
  const vertices: Point[] = [start];
  const inTangents: Point[] = [[0, 0]];
  const outTangents: Point[] = [];
  let from = start;
  for (const { c1, c2, to } of segments) {
    outTangents.push(minus(c1, from));
    vertices.push(to);
    inTangents.push(minus(c2, to));
    from = to;
  }
  outTangents.push([0, 0]);
  if (closed && samePoint(start, from)) {
    inTangents[0] = inTangents.pop() ?? [0, 0];
    vertices.pop();
    outTangents.pop();
  }
  return { v: vertices.map(roundPoint), i: inTangents.map(roundPoint), o: outTangents.map(roundPoint), c: closed };
}
