import { roundPoint, staticValue, type LottieBezier, type LottiePoint, type LottieShapeItem } from './lottieJson.js';
import { ellipseContour, pathItem, roundedRectContour } from './svgGeometry.js';
import type { SvgNode } from './svgMarkup.js';
import { contourToBezier, type Point } from './svgPath.js';
import { declarationsOf, inheritStyle, INITIAL_STYLE, numberOf, type SvgStyle } from './svgStyle.js';
import { transformItem } from './svgTransform.js';

/**
 * A `<pattern>` fill, which Lottie does not have, spelled out: the pattern's
 * content copied once per tile whose middle falls inside the shape. Copies
 * that share paint go in one group under one fill, so a grill of 250 dots is
 * 250 ellipses, not 250 groups. A tile cut by the shape's edge is kept whole
 * or dropped by its middle (SVG clips it). PURE.
 */
export type ConvertNodes = (nodes: readonly SvgNode[], style: SvgStyle) => LottieShapeItem[];
export type PatternFill = { group: LottieShapeItem | null } | { unsupported: string };
type Bounds = { left: number; top: number; right: number; bottom: number };
type Tile = { x: number; y: number; width: number; height: number };

/** Beyond this the JSON grows past what a sticker should weigh. */
const MAX_PATTERN_TILES = 4000;
const SAMPLES_PER_SEGMENT = 8;
const UNSUPPORTED_ATTRIBUTES = ['patternTransform', 'viewBox', 'href', 'xlink:href'] as const;
const GEOMETRY_TYPES = new Set(['sh', 'rc', 'el']);

/** Every `<pattern id>` among the nodes, at any depth. */
export function collectPatterns(nodes: readonly SvgNode[], found = new Map<string, SvgNode>()): Map<string, SvgNode> {
  for (const node of nodes) {
    if (node.tag === 'pattern' && node.attrs.id) found.set(node.attrs.id, node);
    collectPatterns(node.children, found);
  }
  return found;
}

function pointValue(property: unknown): LottiePoint {
  const [x = 0, y = 0] = (property as { k?: LottiePoint } | undefined)?.k ?? [];
  return [x, y];
}

/** Any geometry item (`sh`, `rc`, `el`) as a path. */
function bezierOfItem(item: LottieShapeItem): LottieBezier | null {
  if (item.ty === 'sh') return (item.ks as { k: LottieBezier }).k;
  const [x, y] = pointValue(item.p);
  const [width, height] = pointValue(item.s);
  if (item.ty === 'el') return contourToBezier(ellipseContour([x, y], [width / 2, height / 2]));
  const radius = Math.min((item.r as { k?: number } | undefined)?.k ?? 0, width / 2, height / 2);
  return contourToBezier(roundedRectContour({ left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 }, radius, radius));
}

function cubicAt(from: Point, c1: Point, c2: Point, to: Point, t: number): Point {
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [weights[0] * from[0] + weights[1] * c1[0] + weights[2] * c2[0] + weights[3] * to[0], weights[0] * from[1] + weights[1] * c1[1] + weights[2] * c2[1] + weights[3] * to[1]];
}

/** The path as a polygon: each segment sampled, the closing one included. */
function flatten({ v, i, o }: LottieBezier): Point[] {
  return v.flatMap((from, index) => {
    const to = v[(index + 1) % v.length] ?? from;
    const [out = [0, 0], into = [0, 0]] = [o[index], i[(index + 1) % v.length]];
    const c1: Point = [from[0] + out[0], from[1] + out[1]];
    const c2: Point = [to[0] + into[0], to[1] + into[1]];
    return Array.from({ length: SAMPLES_PER_SEGMENT }, (_, step) => cubicAt(from, c1, c2, to, step / SAMPLES_PER_SEGMENT));
  });
}

function outlineOf(geometry: readonly LottieShapeItem[]): Point[][] {
  return geometry.map(bezierOfItem).filter((bezier): bezier is LottieBezier => bezier !== null).map(flatten);
}

function boundsOf(outline: readonly Point[][]): Bounds | null {
  const points = outline.flat();
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Nonzero winding over every subpath. */
function insideOutline([x, y]: Point, outline: readonly Point[][]): boolean {
  let winding = 0;
  for (const polygon of outline) {
    polygon.forEach((from, index) => {
      const to = polygon[(index + 1) % polygon.length] ?? from;
      const side = (to[0] - from[0]) * (y - from[1]) - (x - from[0]) * (to[1] - from[1]);
      if (from[1] <= y && to[1] > y && side > 0) winding += 1;
      if (from[1] > y && to[1] <= y && side < 0) winding -= 1;
    });
  }
  return winding !== 0;
}

/** The reference tile, in user space; `objectBoundingBox` (SVG's default) measures it in fractions of the shape. */
function tileOf(pattern: SvgNode, bounds: Bounds): Tile {
  const read = (name: string): number => numberOf(pattern.attrs[name], 0);
  if (pattern.attrs.patternUnits === 'userSpaceOnUse') return { x: read('x'), y: read('y'), width: read('width'), height: read('height') };
  const [boxWidth, boxHeight] = [bounds.right - bounds.left, bounds.bottom - bounds.top];
  return { x: bounds.left + read('x') * boxWidth, y: bounds.top + read('y') * boxHeight, width: read('width') * boxWidth, height: read('height') * boxHeight };
}

/** The top-left corner of every tile whose middle is inside the shape; null when there are too many. */
function tileOrigins(tile: Tile, bounds: Bounds, outline: readonly Point[][]): Point[] | null {
  const columns = [Math.floor((bounds.left - tile.x) / tile.width), Math.ceil((bounds.right - tile.x) / tile.width)] as const;
  const rows = [Math.floor((bounds.top - tile.y) / tile.height), Math.ceil((bounds.bottom - tile.y) / tile.height)] as const;
  if ((columns[1] - columns[0]) * (rows[1] - rows[0]) > MAX_PATTERN_TILES) return null;
  const origins: Point[] = [];
  for (let row = rows[0]; row < rows[1]; row += 1) {
    for (let column = columns[0]; column < columns[1]; column += 1) {
      const origin: Point = [tile.x + column * tile.width, tile.y + row * tile.height];
      if (insideOutline([origin[0] + tile.width / 2, origin[1] + tile.height / 2], outline)) origins.push(origin);
    }
  }
  return origins;
}

function isIdentity(transform: LottieShapeItem | undefined): boolean {
  return JSON.stringify(transform) === JSON.stringify(transformItem(null, 1));
}

function shifted(item: LottieShapeItem, [dx, dy]: Point): LottieShapeItem {
  const move = (point: LottiePoint): LottiePoint => roundPoint([point[0] + dx, point[1] + dy]);
  if (item.ty !== 'sh') return { ...item, p: staticValue(move((item.p as { k: LottiePoint }).k)) };
  const bezier = (item.ks as { k: LottieBezier }).k;
  return pathItem({ ...bezier, v: bezier.v.map(move) });
}

/** One element of the pattern, at every tile: its shapes moved when it has no transform of its own, else one moved group per tile. */
function tiledCopies(element: LottieShapeItem, origins: readonly Point[]): LottieShapeItem[] {
  const items = (element.it ?? []) as LottieShapeItem[];
  const geometry = items.filter((entry) => GEOMETRY_TYPES.has(entry.ty));
  const rest = items.filter((entry) => !GEOMETRY_TYPES.has(entry.ty));
  if (geometry.length > 0 && isIdentity(items.at(-1)) && rest.every((entry) => entry.ty !== 'gr')) {
    return [{ ty: 'gr', it: [...origins.flatMap((origin) => geometry.map((shape) => shifted(shape, origin))), ...rest] }];
  }
  return origins.map((origin) => ({ ty: 'gr', it: [element, transformItem(`translate(${origin[0]} ${origin[1]})`, 1)] }));
}

/** What a pattern attribute this does not follow would change; null when it follows them all. */
function unsupportedReason(pattern: SvgNode): string | null {
  const attribute = UNSUPPORTED_ATTRIBUTES.find((name) => pattern.attrs[name] !== undefined);
  if (attribute) return attribute;
  return pattern.attrs.patternContentUnits === 'objectBoundingBox' ? 'patternContentUnits' : null;
}

/** The pattern spelled out over the shape (null when no tile falls inside it), or why it cannot be. */
export function patternFill(pattern: SvgNode, geometry: readonly LottieShapeItem[], convertNodes: ConvertNodes): PatternFill {
  const reason = unsupportedReason(pattern);
  if (reason) return { unsupported: reason };
  const outline = outlineOf(geometry);
  const bounds = boundsOf(outline);
  if (!bounds) return { group: null };
  const tile = tileOf(pattern, bounds);
  if (tile.width <= 0 || tile.height <= 0) return { group: null };
  const origins = tileOrigins(tile, bounds, outline);
  if (!origins) return { unsupported: 'too many tiles' };
  const content = origins.length > 0 ? convertNodes(pattern.children, inheritStyle(INITIAL_STYLE, declarationsOf(pattern))) : [];
  const copies = content.flatMap((element) => tiledCopies(element, origins));
  return { group: copies.length > 0 ? { ty: 'gr', it: [...copies, transformItem(null, 1)] } : null };
}
