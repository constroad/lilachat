import { parseSvgColor, type SvgColor } from './lottieJson.js';
import type { SvgNode } from './svgMarkup.js';

/**
 * The SVG painting properties an element inherits from its `g`, as written
 * (strings), plus how a paint value reads. `opacity`, `transform` and
 * `display` do not inherit: they are read from the element itself. PURE.
 */
export const INHERITED_PROPERTIES = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'paint-order', 'visibility',
] as const;
export type InheritedProperty = (typeof INHERITED_PROPERTIES)[number];
export type SvgStyle = Readonly<Record<InheritedProperty, string>>;
/** An element's own declarations: its attributes, with its `style=""` on top. */
export type SvgDeclarations = Readonly<Record<string, string>>;

/** SVG's initial values: black fill, no stroke, 1-unit butt/miter stroke. */
export const INITIAL_STYLE: SvgStyle = {
  fill: 'black', 'fill-opacity': '1', 'fill-rule': 'nonzero', stroke: 'none', 'stroke-opacity': '1', 'stroke-width': '1',
  'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', 'stroke-dasharray': 'none',
  'stroke-dashoffset': '0', 'paint-order': 'normal', visibility: 'visible',
};

export function declarationsOf(node: SvgNode): SvgDeclarations {
  const declarations: Record<string, string> = { ...node.attrs };
  for (const declaration of (node.attrs.style ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
  }
  return declarations;
}

export function inheritStyle(parent: SvgStyle, declarations: SvgDeclarations): SvgStyle {
  const style: Record<InheritedProperty, string> = { ...parent };
  for (const property of INHERITED_PROPERTIES) {
    const value = declarations[property]?.trim();
    if (value && value !== 'inherit') style[property] = value;
  }
  return style;
}

/** A number, or the fallback when it does not read. */
export function numberOf(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** An opacity 0–1 from `0.4` or `40%`. */
export function opacityOf(value: string | undefined): number {
  const text = value?.trim() ?? '';
  const parsed = numberOf(text, 1) / (text.endsWith('%') ? 100 : 1);
  return Math.min(1, Math.max(0, parsed));
}

export type SvgPaint = { kind: 'none' } | { kind: 'color'; color: SvgColor } | { kind: 'pattern'; id: string } | { kind: 'unknown'; value: string };
const URL_PAINT = /^url\(\s*["']?#([^"')\s]+)["']?\s*\)/;

export function paintOf(value: string): SvgPaint {
  const text = value.trim();
  if (text === 'none') return { kind: 'none' };
  const id = URL_PAINT.exec(text)?.[1];
  if (id) return { kind: 'pattern', id };
  const color = parseSvgColor(text);
  if (!color) return { kind: 'unknown', value: text };
  return color.alpha > 0 ? { kind: 'color', color } : { kind: 'none' };
}

/** True when the stroke paints after (over) the fill: SVG's default, unless `paint-order` lists the stroke first. */
export function strokeOverFill(style: SvgStyle): boolean {
  const listed: string[] = style['paint-order'].split(/\s+/).filter((keyword) => keyword === 'fill' || keyword === 'stroke');
  const order = [...listed, ...['fill', 'stroke'].filter((keyword) => !listed.includes(keyword))];
  return order.indexOf('stroke') > order.indexOf('fill');
}
