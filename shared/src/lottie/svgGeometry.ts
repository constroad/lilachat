import { roundNumber, roundPoint, staticValue, type LottieBezier, type LottieShapeItem } from './lottieJson.js';
import type { SvgNode } from './svgMarkup.js';
import { arcToCubics, contourToBezier, parsePathData, samePoint, type CubicSegment, type Point, type SvgContour } from './svgPath.js';
import { numberOf } from './svgStyle.js';

/**
 * The shape items (`rc`, `el`, `sh`) of one SVG element, in viewBox units.
 * A rect with round corners and a circle or ellipse use Lottie's own
 * primitives, unless the stroke is dashed: then they are paths that start
 * and turn where SVG starts them, so the dashes fall in the same places. A
 * rect whose corners only fit one way (rx ≠ ry once clamped) is a path too:
 * Lottie's rectangle only has round corners. PURE.
 */
export type ElementGeometry = { items: LottieShapeItem[]; fillable: boolean };
export type RectBox = { left: number; top: number; right: number; bottom: number };
/** Lottie's own direction for a rectangle or ellipse: clockwise. */
const CLOCKWISE = 1;
const POINT_NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

export function pathItem(bezier: LottieBezier): LottieShapeItem {
  return { ty: 'sh', ks: staticValue(bezier) };
}

function lengthOf(node: SvgNode, name: string): number {
  return numberOf(node.attrs[name], 0);
}

/** A length that may be missing or `auto`: null then. */
function optionalLength(node: SvgNode, name: string): number | null {
  const value = Number.parseFloat(node.attrs[name] ?? '');
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function line(from: Point, to: Point): CubicSegment {
  return { c1: from, c2: to, to };
}

/** Straight segments through the points, in order. */
function chain(points: readonly Point[]): CubicSegment[] {
  return points.slice(1).map((point, index) => line(points[index] ?? point, point));
}

/** A quarter of an ellipse, turning clockwise on screen (SVG's sweep flag 1). */
function corner(from: Point, to: Point, radii: Point): CubicSegment[] {
  return arcToCubics({ from, to, radii, degrees: 0, largeArc: false, sweep: true });
}

/** SVG's rect outline: starts at (x + rx, y) and goes clockwise; zero-length sides are left out. */
export function roundedRectContour({ left, top, right, bottom }: RectBox, rx: number, ry: number): SvgContour {
  if (rx === 0 || ry === 0) return { start: [left, top], segments: chain([[left, top], [right, top], [right, bottom], [left, bottom]]), closed: true };
  const points: Point[] = [[left + rx, top], [right - rx, top], [right, top + ry], [right, bottom - ry], [right - rx, bottom], [left + rx, bottom], [left, bottom - ry], [left, top + ry]];
  const segments = points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length] ?? point;
    if (index % 2 === 1) return corner(point, next, [rx, ry]);
    return samePoint(point, next) ? [] : [line(point, next)];
  });
  return { start: points[0] ?? [left, top], segments, closed: true };
}

/** SVG's ellipse outline: starts at (cx + rx, cy) and goes clockwise on screen. */
export function ellipseContour(center: Point, radii: Point): SvgContour {
  const [cx, cy] = center;
  const [rx, ry] = radii;
  const points: Point[] = [[cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]];
  const segments = points.flatMap((point, index) => corner(point, points[(index + 1) % points.length] ?? point, radii));
  return { start: points[0] ?? center, segments, closed: true };
}

function contourItems(contours: SvgContour[]): LottieShapeItem[] {
  return contours.map(contourToBezier).filter((bezier): bezier is LottieBezier => bezier !== null).map(pathItem);
}

/** SVG's corner radii: one fills in for the other, each at most half its side. */
function cornerRadii(node: SvgNode, width: number, height: number): Point {
  const rx = optionalLength(node, 'rx');
  const ry = optionalLength(node, 'ry');
  return [Math.min(rx ?? ry ?? 0, width / 2), Math.min(ry ?? rx ?? 0, height / 2)];
}

function rectGeometry(node: SvgNode, dashed: boolean): LottieShapeItem[] {
  const [x, y, width, height] = [lengthOf(node, 'x'), lengthOf(node, 'y'), lengthOf(node, 'width'), lengthOf(node, 'height')];
  if (width <= 0 || height <= 0) return [];
  const [rx, ry] = cornerRadii(node, width, height);
  if (dashed || rx !== ry) return contourItems([roundedRectContour({ left: x, top: y, right: x + width, bottom: y + height }, rx, ry)]);
  return [{ ty: 'rc', d: CLOCKWISE, p: staticValue(roundPoint([x + width / 2, y + height / 2])), s: staticValue(roundPoint([width, height])), r: staticValue(roundNumber(rx)) }];
}

function ellipseGeometry(center: Point, radii: Point, dashed: boolean): LottieShapeItem[] {
  if (radii[0] <= 0 || radii[1] <= 0) return [];
  if (dashed) return contourItems([ellipseContour(center, radii)]);
  return [{ ty: 'el', d: CLOCKWISE, p: staticValue(roundPoint(center)), s: staticValue(roundPoint([radii[0] * 2, radii[1] * 2])) }];
}

function pointsOf(node: SvgNode): Point[] {
  const numbers = (node.attrs.points ?? '').match(POINT_NUMBER)?.map(Number) ?? [];
  return Array.from({ length: Math.floor(numbers.length / 2) }, (_, index): Point => [numbers[index * 2] ?? 0, numbers[index * 2 + 1] ?? 0]);
}

function polyGeometry(node: SvgNode, closed: boolean): LottieShapeItem[] {
  const points = pointsOf(node);
  const [start] = points;
  return start ? contourItems([{ start, segments: chain(points), closed }]) : [];
}

function lineGeometry(node: SvgNode): LottieShapeItem[] {
  const ends: Point[] = [[lengthOf(node, 'x1'), lengthOf(node, 'y1')], [lengthOf(node, 'x2'), lengthOf(node, 'y2')]];
  return contourItems([{ start: ends[0] ?? [0, 0], segments: chain(ends), closed: false }]);
}

/** SVG2: a missing or `auto` radius takes the other one. */
function ellipseRadii(node: SvgNode): Point {
  const rx = optionalLength(node, 'rx');
  const ry = optionalLength(node, 'ry');
  return [rx ?? ry ?? 0, ry ?? rx ?? 0];
}

/** The element's shape items (empty when it draws nothing); a line never fills. */
export function geometryOf(node: SvgNode, dashed: boolean): ElementGeometry {
  const center: Point = [lengthOf(node, 'cx'), lengthOf(node, 'cy')];
  switch (node.tag) {
    case 'rect': return { items: rectGeometry(node, dashed), fillable: true };
    case 'circle': return { items: ellipseGeometry(center, [lengthOf(node, 'r'), lengthOf(node, 'r')], dashed), fillable: true };
    case 'ellipse': return { items: ellipseGeometry(center, ellipseRadii(node), dashed), fillable: true };
    case 'line': return { items: lineGeometry(node), fillable: false };
    case 'polyline': return { items: polyGeometry(node, false), fillable: true };
    case 'polygon': return { items: polyGeometry(node, true), fillable: true };
    case 'path': return { items: contourItems(parsePathData(node.attrs.d ?? '')), fillable: true };
    default: return { items: [], fillable: false };
  }
}
