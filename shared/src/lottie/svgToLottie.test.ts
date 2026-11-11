import { describe, expect, it } from 'vitest';
import type { LottieShapeItem } from './lottieJson.js';
import { svgToLottieShapes } from './svgToLottie.js';

type Pair = [number, number];
type Bezier = { i: Pair[]; o: Pair[]; v: Pair[]; c: boolean };

function convert(markup: string, defs?: string): { shapes: LottieShapeItem[]; skipped: string[] } {
  return svgToLottieShapes(markup, { defs });
}
/** The single element group a one-element markup gives. */
function groupOf(markup: string): LottieShapeItem {
  const { shapes } = convert(markup);
  expect(shapes).toHaveLength(1);
  return shapes[0]!;
}
function itemsOf(group: LottieShapeItem): LottieShapeItem[] {
  return group.it as LottieShapeItem[];
}
function itemOf(group: LottieShapeItem, ty: string): LottieShapeItem | undefined {
  return itemsOf(group).find((entry) => entry.ty === ty);
}
function valueOf<T>(property: unknown): T {
  return (property as { a: number; k: T }).k;
}
function bezierOf(shape: LottieShapeItem): Bezier {
  return (shape.ks as { k: Bezier }).k;
}
function bezierShapes(group: LottieShapeItem): Bezier[] {
  return itemsOf(group).filter((entry) => entry.ty === 'sh').map(bezierOf);
}
/** The bytes a player that truncates (lottie-web, lottie-android) and one that rounds get from a Lottie color. */
function bytesOf(color: number[]): { floor: number[]; round: number[] } {
  return { floor: color.slice(0, 3).map((unit) => Math.floor(unit * 255)), round: color.slice(0, 3).map((unit) => Math.round(unit * 255)) };
}
function cubicAt(from: Pair, c1: Pair, c2: Pair, to: Pair, t: number): Pair {
  const u = 1 - t;
  const at = (axis: 0 | 1): number => u * u * u * from[axis] + 3 * u * u * t * c1[axis] + 3 * u * t * t * c2[axis] + t * t * t * to[axis];
  return [at(0), at(1)];
}
/** The middle point of every segment of a bezier, its tangents being relative to the vertices. */
function segmentMiddles(bezier: Bezier): Pair[] {
  const count = bezier.c ? bezier.v.length : bezier.v.length - 1;
  return Array.from({ length: count }, (_, index) => {
    const from = bezier.v[index]!;
    const next = (index + 1) % bezier.v.length;
    const to = bezier.v[next]!;
    const c1: Pair = [from[0] + bezier.o[index]![0], from[1] + bezier.o[index]![1]];
    const c2: Pair = [to[0] + bezier.i[next]![0], to[1] + bezier.i[next]![1]];
    return cubicAt(from, c1, c2, to, 0.5);
  });
}
function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
function turn([x, y]: Pair, angle: number): Pair {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}
/**
 * Where lottie-web puts a point under a group transform: anchor, scale, skew
 * (rotate by `sa`, shear x by tan(−sk)·y, rotate back), rotation, position.
 * Mirrors `TransformProperty.processKeys` and `Matrix.skewFromAxis`.
 */
function applyLottieTransform(transform: LottieShapeItem, [x, y]: Pair): Pair {
  const [anchorX, anchorY] = valueOf<Pair>(transform.a);
  const [scaleX, scaleY] = valueOf<Pair>(transform.s);
  const skew = radians(transform.sk ? valueOf<number>(transform.sk) : 0);
  const skewAxis = radians(transform.sa ? valueOf<number>(transform.sa) : 0);
  let point: Pair = [((x - anchorX) * scaleX) / 100, ((y - anchorY) * scaleY) / 100];
  point = turn(point, skewAxis);
  point = [point[0] + Math.tan(-skew) * point[1], point[1]];
  point = turn(turn(point, -skewAxis), radians(valueOf<number>(transform.r)));
  const [positionX, positionY] = valueOf<Pair>(transform.p);
  return [point[0] + positionX, point[1] + positionY];
}
function expectPointClose(actual: Pair, expected: Pair, digits = 2): void {
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
}

describe('svgToLottieShapes: basic shapes', () => {
  it('a rect becomes a group of rectangle, stroke, fill and transform (center, size, corner radius)', () => {
    const group = groupOf('<rect x="74" y="244" width="22" height="36" rx="6" fill="#f472b6" stroke="#1e1b4b" stroke-width="3"></rect>');
    expect(group.ty).toBe('gr');
    expect(itemsOf(group).map((entry) => entry.ty)).toEqual(['rc', 'st', 'fl', 'tr']);
    const rect = itemOf(group, 'rc')!;
    expect(valueOf(rect.p)).toEqual([85, 262]);
    expect(valueOf(rect.s)).toEqual([22, 36]);
    expect(valueOf(rect.r)).toBe(6);
    expect(valueOf(itemOf(group, 'st')!.w)).toBe(3);
  });

  it('a circle and an ellipse become Lottie ellipses (size = diameters)', () => {
    expect(valueOf(itemOf(groupOf('<circle cx="10" cy="20" r="5" fill="#000000"/>'), 'el')!.s)).toEqual([10, 10]);
    const ellipse = itemOf(groupOf('<ellipse cx="100" cy="182" rx="68" ry="8" fill="#e2e8f0"></ellipse>'), 'el')!;
    expect(valueOf(ellipse.p)).toEqual([100, 182]);
    expect(valueOf(ellipse.s)).toEqual([136, 16]);
  });

  it('a corner radius that only fits one way gives elliptical corners as a path, like SVG clamps rx and ry apart', () => {
    const group = groupOf('<rect x="0" y="0" width="40" height="6" rx="4" fill="#0f172a"/>');
    expect(itemOf(group, 'rc')).toBeUndefined();
    const [bezier] = bezierShapes(group);
    expect(bezier!.c).toBe(true);
    expect(bezier!.v[0]).toEqual([4, 0]);
    expect(bezier!.v).toContainEqual([40, 3]);
    expect(bezier!.v).toContainEqual([0, 3]);
  });

  it('rx and ry fill in for each other and never pass half the side', () => {
    expect(valueOf(itemOf(groupOf('<rect width="20" height="10" ry="3" fill="#000"/>'), 'rc')!.r)).toBe(3);
    expect(valueOf(itemOf(groupOf('<rect width="10" height="10" rx="8" fill="#000"/>'), 'rc')!.r)).toBe(5);
    expect(valueOf(itemOf(groupOf('<rect width="10" height="10" fill="#000"/>'), 'rc')!.r)).toBe(0);
  });

  it('a line is an open two-point path and is never filled, even without fill="none"', () => {
    const group = groupOf('<line x1="0" y1="0" x2="10" y2="5" stroke="#000000" stroke-width="2"></line>');
    expect(itemsOf(group).map((entry) => entry.ty)).toEqual(['sh', 'st', 'tr']);
    expect(bezierShapes(group)[0]).toEqual({ v: [[0, 0], [10, 5]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false });
  });

  it('a polygon closes and a polyline stays open (and still fills black by default)', () => {
    expect(bezierShapes(groupOf('<polygon points="94,178 106,178 102,170 98,170" fill="#0284c7"/>'))[0]!.c).toBe(true);
    const polyline = groupOf('<polyline points="0 0, 10 0 10 10" stroke="#000"/>');
    expect(bezierShapes(polyline)[0]).toMatchObject({ v: [[0, 0], [10, 0], [10, 10]], c: false });
    expect(itemOf(polyline, 'fl')).toBeDefined();
  });

  it('nothing is drawn for an empty markup, a zero-size shape or a shape without paint', () => {
    expect(convert('')).toEqual({ shapes: [], skipped: [] });
    expect(convert('<rect width="0" height="10"/><circle r="0"/><ellipse rx="3" ry="0"/><polygon points="1 1"/>').shapes).toEqual([]);
    expect(convert('<rect width="10" height="10" fill="none"/>').shapes).toEqual([]);
  });
});

describe('svgToLottieShapes: paint', () => {
  it('a missing fill is black, fill="none" gives no fill and there is no stroke by default', () => {
    const group = groupOf('<circle cx="1" cy="1" r="1"/>');
    expect(itemsOf(group).map((entry) => entry.ty)).toEqual(['el', 'fl', 'tr']);
    expect(valueOf(itemOf(group, 'fl')!.c)).toEqual([0, 0, 0, 1]);
    expect(itemOf(groupOf('<circle r="1" fill="none" stroke="#000"/>'), 'fl')).toBeUndefined();
  });

  it('colors are 0–1 and land on the same byte in players that truncate and players that round', () => {
    const fill = valueOf<number[]>(itemOf(groupOf('<circle r="1" fill="#f472b6"/>'), 'fl')!.c);
    expect(fill[3]).toBe(1);
    expect(bytesOf(fill)).toEqual({ floor: [244, 114, 182], round: [244, 114, 182] });
    expect(bytesOf(valueOf<number[]>(itemOf(groupOf('<circle r="1" fill="#abc"/>'), 'fl')!.c)).floor).toEqual([170, 187, 204]);
    expect(bytesOf(valueOf<number[]>(itemOf(groupOf('<circle r="1" fill="white"/>'), 'fl')!.c)).floor).toEqual([255, 255, 255]);
    expect(bytesOf(valueOf<number[]>(itemOf(groupOf('<circle r="1" fill="black"/>'), 'fl')!.c)).floor).toEqual([0, 0, 0]);
  });

  it('transparent paints nothing and an unknown color is reported, not guessed', () => {
    expect(convert('<circle r="1" fill="transparent"/>')).toEqual({ shapes: [], skipped: [] });
    const { shapes, skipped } = convert('<circle r="1" fill="chartreuse" stroke="#000"/>');
    expect(itemOf(shapes[0]!, 'fl')).toBeUndefined();
    expect(skipped).toEqual(['fill=chartreuse']);
  });

  it('stroke: width, caps, joins and miter limit, always written (lottie-web would default them to round)', () => {
    const plain = itemOf(groupOf('<path d="M0 0 L10 0" fill="none" stroke="#1e1b4b"/>'), 'st')!;
    expect(plain).toMatchObject({ lc: 1, lj: 1, ml: 4 });
    expect(valueOf(plain.w)).toBe(1);
    expect(valueOf(plain.o)).toBe(100);
    const styled = itemOf(groupOf('<path d="M0 0 L10 0" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="10"/>'), 'st')!;
    expect(styled).toMatchObject({ lc: 2, lj: 3, ml: 10 });
    expect(itemOf(groupOf('<path d="M0 0 L10 0" stroke="#000" stroke-linecap="square" stroke-linejoin="round"/>'), 'st')).toMatchObject({ lc: 3, lj: 2 });
  });

  it('a zero stroke width paints no stroke', () => {
    expect(itemOf(groupOf('<rect width="5" height="5" fill="#000" stroke="#000" stroke-width="0"/>'), 'st')).toBeUndefined();
  });

  it('opacity goes on the group, fill-opacity and stroke-opacity on their paint (0–100)', () => {
    const group = groupOf('<ellipse cx="5" cy="5" rx="4" ry="2" fill="#ffffff" fill-opacity="0.5" stroke="#000" stroke-opacity="25%" opacity="0.4"/>');
    expect(valueOf(itemOf(group, 'fl')!.o)).toBe(50);
    expect(valueOf(itemOf(group, 'st')!.o)).toBe(25);
    expect(valueOf(itemOf(group, 'tr')!.o)).toBe(40);
  });

  it('stroke paints over fill, unless paint-order puts the stroke first', () => {
    expect(itemsOf(groupOf('<rect width="5" height="5" fill="#000" stroke="#fff"/>')).map((entry) => entry.ty)).toEqual(['rc', 'st', 'fl', 'tr']);
    expect(itemsOf(groupOf('<rect width="5" height="5" fill="#000" stroke="#fff" paint-order="stroke fill"/>')).map((entry) => entry.ty)).toEqual(['rc', 'fl', 'st', 'tr']);
  });

  it('fill-rule evenodd is kept (r: 2); the default is nonzero (r: 1)', () => {
    expect(itemOf(groupOf('<path d="M0 0 H10 V10 Z"/>'), 'fl')!.r).toBe(1);
    expect(itemOf(groupOf('<path d="M0 0 H10 V10 Z" fill-rule="evenodd"/>'), 'fl')!.r).toBe(2);
  });

  it('a style attribute wins over the presentation attributes', () => {
    const group = groupOf('<rect width="5" height="5" fill="#ff0000" stroke="#000" style="fill: #00ff00; stroke-width:4"/>');
    expect(bytesOf(valueOf<number[]>(itemOf(group, 'fl')!.c)).floor).toEqual([0, 255, 0]);
    expect(valueOf(itemOf(group, 'st')!.w)).toBe(4);
  });

  it('stroke-dasharray becomes dashes (an odd list repeats, like SVG) and a dashed circle starts where SVG starts it', () => {
    const group = groupOf('<circle cx="10" cy="10" r="5" fill="none" stroke="#000" stroke-dasharray="2 1 3" stroke-dashoffset="1"/>');
    const dashes = itemOf(group, 'st')!.d as { n: string; v: unknown }[];
    expect(dashes.map((dash) => dash.n)).toEqual(['d', 'g', 'd', 'g', 'd', 'g', 'o']);
    expect(dashes.map((dash) => valueOf(dash.v))).toEqual([2, 1, 3, 2, 1, 3, 1]);
    const [circle] = bezierShapes(group);
    expect(circle!.v[0]).toEqual([15, 10]);
    expect(circle!.v[1]).toEqual([10, 15]);
    expect(itemOf(groupOf('<rect width="5" height="5" fill="none" stroke="#000" stroke-dasharray="none"/>'), 'st')!.d).toBeUndefined();
  });
});

describe('svgToLottieShapes: paths', () => {
  it('a cubic keeps its control points as tangents relative to each vertex', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M0 0 C 10 0 20 10 20 20" fill="none" stroke="#000"/>'));
    expect(bezier).toEqual({ v: [[0, 0], [20, 20]], o: [[10, 0], [0, 0]], i: [[0, 0], [0, -10]], c: false });
  });

  it('H, V and relative h, v draw straight lines; a Z back on the start does not repeat the vertex', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M10 10 H 30 V 40 h -20 v -30 Z"/>'));
    expect(bezier!.v).toEqual([[10, 10], [30, 10], [30, 40], [10, 40]]);
    expect(bezier!.c).toBe(true);
  });

  it('the closing curve of a Z keeps the tangent that arrives at the start', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M0 0 L 10 0 C 10 10 0 10 0 0 Z"/>'));
    expect(bezier!.v).toEqual([[0, 0], [10, 0]]);
    expect(bezier!.o[1]).toEqual([0, 10]);
    expect(bezier!.i[0]).toEqual([0, 10]);
  });

  it('pairs after M are lines; after m they are relative lines', () => {
    expect(bezierShapes(groupOf('<path d="M0 0 10 0 10 10" stroke="#000"/>'))[0]!.v).toEqual([[0, 0], [10, 0], [10, 10]]);
    expect(bezierShapes(groupOf('<path d="m5 5 10 0" stroke="#000"/>'))[0]!.v).toEqual([[5, 5], [15, 5]]);
  });

  it('reads numbers glued together: signs, leading dots and exponents', () => {
    expect(bezierShapes(groupOf('<path d="M0-5L.5.5l1e1-2" stroke="#000"/>'))[0]!.v).toEqual([[0, -5], [0.5, 0.5], [10.5, -1.5]]);
  });

  it('several subpaths are several paths in the same group, under one fill', () => {
    const group = groupOf('<path d="M0 0 L10 0 L10 10 Z m 20 0 l 10 0 l 0 10 z"/>');
    const shapes = bezierShapes(group);
    expect(shapes).toHaveLength(2);
    expect(shapes[1]!.v).toEqual([[20, 0], [30, 0], [30, 10]]);
    expect(itemsOf(group).filter((entry) => entry.ty === 'fl')).toHaveLength(1);
  });

  it('a drawing command right after Z starts the next subpath at the same start point', () => {
    const shapes = bezierShapes(groupOf('<path d="M5 5 L10 5 L10 10 Z L 0 10" stroke="#000"/>'));
    expect(shapes[1]!.v).toEqual([[5, 5], [0, 10]]);
  });

  it('a quadratic becomes the exact cubic (control points at two thirds)', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M0 0 Q 10 20 20 0" fill="none" stroke="#000"/>'));
    expectPointClose(bezier!.o[0]!, [6.667, 13.333]);
    expectPointClose(bezier!.i[1]!, [-6.667, 13.333]);
  });

  it('T reflects the previous quadratic control point', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M0 0 Q 10 20 20 0 T 40 0" fill="none" stroke="#000"/>'));
    expectPointClose(bezier!.o[1]!, [6.667, -13.333]);
    expectPointClose(bezier!.i[2]!, [-6.667, -13.333]);
    const [relative] = bezierShapes(groupOf('<path d="M0 0 q 10 20 20 0 t 20 0" fill="none" stroke="#000"/>'));
    expect(relative).toEqual(bezier);
  });

  it('S and s reflect the previous cubic control point', () => {
    const absolute = bezierShapes(groupOf('<path d="M0 0 C 0 10 10 10 10 0 S 20 -10 20 0" fill="none" stroke="#000"/>'))[0]!;
    expect(absolute.o[1]).toEqual([0, -10]);
    expect(absolute.i[2]).toEqual([0, -10]);
    const relative = bezierShapes(groupOf('<path d="M0 0 c 0 10 10 10 10 0 s 10 -10 10 0" fill="none" stroke="#000"/>'))[0]!;
    expect(relative).toEqual(absolute);
    const lonely = bezierShapes(groupOf('<path d="M0 0 S 10 10 20 0" fill="none" stroke="#000"/>'))[0]!;
    expect(lonely.o[0]).toEqual([0, 0]);
  });

  it('an arc becomes cubic Béziers on the circle, through the side its sweep flag picks', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M0 0 A 10 10 0 0 1 20 0" fill="none" stroke="#000"/>'));
    expect(bezier!.v).toHaveLength(3);
    expectPointClose(bezier!.v[1]!, [10, -10]);
    expect(bezier!.v[2]).toEqual([20, 0]);
    for (const middle of segmentMiddles(bezier!)) expect(Math.hypot(middle[0] - 10, middle[1])).toBeCloseTo(10, 1);
    const [other] = bezierShapes(groupOf('<path d="M0 0 A 10 10 0 0 0 20 0" fill="none" stroke="#000"/>'));
    expectPointClose(other!.v[1]!, [10, 10]);
  });

  it('arc flags can be glued to the numbers, radii too small grow to fit and a zero radius is a line', () => {
    const [expected] = bezierShapes(groupOf('<path d="M0 0 A 10 10 0 0 1 20 0" fill="none" stroke="#000"/>'));
    expect(bezierShapes(groupOf('<path d="M0 0 a10 10 0 0120 0" fill="none" stroke="#000"/>'))[0]).toEqual(expected);
    expect(bezierShapes(groupOf('<path d="M0 0 A 1 1 0 0 1 20 0" fill="none" stroke="#000"/>'))[0]).toEqual(expected);
    expect(bezierShapes(groupOf('<path d="M0 0 A 0 5 0 0 1 20 0" fill="none" stroke="#000"/>'))[0]!.v).toEqual([[0, 0], [20, 0]]);
  });

  it('a rotated elliptical arc ends exactly at its end point and stays on its ellipse', () => {
    const [bezier] = bezierShapes(groupOf('<path d="M 10 0 A 20 10 30 1 1 0 10" fill="none" stroke="#000"/>'));
    expect(bezier!.v.at(-1)).toEqual([0, 10]);
    expect(bezier!.v.length).toBeGreaterThan(2);
  });

  it('a path that does not start with M draws nothing; an error keeps what came before it', () => {
    expect(convert('<path d="L 10 10" stroke="#000"/>').shapes).toEqual([]);
    expect(bezierShapes(groupOf('<path d="M0 0 L 10 0 L 5 x 7" stroke="#000"/>'))[0]!.v).toEqual([[0, 0], [10, 0]]);
  });
});

describe('svgToLottieShapes: order, groups and transforms', () => {
  it('the first SVG element ends last: in Lottie the first item is on top', () => {
    const { shapes } = convert('<rect width="5" height="5" fill="#000"/> <circle r="1" fill="#fff"/>');
    expect(shapes.map((group) => itemsOf(group)[0]!.ty)).toEqual(['el', 'rc']);
  });

  it('a g is a group: its children inherit fill and stroke, keep their own order and may override', () => {
    const group = groupOf('<g fill="#ff0000" stroke="#00ff00" stroke-width="2"><rect width="5" height="5"/><circle r="1" fill="none"/><ellipse rx="2" ry="1" fill="inherit"/></g>');
    const [ellipse, circle, rect, transform] = itemsOf(group);
    expect(transform!.ty).toBe('tr');
    expect(itemsOf(rect!).map((entry) => entry.ty)).toEqual(['rc', 'st', 'fl', 'tr']);
    expect(bytesOf(valueOf<number[]>(itemOf(rect!, 'fl')!.c)).floor).toEqual([255, 0, 0]);
    expect(valueOf(itemOf(rect!, 'st')!.w)).toBe(2);
    expect(itemsOf(circle!).map((entry) => entry.ty)).toEqual(['el', 'st', 'tr']);
    expect(itemOf(ellipse!, 'fl')).toBeDefined();
  });

  it('opacity is not inherited: it fades the whole g once', () => {
    const group = groupOf('<g opacity="0.5"><rect width="5" height="5" fill="#000"/></g>');
    expect(valueOf(itemOf(group, 'tr')!.o)).toBe(50);
    expect(valueOf(itemOf(itemsOf(group)[0]!, 'tr')!.o)).toBe(100);
  });

  it('an empty g, display="none" and visibility="hidden" draw nothing and are not reported', () => {
    expect(convert('<g></g><rect width="5" height="5" display="none"/><g visibility="hidden"><circle r="2"/></g>')).toEqual({ shapes: [], skipped: [] });
  });

  it('rotate(a cx cy) turns the group around its center: anchor and position on the center', () => {
    const transform = itemOf(groupOf('<g transform="rotate(-12 120 160)"><rect width="5" height="5" fill="#000"/></g>'), 'tr')!;
    expect(valueOf(transform.a)).toEqual([120, 160]);
    expect(valueOf(transform.p)).toEqual([120, 160]);
    expect(valueOf(transform.r)).toBe(-12);
    expect(valueOf(transform.s)).toEqual([100, 100]);
  });

  it('translate, rotate and scale lists land every point where SVG puts it', () => {
    const cases: { transform: string; matrix: [number, number, number, number, number, number] }[] = [
      { transform: 'translate(100, 100) rotate(-20)', matrix: [Math.cos(radians(-20)), Math.sin(radians(-20)), -Math.sin(radians(-20)), Math.cos(radians(-20)), 100, 100] },
      { transform: 'translate(90,110) scale(0.9)', matrix: [0.9, 0, 0, 0.9, 90, 110] },
      { transform: 'translate(60, 60) rotate(-25) translate(-60, -60)', matrix: (() => {
        const [cos, sin] = [Math.cos(radians(-25)), Math.sin(radians(-25))];
        return [cos, sin, -sin, cos, 60 - 60 * cos + 60 * sin, 60 - 60 * sin - 60 * cos] as [number, number, number, number, number, number];
      })() },
      { transform: 'scale(2 3) rotate(10)', matrix: [2 * Math.cos(radians(10)), 3 * Math.sin(radians(10)), -2 * Math.sin(radians(10)), 3 * Math.cos(radians(10)), 0, 0] },
      { transform: 'skewX(20)', matrix: [1, 0, Math.tan(radians(20)), 1, 0, 0] },
      { transform: 'matrix(-1 0 0 1 50 0)', matrix: [-1, 0, 0, 1, 50, 0] },
      { transform: 'translate(5)', matrix: [1, 0, 0, 1, 5, 0] },
    ];
    for (const { transform, matrix } of cases) {
      const lottie = itemOf(groupOf(`<rect width="5" height="5" fill="#000" transform="${transform}"/>`), 'tr')!;
      for (const point of [[0, 0], [10, 0], [0, 10], [7, -3]] as Pair[]) {
        const [a, b, c, d, e, f] = matrix;
        expectPointClose(applyLottieTransform(lottie, point), [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f]);
      }
    }
  });

  it('a transform that cannot be read is ignored, like SVG does, and reported', () => {
    const { shapes, skipped } = convert('<rect width="5" height="5" fill="#000" transform="rotate(oops)"/>');
    expect(valueOf(itemOf(shapes[0]!, 'tr')!.p)).toEqual([0, 0]);
    expect(skipped).toEqual(['transform=rotate(oops)']);
  });
});

describe('svgToLottieShapes: what is skipped', () => {
  it('text, style and elements it does not know are reported, one entry each, and the rest still converts', () => {
    const { shapes, skipped } = convert('<text x="1" y="2" font-size="9">¿?</text><style>.a{fill:red}</style><image href="x.png"/><rect width="5" height="5" fill="#000"/><text>b</text>');
    expect(shapes).toHaveLength(1);
    expect(skipped).toEqual(['text', 'style', 'image', 'text']);
  });

  it('a clip, mask or filter it cannot follow is reported and the shape is drawn without it', () => {
    const { shapes, skipped } = convert('<rect width="5" height="5" fill="#000" clip-path="url(#c)"/>');
    expect(shapes).toHaveLength(1);
    expect(skipped).toEqual(['rect[clip-path]']);
  });

  it('title, desc and comments are ignored silently', () => {
    expect(convert('<!-- art --><title>x</title><desc>y</desc>')).toEqual({ shapes: [], skipped: [] });
  });

  it('a stroke it cannot paint is reported and the fill still draws', () => {
    const { shapes, skipped } = convert('<rect width="5" height="5" fill="#000" stroke="url(#ink)"/><circle r="2" fill="#000" stroke="chartreuse"/>');
    expect(shapes.map((group) => itemsOf(group).map((entry) => entry.ty))).toEqual([['el', 'fl', 'tr'], ['rc', 'fl', 'tr']]);
    expect(skipped).toEqual(['stroke=url(#ink)', 'stroke=chartreuse']);
  });
});

describe('svgToLottieShapes: markup reading', () => {
  it('decodes numeric entities and survives a stray closing tag', () => {
    const { shapes } = convert('<g><rect width="5" height="5" fill="&#35;ff0000"/></circle></g></g><circle r="1" fill="&#x23;00ff00"/>');
    expect(shapes).toHaveLength(2);
    expect(bytesOf(valueOf<number[]>(itemOf(itemsOf(shapes[1]!)[0]!, 'fl')!.c)).floor).toEqual([255, 0, 0]);
    expect(bytesOf(valueOf<number[]>(itemOf(shapes[0]!, 'fl')!.c)).floor).toEqual([0, 255, 0]);
  });

  it('an element left open closes with its parent', () => {
    const { shapes } = convert('<g fill="#ff0000"><rect width="5" height="5"></g><circle r="1"/>');
    expect(shapes).toHaveLength(2);
    expect(bytesOf(valueOf<number[]>(itemOf(shapes[0]!, 'fl')!.c)).floor).toEqual([0, 0, 0]);
  });
});

describe('svgToLottieShapes: pattern fills', () => {
  const DOTS = '<pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"> <circle cx="5" cy="5" r="2" fill="#334155"></circle> </pattern>';

  it('a userSpaceOnUse pattern is tiled inside the shape, under its stroke, as one group of copies', () => {
    const { shapes, skipped } = convert('<rect x="0" y="0" width="30" height="20" fill="url(&quot;#dots&quot;)" stroke="#000000"></rect>', DOTS);
    expect(skipped).toEqual([]);
    const [stroked, tiles, transform] = itemsOf(shapes[0]!);
    expect(transform!.ty).toBe('tr');
    expect(itemsOf(stroked!).map((entry) => entry.ty)).toEqual(['rc', 'st', 'tr']);
    const [dots] = itemsOf(tiles!);
    const centers = itemsOf(dots!).filter((entry) => entry.ty === 'el').map((entry) => valueOf<Pair>(entry.p));
    expect(centers).toHaveLength(6);
    expect(centers).toEqual(expect.arrayContaining([[5, 5], [15, 5], [25, 5], [5, 15], [15, 15], [25, 15]]));
    expect(itemsOf(dots!).filter((entry) => entry.ty === 'fl')).toHaveLength(1);
  });

  it('only the tiles whose middle falls inside the shape are kept (rounded corners included)', () => {
    const { shapes } = convert('<rect x="1" y="1" width="18" height="18" rx="9" fill="url(#dots)"/>', DOTS);
    const [tiles] = itemsOf(shapes[0]!);
    const [dots] = itemsOf(tiles!);
    const centers = itemsOf(dots!).filter((entry) => entry.ty === 'el').map((entry) => valueOf<Pair>(entry.p));
    expect(centers).toEqual(expect.arrayContaining([[5, 5], [15, 5], [5, 15], [15, 15]]));
    const { shapes: round } = convert('<circle cx="10" cy="10" r="4" fill="url(#dots)"/>', DOTS);
    expect(round).toEqual([]);
  });

  it('an objectBoundingBox pattern (the default) sizes its tile from the shape', () => {
    const halves = '<pattern id="half" width="0.5" height="1"><rect width="4" height="4" fill="#000"/></pattern>';
    const { shapes } = convert('<rect x="10" y="10" width="20" height="10" fill="url(#half)"/>', halves);
    const [tiles] = itemsOf(shapes[0]!);
    const corners = itemsOf(itemsOf(tiles!)[0]!).filter((entry) => entry.ty === 'rc').map((entry) => valueOf<Pair>(entry.p));
    expect(corners).toEqual(expect.arrayContaining([[12, 12], [22, 12]]));
  });

  it('pattern content with its own transform is copied as one moved group per tile', () => {
    const turned = '<pattern id="turned" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#000" transform="rotate(45 1 1)"/></pattern>';
    const { shapes } = convert('<rect width="20" height="10" fill="url(#turned)"/>', turned);
    const copies = itemsOf(itemsOf(shapes[0]!)[0]!).filter((entry) => entry.ty === 'gr');
    expect(copies.map((copy) => valueOf(itemOf(copy, 'tr')!.p))).toEqual([[0, 0], [10, 0]]);
  });

  it('a pattern it does not follow (patternTransform, too many tiles) is reported, not guessed', () => {
    const skewed = '<pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="5" cy="5" r="2"/></pattern>';
    expect(convert('<rect width="30" height="20" fill="url(#dots)"/>', skewed)).toEqual({ shapes: [], skipped: ['fill=url(#dots)[patternTransform]'] });
    const dust = '<pattern id="dust" width="0.1" height="0.1" patternUnits="userSpaceOnUse"><circle cx="0.05" cy="0.05" r="0.01"/></pattern>';
    expect(convert('<rect width="100" height="100" fill="url(#dust)"/>', dust).skipped).toEqual(['fill=url(#dust)[too many tiles]']);
  });

  it('a pattern it cannot find leaves the shape unfilled and is reported', () => {
    const { shapes, skipped } = convert('<rect width="30" height="20" fill="url(&quot;#dots&quot;)" stroke="#000"/>');
    expect(itemsOf(shapes[0]!).map((entry) => entry.ty)).toEqual(['rc', 'st', 'tr']);
    expect(skipped).toEqual(['fill=url(#dots)']);
  });
});

describe('svgToLottieShapes: output', () => {
  it('every number is finite and rounded to thousandths, and the shapes survive JSON', () => {
    const { shapes } = convert('<path d="M0 0 A 7 3 17 1 0 13.3333333 9.87654321 Q 1 2 3 4 Z" fill="#123456" stroke="#654321" transform="translate(1.23456 7.891011) rotate(33.333)"/>');
    const numbers = JSON.stringify(shapes).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? [];
    expect(JSON.parse(JSON.stringify(shapes))).toEqual(shapes);
    for (const text of numbers) {
      expect(Number.isFinite(Number(text))).toBe(true);
      expect(text.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    }
  });
});
