import type { Dance, WinkPart } from '../winkDances.js';
import type { WinkArt, WinkArtPart } from '../winkArt.js';
import type { Ease } from '../winkTimeline.js';

/**
 * A wink character doing a dance, as a Lottie animation (José 11/11: Telegram's
 * animated stickers look better). Telegram's stickers are Lottie (TGS): vector,
 * 60 fps, a few KB. Ours were 12 fps WebP of 170–370 KB.
 *
 * The composition mirrors `web/scripts/render-animated-stickers.mts` exactly:
 * a square stage tall enough for the dance's highest jump; the whole body
 * moves and turns around the middle of the character; each part turns around
 * its joint and the face parts hang from their parent. A dance's steps are
 * evenly spaced and eased by `smooth` (3t² − 2t³), which is exactly the cubic
 * Bézier (1/3, 0, 2/3, 1), so the file moves like the WebP did, only smoother.
 * PURE: the SVG → shapes conversion comes in as `shapesOf`.
 */
export const LOTTIE_FPS = 60;
export const LOTTIE_SIZE = 512;
const ART_WIDTH = 240;
const ART_HEIGHT = 320;
const MARGIN = 12;
/** The middle of the character: the whole body turns around it. */
const CENTER: readonly [number, number] = [120, 160];
/** Where the feet stand (the art puts them near y = 300): the body squashes onto them. */
const FEET: readonly [number, number] = [120, 300];
/** Higher than this (viewBox units) is a jump: the body stretches in the air and squashes around it. */
const AIRBORNE = 15;
const STRETCH = [94, 107];
const SQUASH = [108, 92];
const REST = [100, 100];
/** How many frames the head and the tail trail the body (follow-through, ~50 ms at 60 fps). */
const TRAIL_FRAMES = 3;
const TRAILING: ReadonlySet<string> = new Set(['head', 'tail']);

type Bezier = { o: { x: number[]; y: number[] }; i: { x: number[]; y: number[] } };
type Keyframe = { t: number; s: number[] } & Partial<Bezier>;
type Animated = { a: 0; k: number | number[] } | { a: 1; k: Keyframe[] };
type Transform = { a: Animated; p: Animated; s: Animated; r: Animated; o: Animated };
export type LottieLayer = { ddd: 0; ind: number; ty: 2 | 3 | 4; nm: string; parent?: number; sr: 1; ks: Transform; ao: 0; ip: number; op: number; st: 0; bm: 0; shapes?: unknown[]; refId?: string };
export type LottieImageAsset = { id: string; w: number; h: number; u: ''; p: string; e: 1 };
export type LottieAnimation = { v: string; fr: number; ip: 0; op: number; w: number; h: number; nm: string; ddd: 0; assets: LottieImageAsset[]; layers: LottieLayer[] };
/**
 * Text the shapes cannot carry (no glyph outlines in the art): drawn once as a
 * picture and hung on its part. `x`, `y`, `width`, `height` are viewBox units;
 * the PNG has `pixelsPerUnit` pixels per unit.
 */
export type PartImage = { id: string; dataUri: string; x: number; y: number; width: number; height: number; pixelsPerUnit: number };

/** Each ease as the Bézier handles of the segment it shapes (exact: the curves are polynomials of degree ≤ 3). */
const EASE_HANDLES: Record<Ease, [number, number, number, number]> = {
  smooth: [1 / 3, 0, 2 / 3, 1],
  linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3],
  in: [1 / 3, 0, 2 / 3, 1 / 3],
  out: [1 / 3, 2 / 3, 2 / 3, 1],
};

const fixed = (value: number | number[]): Animated => ({ a: 0, k: value });

/** Evenly spaced steps over the loop, eased; a single step is a constant. */
export function stepsTrack(steps: readonly (readonly number[])[], frames: number, ease: Ease = 'smooth'): Animated {
  if (steps.length <= 1) return fixed(steps[0] ? [...steps[0]] : [0]);
  const [x1, y1, x2, y2] = EASE_HANDLES[ease];
  const dims = steps[0]!.length;
  const handles = (value: number) => Array.from({ length: dims }, () => value);
  const keys: Keyframe[] = steps.map((step, index) => {
    const t = (index / (steps.length - 1)) * frames;
    const last = index === steps.length - 1;
    return last ? { t, s: [...step] } : { t, s: [...step], o: { x: handles(x1), y: handles(y1) }, i: { x: handles(x2), y: handles(y2) } };
  });
  return { a: 1, k: keys };
}

/** The stage: a square around the character, tall enough for how high the dance jumps (viewBox units). */
export function stageOf(dance: Dance): { x: number; y: number; side: number } {
  const jump = Math.max(0, ...(dance.whole?.y ?? [0]).map((y) => -y));
  const side = ART_HEIGHT + jump + MARGIN * 2;
  return { x: (ART_WIDTH - side) / 2, y: -(jump + MARGIN), side };
}

function transform(parts: { anchor: readonly [number, number]; position: Animated; rotation?: Animated; scale?: number }): Transform {
  const scale = (parts.scale ?? 1) * 100;
  return { a: fixed([...parts.anchor]), p: parts.position, s: fixed([scale, scale]), r: parts.rotation ?? fixed(0), o: fixed(100) };
}

/** Pairs two step lists (x and y) into points; a missing one stays at 0. */
function pointSteps(xs: readonly number[] | undefined, ys: readonly number[] | undefined): number[][] {
  const count = Math.max(xs?.length ?? 0, ys?.length ?? 0, 1);
  return Array.from({ length: count }, (_, index) => [CENTER[0] + (xs?.[index] ?? 0), CENTER[1] + (ys?.[index] ?? 0)]);
}

type LayerBase = Pick<LottieLayer, 'ddd' | 'sr' | 'ao' | 'ip' | 'op' | 'st' | 'bm'>;
const baseOf = (frames: number): LayerBase => ({ ddd: 0, sr: 1, ao: 0, ip: 0, op: frames, st: 0, bm: 0 });

/**
 * Squash and stretch (phase 2): in the air the body stretches; on the ground
 * just before a jump (anticipation) and just after landing it squashes.
 */
export function squashSteps(ys: readonly number[] | undefined): number[][] {
  if (!ys || !ys.some((y) => -y > AIRBORNE)) return [REST];
  const airborne = (index: number) => -(ys[index] ?? 0) > AIRBORNE;
  return ys.map((_, index) => (airborne(index) ? STRETCH : airborne(index - 1) || airborne(index + 1) ? SQUASH : REST));
}

/** The three nulls everything hangs from: the stage (viewBox → pixels), the whole body's shift and turn, and its squash on the feet. */
function rootLayers(dance: Dance, frames: number): LottieLayer[] {
  const stage = stageOf(dance);
  const whole = dance.whole ?? {};
  return [
    { ...baseOf(frames), ind: 1, ty: 3, nm: 'stage', ks: transform({ anchor: [stage.x, stage.y], position: fixed([0, 0]), scale: LOTTIE_SIZE / stage.side }) },
    { ...baseOf(frames), ind: 2, ty: 3, nm: 'whole', parent: 1, ks: transform({ anchor: CENTER, position: stepsTrack(pointSteps(whole.x, whole.y), frames), rotation: stepsTrack((whole.rotate ?? [0]).map((value) => [value]), frames) }) },
    { ...baseOf(frames), ind: 3, ty: 3, nm: 'squash', parent: 2, ks: { ...transform({ anchor: FEET, position: fixed([...FEET]) }), s: stepsTrack(squashSteps(whole.y), frames) } },
  ];
}

/**
 * Follow-through (phase 2): the same track a few frames later, wrapped around
 * the loop so its end still meets its start.
 */
export function trailed(track: Animated, frames: number, lag: number): Animated {
  if (track.a === 0 || lag <= 0) return track;
  const keys = track.k.map((key) => ({ ...key, t: (key.t + lag) % frames }));
  const wrapped = keys.filter((key, index) => key.t < lag && index > 0);
  const ordered = [...wrapped, ...keys.filter((key) => !wrapped.includes(key))].filter((key, index, all) => all.findIndex((other) => other.t === key.t) === index);
  const seam = { t: 0, s: [...ordered.at(-1)!.s], o: ordered.at(-1)!.o ?? keys[0]!.o, i: ordered.at(-1)!.i ?? keys[0]!.i };
  const closing = { t: frames, s: [...seam.s] };
  return { a: 1, k: [seam, ...ordered.filter((key) => key.t > 0).map((key) => (key.o ? key : { ...key, o: keys[0]!.o, i: keys[0]!.i })), closing] };
}

/** The parts in the order SVG paints them: each root part, then the parts that hang from it. */
function paintOrder(art: WinkArt): WinkArtPart[] {
  const withChildren = (part: WinkArtPart): WinkArtPart[] => [part, ...art.parts.filter((child) => child.parent === part.part).flatMap(withChildren)];
  return art.parts.filter((part) => !part.parent).flatMap(withChildren);
}

/** A part's pictures (its text), each an image layer on top of the part, turning with it. */
function imageLayers(images: readonly PartImage[], parent: number, firstIndex: number, frames: number): LottieLayer[] {
  return images.map((image, offset) => {
    const scale = 1 / image.pixelsPerUnit;
    return { ...baseOf(frames), ind: firstIndex + offset, ty: 2, nm: image.id, refId: image.id, parent, ks: transform({ anchor: [0, 0], position: fixed([image.x, image.y]), scale }) };
  });
}

type DanceParams = {
  name: string;
  art: WinkArt;
  dance: Dance;
  shapesOf: (markup: string) => unknown[];
  /** The pictures a part needs (its text); none by default. */
  imagesOf?: (part: WinkArtPart) => readonly PartImage[];
  /** Phase 2 (squash and stretch, follow-through); off only to compare against the old WebP frame by frame. */
  secondary?: boolean;
};

/** A dance as a Lottie animation of one character. */
export function danceToLottie(params: DanceParams): LottieAnimation {
  const { art, dance } = params;
  const secondary = params.secondary ?? true;
  const frames = Math.round((dance.loopMs / 1000) * LOTTIE_FPS);
  const painted = paintOrder(art);
  const indexOf = new Map(painted.map((part, position) => [part.part, position + 4]));
  let nextIndex = painted.length + 4;
  const assets: LottieImageAsset[] = [];
  const layers = painted.flatMap((part): LottieLayer[] => {
    const steps = (dance.parts[part.part as WinkPart]?.rotate ?? [0]).map((value) => [value]);
    const parent = part.parent ? indexOf.get(part.parent) : 3;
    const turn = stepsTrack(steps, frames);
    const rotation = secondary && TRAILING.has(part.part) ? trailed(turn, frames, TRAIL_FRAMES) : turn;
    const ind = indexOf.get(part.part)!;
    const images = params.imagesOf?.(part) ?? [];
    assets.push(...images.map((image): LottieImageAsset => ({ id: image.id, w: Math.round(image.width * image.pixelsPerUnit), h: Math.round(image.height * image.pixelsPerUnit), u: '', p: image.dataUri, e: 1 })));
    const pictures = imageLayers(images, ind, nextIndex, frames);
    nextIndex += pictures.length;
    return [{ ...baseOf(frames), ind, ty: 4, nm: part.part, parent, ks: transform({ anchor: part.pivot, position: fixed([...part.pivot]), rotation }), shapes: params.shapesOf(part.markup) }, ...pictures];
  });
  const roots = rootLayers(dance, frames);
  if (!secondary) roots[2] = { ...roots[2]!, ks: transform({ anchor: FEET, position: fixed([...FEET]) }) };
  // In Lottie the first layer is on top: the last one SVG paints goes first.
  return { v: '5.7.0', fr: LOTTIE_FPS, ip: 0, op: frames, w: LOTTIE_SIZE, h: LOTTIE_SIZE, nm: params.name, ddd: 0, assets, layers: [...layers.reverse(), ...roots] };
}
