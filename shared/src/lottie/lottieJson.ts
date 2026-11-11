/**
 * The pieces of the Lottie JSON (bodymovin 5.7 schema) the sticker writers
 * share: shape items, static properties, points, colors and rounding. PURE.
 */

/** Any item of a shape layer's `shapes` (or of a group's `it`): `gr`, `sh`, `rc`, `el`, `fl`, `st`, `tr`… */
export type LottieShapeItem = { ty: string; [key: string]: unknown };
export type LottiePoint = [number, number];
/** A property that does not move. */
export type LottieStatic<T> = { a: 0; k: T };
/** A path: vertices, and the in and out tangents RELATIVE to each vertex. */
export type LottieBezier = { i: LottiePoint[]; o: LottiePoint[]; v: LottiePoint[]; c: boolean };
/** A color as SVG writes it: 0–255 channels and an alpha 0–1. */
export type SvgColor = { rgb: readonly [number, number, number]; alpha: number };

export const LOTTIE_VERSION = '5.7.0';

/** Thousandths of a viewBox unit: far below a pixel at any sticker size, and short JSON. */
const COORDINATE_PRECISION = 1000;
const COLOR_PRECISION = 10000;
const BYTE = 255;
/**
 * A channel goes a tenth of a byte up: lottie-web and lottie-android truncate
 * `c × 255`, others round it; both land on the SVG byte (244/255 alone
 * truncates to 243).
 */
const BYTE_NUDGE = 0.1;

export function staticValue<T>(k: T): LottieStatic<T> {
  return { a: 0, k };
}

/** Rounded to thousandths, never `-0`. */
export function roundNumber(value: number): number {
  const rounded = Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;
  return rounded === 0 ? 0 : rounded;
}

export function roundPoint([x, y]: readonly [number, number]): LottiePoint {
  return [roundNumber(x), roundNumber(y)];
}

function colorChannel(byte: number): number {
  if (byte <= 0) return 0;
  return Math.min(1, Math.round(((byte + BYTE_NUDGE) / BYTE) * COLOR_PRECISION) / COLOR_PRECISION);
}

/** Lottie's `[r, g, b, 1]` in 0–1; the alpha goes to the paint's opacity instead. */
export function lottieColor({ rgb }: SvgColor): [number, number, number, number] {
  return [colorChannel(rgb[0]), colorChannel(rgb[1]), colorChannel(rgb[2]), 1];
}

const NAMED_COLORS: Readonly<Record<string, SvgColor>> = {
  black: { rgb: [0, 0, 0], alpha: 1 },
  white: { rgb: [BYTE, BYTE, BYTE], alpha: 1 },
  transparent: { rgb: [0, 0, 0], alpha: 0 },
};
const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SHORT_HEX_LENGTH = 4;

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `black`, `white` or `transparent`; null for anything else. */
export function parseSvgColor(value: string): SvgColor | null {
  const text = value.trim().toLowerCase();
  const named = NAMED_COLORS[text];
  if (named) return named;
  const hex = HEX_COLOR.exec(text)?.[1];
  if (!hex) return null;
  const pairs = hex.length <= SHORT_HEX_LENGTH ? [...hex].map((digit) => digit + digit) : (hex.match(/../g) ?? []);
  const [red = 0, green = 0, blue = 0, alpha = BYTE] = pairs.map((pair) => Number.parseInt(pair, 16));
  return { rgb: [red, green, blue], alpha: alpha / BYTE };
}
