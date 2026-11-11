import { roundNumber, roundPoint, staticValue, type LottieShapeItem } from './lottieJson.js';

/**
 * SVG `transform` lists → the transform item (`tr`) of a Lottie group.
 * lottie-web applies a group transform as anchor, scale, skew, rotation and
 * position (`TransformProperty.processKeys`); any 2D affine matrix splits
 * into those (a QR split), so translate, rotate, scale, skew and matrix all
 * land exactly. PURE.
 */
/** `[a, b, c, d, e, f]`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type AffineMatrix = readonly [number, number, number, number, number, number];
type TransformStep = { name: string; values: number[] };

const IDENTITY: AffineMatrix = [1, 0, 0, 1, 0, 0];
const STEP_PATTERN = /\s*,?\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/y;
const DEGREES = 180 / Math.PI;
const PERCENT = 100;
const MATRIX_VALUES = 6;
const CENTERED_ROTATION_VALUES = 3;

function multiply(left: AffineMatrix, right: AffineMatrix): AffineMatrix {
  const [a, b, c, d, e, f] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];
}

function rotation(degrees: number): AffineMatrix {
  const angle = degrees / DEGREES;
  return [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
}

/** `rotate(a)` or `rotate(a cx cy)`: around the origin or around (cx, cy). */
function rotationStep([degrees = 0, centerX = 0, centerY = 0]: readonly number[]): AffineMatrix {
  return multiply(multiply([1, 0, 0, 1, centerX, centerY], rotation(degrees)), [1, 0, 0, 1, -centerX, -centerY]);
}

/** How many numbers each step takes, and its matrix. */
const STEPS: Readonly<Record<string, { counts: readonly number[]; matrix: (values: readonly number[]) => AffineMatrix }>> = {
  translate: { counts: [1, 2], matrix: ([x = 0, y = 0]) => [1, 0, 0, 1, x, y] },
  scale: { counts: [1, 2], matrix: ([x = 1, y = x]) => [x, 0, 0, y, 0, 0] },
  rotate: { counts: [1, CENTERED_ROTATION_VALUES], matrix: rotationStep },
  skewX: { counts: [1], matrix: ([degrees = 0]) => [1, 0, Math.tan(degrees / DEGREES), 1, 0, 0] },
  skewY: { counts: [1], matrix: ([degrees = 0]) => [1, Math.tan(degrees / DEGREES), 0, 1, 0, 0] },
  matrix: { counts: [MATRIX_VALUES], matrix: ([a = 1, b = 0, c = 0, d = 1, e = 0, f = 0]) => [a, b, c, d, e, f] },
};

/** One step's matrix; null when its numbers do not fit the step. */
function stepMatrix({ name, values }: TransformStep): AffineMatrix | null {
  const step = STEPS[name];
  return step?.counts.includes(values.length) ? step.matrix(values) : null;
}

const NUMBER_PATTERN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;
const NUMBERS_ONLY = /^[\s,+\-.\deE]+$/;

/** The numbers of a step (`10-5` is two numbers, like in SVG); null when anything else is there. */
function numbersOf(text: string): number[] | null {
  if (!NUMBERS_ONLY.test(text)) return null;
  const values = (text.match(NUMBER_PATTERN) ?? []).map(Number);
  return values.length > 0 && values.every(Number.isFinite) ? values : null;
}

/** The steps of a transform list; null when any part of it does not read (SVG then ignores the whole attribute). */
function parseSteps(text: string): TransformStep[] | null {
  const steps: TransformStep[] = [];
  STEP_PATTERN.lastIndex = 0;
  while (STEP_PATTERN.lastIndex < text.length) {
    const match = STEP_PATTERN.exec(text);
    if (!match) return text.slice(STEP_PATTERN.lastIndex).trim() === '' ? steps : null;
    const values = numbersOf(match[2] ?? '');
    if (!values) return null;
    steps.push({ name: match[1] ?? '', values });
  }
  return steps;
}

/** The transform's matrix; null when it does not read. */
export function parseTransform(text: string): AffineMatrix | null {
  const steps = parseSteps(text);
  if (!steps) return null;
  let matrix = IDENTITY;
  for (const step of steps) {
    const next = stepMatrix(step);
    if (!next) return null;
    matrix = multiply(matrix, next);
  }
  return matrix;
}

type TransformParts = { anchor: [number, number]; position: [number, number]; scale: [number, number]; rotation: number; skew: number };

/** M = T(position)·R(rotation)·Skew·S(scale): the order lottie-web composes them in, Skew being x' = x − tan(skew)·y. */
function decompose([a, b, c, d, e, f]: AffineMatrix): TransformParts {
  const scaleX = Math.hypot(a, b);
  if (scaleX === 0) return { anchor: [0, 0], position: [e, f], scale: [0, 0], rotation: 0, skew: 0 };
  const shear = (a * c + b * d) / scaleX;
  const scaleY = (a * d - b * c) / scaleX;
  const skew = scaleY === 0 ? 0 : Math.atan(-shear / scaleY) * DEGREES;
  return { anchor: [0, 0], position: [e, f], scale: [scaleX, scaleY], rotation: Math.atan2(b, a) * DEGREES, skew };
}

/** `rotate(a cx cy)` alone keeps its center as anchor and position: the group turns around it. */
function partsOf(text: string, matrix: AffineMatrix): TransformParts {
  const steps = parseSteps(text);
  const [only] = steps ?? [];
  if (steps?.length !== 1 || only?.name !== 'rotate' || only.values.length !== CENTERED_ROTATION_VALUES) return decompose(matrix);
  const [degrees = 0, centerX = 0, centerY = 0] = only.values;
  return { anchor: [centerX, centerY], position: [centerX, centerY], scale: [1, 1], rotation: degrees, skew: 0 };
}

/** A group's `tr`: its transform (null = identity) and its opacity 0–1. */
export function transformItem(text: string | null, opacity: number): LottieShapeItem {
  const parts = text === null ? decompose(IDENTITY) : partsOf(text, parseTransform(text) ?? IDENTITY);
  const item: LottieShapeItem = {
    ty: 'tr',
    p: staticValue(roundPoint(parts.position)),
    a: staticValue(roundPoint(parts.anchor)),
    s: staticValue(roundPoint([parts.scale[0] * PERCENT, parts.scale[1] * PERCENT])),
    r: staticValue(roundNumber(parts.rotation)),
    o: staticValue(roundNumber(opacity * PERCENT)),
  };
  if (roundNumber(parts.skew) !== 0) Object.assign(item, { sk: staticValue(roundNumber(parts.skew)), sa: staticValue(0) });
  return item;
}
