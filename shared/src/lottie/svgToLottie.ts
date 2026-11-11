import type { LottieShapeItem } from './lottieJson.js';
import { geometryOf } from './svgGeometry.js';
import { parseSvgMarkup, type SvgNode } from './svgMarkup.js';
import { fillItem, strokeItem } from './svgPaint.js';
import { collectPatterns, patternFill } from './svgPattern.js';
import { declarationsOf, inheritStyle, INITIAL_STYLE, opacityOf, paintOf, strokeOverFill, type SvgDeclarations, type SvgStyle } from './svgStyle.js';
import { parseTransform, transformItem } from './svgTransform.js';

/**
 * The SVG markup of one wink part → Lottie shape items (bodymovin 5.7), in
 * the art's viewBox units: the caller puts them in a shape layer and scales
 * it. Each element is a group (`gr`) of its shapes, its paints and its
 * transform (`tr`); a `g` is a group of groups. Lottie draws the FIRST item
 * on top, so document order is reversed at every level, and the stroke goes
 * before the fill so it paints over it (unless `paint-order` says
 * otherwise). Pattern fills are spelled out from `defs`. What it cannot draw
 * (text, CSS, images, clips) is left out and listed in `skipped`, one entry
 * per occurrence: an element's tag (`text`), an attribute (`rect[clip-path]`)
 * or a paint (`fill=url(#grill)`). PURE.
 */
export type { LottieShapeItem } from './lottieJson.js';
export type SvgToLottieOptions = {
  /** The character's `defs` (where its `<pattern>`s live). */
  defs?: string;
};
export type SvgToLottieResult = { shapes: LottieShapeItem[]; skipped: string[] };

type Context = { patterns: ReadonlyMap<string, SvgNode>; skipped: string[] };
type FillContent = { item: LottieShapeItem } | { patternGroup: LottieShapeItem };

const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path']);
/** Elements that never draw by themselves. */
const SILENT_TAGS = new Set(['defs', 'pattern', 'title', 'desc', 'metadata']);
const UNFOLLOWED_ATTRIBUTES = ['clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end'] as const;
const HIDDEN_VISIBILITY = new Set(['hidden', 'collapse']);

export function svgToLottieShapes(markup: string, options: SvgToLottieOptions = {}): SvgToLottieResult {
  const nodes = parseSvgMarkup(markup);
  const context: Context = { patterns: collectPatterns([...parseSvgMarkup(options.defs ?? ''), ...nodes]), skipped: [] };
  return { shapes: convertNodes(nodes, INITIAL_STYLE, context), skipped: context.skipped };
}

function convertNodes(nodes: readonly SvgNode[], style: SvgStyle, context: Context): LottieShapeItem[] {
  return nodes.flatMap((node) => convertNode(node, style, context) ?? []).reverse();
}

function convertNode(node: SvgNode, parentStyle: SvgStyle, context: Context): LottieShapeItem | null {
  const declarations = declarationsOf(node);
  if (SILENT_TAGS.has(node.tag) || declarations.display === 'none') return null;
  const isGroup = node.tag === 'g';
  if (!isGroup && !SHAPE_TAGS.has(node.tag)) {
    context.skipped.push(node.tag);
    return null;
  }
  for (const attribute of UNFOLLOWED_ATTRIBUTES) {
    if (declarations[attribute] && declarations[attribute] !== 'none') context.skipped.push(`${node.tag}[${attribute}]`);
  }
  const style = inheritStyle(parentStyle, declarations);
  const content = isGroup ? convertNodes(node.children, style, context) : shapeContent(node, style, context);
  return content.length > 0 ? { ty: 'gr', it: [...content, groupTransform(declarations, context)] } : null;
}

/** The group's `tr`: its own transform and opacity (neither one inherits). A transform that does not read is ignored, like SVG. */
function groupTransform(declarations: SvgDeclarations, context: Context): LottieShapeItem {
  const text = declarations.transform ?? null;
  if (text !== null && parseTransform(text) === null) context.skipped.push(`transform=${text}`);
  return transformItem(text, opacityOf(declarations.opacity));
}

/** A shape's items, without its `tr`: empty when it paints nothing. */
function shapeContent(node: SvgNode, style: SvgStyle, context: Context): LottieShapeItem[] {
  if (HIDDEN_VISIBILITY.has(style.visibility)) return [];
  const stroke = strokeOf(style, context);
  const geometry = geometryOf(node, stroke?.d !== undefined);
  if (geometry.items.length === 0) return [];
  const fill = geometry.fillable ? fillOf(style, geometry.items, context) : null;
  if (fill && 'patternGroup' in fill) return patternContent(geometry.items, fill.patternGroup, stroke, strokeOverFill(style));
  const paints = strokeOverFill(style) ? [stroke, fill?.item] : [fill?.item, stroke];
  const drawn = paints.filter((paint): paint is LottieShapeItem => Boolean(paint));
  return drawn.length > 0 ? [...geometry.items, ...drawn] : [];
}

/**
 * The stroke gets a group of its own next to the pattern's: a style in a
 * Lottie group also paints the groups listed before it, so it must not sit
 * beside them.
 */
function patternContent(geometry: LottieShapeItem[], patternGroup: LottieShapeItem, stroke: LottieShapeItem | null, strokeOnTop: boolean): LottieShapeItem[] {
  if (!stroke) return [patternGroup];
  const strokeGroup: LottieShapeItem = { ty: 'gr', it: [...geometry, stroke, transformItem(null, 1)] };
  return strokeOnTop ? [strokeGroup, patternGroup] : [patternGroup, strokeGroup];
}

function strokeOf(style: SvgStyle, context: Context): LottieShapeItem | null {
  const paint = paintOf(style.stroke);
  if (paint.kind === 'color') return strokeItem(style, paint.color);
  if (paint.kind === 'pattern') context.skipped.push(`stroke=url(#${paint.id})`);
  if (paint.kind === 'unknown') context.skipped.push(`stroke=${paint.value}`);
  return null;
}

function fillOf(style: SvgStyle, geometry: LottieShapeItem[], context: Context): FillContent | null {
  const paint = paintOf(style.fill);
  if (paint.kind === 'color') return { item: fillItem(style, paint.color) };
  if (paint.kind === 'unknown') context.skipped.push(`fill=${paint.value}`);
  if (paint.kind !== 'pattern') return null;
  const pattern = context.patterns.get(paint.id);
  const filled = pattern ? patternFill(pattern, geometry, (nodes, patternStyle) => convertNodes(nodes, patternStyle, context)) : null;
  if (!filled || 'unsupported' in filled) {
    context.skipped.push(`fill=url(#${paint.id})${filled && 'unsupported' in filled ? `[${filled.unsupported}]` : ''}`);
    return null;
  }
  return filled.group ? { patternGroup: filled.group } : null;
}
