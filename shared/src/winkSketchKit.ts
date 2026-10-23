import { mergeTracks, type ActorArt, type ActorKey, type PartKey, type RigPart, type SketchActor } from './winkTimeline.js';
import type { WinkArtId } from './winkArt.js';

/**
 * The pieces every wink sketch is built from (moved out of `winkSketches`
 * so the file stays under 600 lines): stage constants, rig merging, walks,
 * wiggles, winks, sways, turns and entrances. PURE.
 */
export type Rig = Partial<Record<RigPart, PartKey[]>>;

export const STANDARD_MS = 6500;
/** Where a character stands and how big it is (stage units). */
export const FLOOR_Y = 0.6;
export const SIZE = 0.62;
/** Off the screen to the left and to the right (the actor's center). */
export const OFF_LEFT = -0.45;
export const OFF_RIGHT = 1.45;
/** The share of a wink an eye stays shut for a wink. */
export const WINK_HOLD = 0.03;

/** Several moments of a rig, part by part, in time order. */
export function rig(...pieces: Rig[]): Rig {
  const merged: Rig = {};
  for (const piece of pieces) {
    for (const [part, keys] of Object.entries(piece) as [RigPart, PartKey[]][]) merged[part] = mergeTracks(merged[part] ?? [], keys);
  }
  return merged;
}

export const character = (id: WinkArtId, keys: ActorKey[], parts: Rig = {}): SketchActor => ({ art: { character: id }, keys, parts });
export const prop = (id: Extract<ActorArt, { prop: unknown }>['prop'], keys: ActorKey[], extra: Partial<SketchActor> = {}): SketchActor => ({ art: { prop: id }, keys, ...extra });

/** Moments every `stepMs` between two shares of the wink (the beats of a walk, a wiggle, a knock). */
export function beats(from: number, to: number, durationMs: number, stepMs: number): number[] {
  const step = stepMs / durationMs;
  const moments: number[] = [];
  for (let at = from + step; at < to - step / 2; at += step) moments.push(at);
  return moments;
}

/** A part swinging around 0 between two moments (a wiggle, a headbang, kicking legs); `phase` −1 starts the other way. */
export function wiggle(part: RigPart, from: number, to: number, durationMs: number, amplitude: number, stepMs: number, phase = 1): Rig {
  const swings = beats(from, to, durationMs, stepMs).map((at, index) => ({ at, rotate: (index % 2 === 0 ? amplitude : -amplitude) * phase }));
  return { [part]: [{ at: from, rotate: 0 }, ...swings, { at: to, rotate: 0 }] };
}

/** A part going to a value and back on every beat (clapping, pumping a fist, nodding). */
export function pump(part: RigPart, from: number, to: number, durationMs: number, value: number, stepMs: number): Rig {
  const pulses = beats(from, to, durationMs, stepMs).map((at, index) => ({ at, rotate: index % 2 === 0 ? value : 0 }));
  return { [part]: [{ at: from, rotate: 0 }, ...pulses, { at: to, rotate: 0 }] };
}

/** Walking: the legs swing in turns and the arms against them. */
export function walk(from: number, to: number, durationMs: number, stepMs = 280, swing = 16): Rig {
  return rig(
    wiggle('leg-left', from, to, durationMs, swing, stepMs),
    wiggle('leg-right', from, to, durationMs, swing, stepMs, -1),
    wiggle('arm-left', from, to, durationMs, swing * 0.5, stepMs, -1),
    wiggle('arm-right', from, to, durationMs, swing * 0.5, stepMs)
  );
}

/** One eye shuts and opens: a real wink. */
export function wink(eye: 'eye-left' | 'eye-right', at: number, hold = WINK_HOLD): Rig {
  return { [eye]: [{ at: at - 0.02, scaleY: 1 }, { at, scaleY: 0.08 }, { at: at + hold, scaleY: 0.08 }, { at: at + hold + 0.02, scaleY: 1 }] };
}

/** A property of the actor going back and forth around `base` (a bob, a sway, a body that shakes laughing). */
export function sway(property: 'x' | 'y' | 'rotate' | 'sy' | 'sx', from: number, to: number, durationMs: number, amplitude: number, stepMs: number, base: number): ActorKey[] {
  return [{ at: from, [property]: base }, ...beats(from, to, durationMs, stepMs).map((at, index) => ({ at, [property]: base + (index % 2 === 0 ? amplitude : -amplitude) })), { at: to, [property]: base }];
}

/** A turn on the spot: the one leaving squashes to nothing, the other opens up from it. */
export function turn(at: number, share: number): { leaving: ActorKey[]; arriving: ActorKey[] } {
  const middle = at + share / 2;
  return {
    leaving: [{ at, sx: 1 }, { at: middle, sx: 0.02 }, { at: middle, opacity: 1 }, { at: middle, opacity: 0 }],
    arriving: [{ at, sx: 0.02 }, { at: middle, sx: 0.02 }, { at: middle, opacity: 0 }, { at: middle, opacity: 1 }, { at: at + share, sx: 1 }],
  };
}

/** Appears at a moment (instantly) and is hidden before it. */
export const appearAt = (at: number): ActorKey[] => [{ at: 0, opacity: 0 }, { at, opacity: 0 }, { at, opacity: 1 }];
/** Pops in at the start and fades at the end. */
export const popIn = (scale = SIZE): ActorKey[] => [{ at: 0, scale: 0.15, opacity: 0, y: FLOOR_Y }, { at: 0.05, scale, opacity: 1, ease: 'out' }, { at: 0.92, opacity: 1 }, { at: 1, opacity: 0 }];

