import { lottieColor, roundNumber, staticValue, type LottieShapeItem, type SvgColor } from './lottieJson.js';
import { numberOf, opacityOf, type SvgStyle } from './svgStyle.js';

/**
 * Lottie fill (`fl`) and stroke (`st`) items from an element's computed
 * style. Line caps and joins are always written: lottie-web defaults a
 * missing one to round, SVG to butt and miter. PURE.
 */
const LINE_CAPS: Readonly<Record<string, number>> = { butt: 1, round: 2, square: 3 };
const LINE_JOINS: Readonly<Record<string, number>> = { miter: 1, 'miter-clip': 1, arcs: 1, round: 2, bevel: 3 };
const NONZERO = 1;
const EVENODD = 2;
const PERCENT = 100;
const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_MITER_LIMIT = 4;

export function fillItem(style: SvgStyle, color: SvgColor): LottieShapeItem {
  const opacity = color.alpha * opacityOf(style['fill-opacity']);
  return { ty: 'fl', c: staticValue(lottieColor(color)), o: staticValue(roundNumber(opacity * PERCENT)), r: style['fill-rule'] === 'evenodd' ? EVENODD : NONZERO };
}

export function strokeWidthOf(style: SvgStyle): number {
  return Math.max(0, numberOf(style['stroke-width'], DEFAULT_STROKE_WIDTH));
}

/** SVG's dash list: an odd list repeats once, a negative or all-zero list draws a solid line. */
export function dashesOf(style: SvgStyle): number[] | null {
  const text = style['stroke-dasharray'].trim();
  if (text === 'none' || text === '') return null;
  const lengths = text.split(/[\s,]+/).map((length) => Number.parseFloat(length));
  if (lengths.some((length) => !Number.isFinite(length) || length < 0)) return null;
  if (lengths.reduce((sum, length) => sum + length, 0) <= 0) return null;
  return lengths.length % 2 === 1 ? [...lengths, ...lengths] : lengths;
}

function dashItems(lengths: number[], offset: number): { n: string; nm: string; v: unknown }[] {
  const dashes = lengths.map((length, index) => (index % 2 === 0 ? { n: 'd', nm: 'dash', v: staticValue(roundNumber(length)) } : { n: 'g', nm: 'gap', v: staticValue(roundNumber(length)) }));
  return [...dashes, { n: 'o', nm: 'offset', v: staticValue(roundNumber(offset)) }];
}

export function strokeItem(style: SvgStyle, color: SvgColor): LottieShapeItem | null {
  const width = strokeWidthOf(style);
  if (width <= 0) return null;
  const opacity = color.alpha * opacityOf(style['stroke-opacity']);
  const stroke: LottieShapeItem = {
    ty: 'st',
    c: staticValue(lottieColor(color)),
    o: staticValue(roundNumber(opacity * PERCENT)),
    w: staticValue(roundNumber(width)),
    lc: LINE_CAPS[style['stroke-linecap']] ?? LINE_CAPS.butt,
    lj: LINE_JOINS[style['stroke-linejoin']] ?? LINE_JOINS.miter,
    ml: roundNumber(Math.max(1, numberOf(style['stroke-miterlimit'], DEFAULT_MITER_LIMIT))),
  };
  const dashes = dashesOf(style);
  if (dashes) stroke.d = dashItems(dashes, numberOf(style['stroke-dashoffset'], 0));
  return stroke;
}
