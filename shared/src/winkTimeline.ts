import type { Dance, WinkPart } from './winkDances.js';
import type { WinkArtId, WinkPropId } from './winkArt.js';
import type { WinkSound } from './winks.js';

/**
 * The timeline of a wink sketch (José, 21/10: «se trata de que sean graciosos,
 * no de que todos bailen»): actors (a character, or a prop such as the water
 * balloon) that come in, move, grow, turn around and leave at given moments,
 * their parts (arms, legs, eyelids, mouth, what the hand holds) moving on their
 * own, plus sound cues and screen effects. Times are fractions (0–1) of the
 * whole wink; positions are fractions of the screen (the actor's center);
 * `scale` is the actor's width in stage units (`stageUnit`), or in screen
 * widths for an actor with `fit: 'width'`. The app (Reanimated) and the web
 * (Web Animations) play the same keys. PURE.
 */
export type RigPart = WinkPart | 'eye-left' | 'eye-right' | 'mouth' | 'held';

/** How a segment arrives at its key: «out» arrives braking, «in» arrives speeding up (a fall, a smash). */
export type Ease = 'smooth' | 'linear' | 'in' | 'out';

/**
 * `sx` and `sy` stretch the actor (a negative `sx` mirrors it: going from 1 to
 * −1 is a turn on the spot); `rotate` is in degrees, clockwise.
 */
export type ActorKey = { at: number; x?: number; y?: number; scale?: number; sx?: number; sy?: number; rotate?: number; opacity?: number; ease?: Ease };
/** A part turns around its joint, grows, squashes (an eye that closes, a mouth that yawns) and can vanish (the rose he throws). */
export type PartKey = { at: number; rotate?: number; scale?: number; scaleY?: number; opacity?: number; ease?: Ease };

export type ActorArt = { character: WinkArtId } | { prop: WinkPropId };
export type SketchActor = { art: ActorArt; fit?: 'unit' | 'width'; keys: readonly ActorKey[]; parts?: Partial<Record<RigPart, readonly PartKey[]>> };
/** A knock or a crash jolts the screen, a truck makes it rumble, a hug squeezes it. */
export type ScreenEffect = 'knock' | 'crash' | 'rumble' | 'squeeze';
export type SketchCue = { at: number; sound?: WinkSound; screen?: ScreenEffect };
export type Sketch = { durationMs: number; actors: readonly SketchActor[]; cues: readonly SketchCue[]; particlesAt?: readonly [number, number] };

/** One property of an actor or part over the whole wink: its keys (0–1), values and the ease of each segment. */
export type Track = { ats: number[]; values: number[]; eases: Ease[] };
export type ActorProperty = 'x' | 'y' | 'scale' | 'sx' | 'sy' | 'rotate' | 'opacity';
export type PartProperty = 'rotate' | 'scale' | 'scaleY' | 'opacity';

const ACTOR_DEFAULTS: Record<ActorProperty, number> = { x: 0.5, y: 0.5, scale: 1, sx: 1, sy: 1, rotate: 0, opacity: 1 };
const PART_DEFAULTS: Record<PartProperty, number> = { rotate: 0, scale: 1, scaleY: 1, opacity: 1 };
/** Two keys at the same moment are an instant jump: the second one goes a hair later, so time always moves forward. */
const SAME_MOMENT = 0.0005;

/**
 * One property's track, from the keys that set it. Each property moves on its
 * own: a key that only turns the actor does not stop it from walking. Before
 * its first key a property holds that value, after the last one it stays.
 * The ease of a key shapes the segment that ends at it.
 */
function trackOf<K extends { at: number; ease?: Ease }>(keys: readonly K[], read: (key: K) => number | undefined, fallback: number): Track {
  const track: Track = { ats: [], values: [], eases: [] };
  for (const key of [...keys].sort((a, b) => a.at - b.at)) {
    const value = read(key);
    if (value === undefined) continue;
    const last = track.ats.at(-1);
    track.ats.push(last !== undefined && key.at <= last ? last + SAME_MOMENT : key.at);
    track.values.push(value);
    track.eases.push(key.ease ?? 'smooth');
  }
  if (track.ats.length === 0) return { ats: [0, 1], values: [fallback, fallback], eases: ['smooth', 'smooth'] };
  if (track.ats[0]! > 0) {
    track.ats.unshift(0);
    track.values.unshift(track.values[0]!);
    track.eases.unshift('smooth');
  }
  if (track.ats.at(-1)! < 1) {
    track.ats.push(1);
    track.values.push(track.values.at(-1)!);
    track.eases.push('smooth');
  }
  return track;
}

export function actorTracks(keys: readonly ActorKey[]): Record<ActorProperty, Track> {
  const entries = (Object.keys(ACTOR_DEFAULTS) as ActorProperty[]).map((property) => [property, trackOf(keys, (key) => key[property], ACTOR_DEFAULTS[property])] as const);
  return Object.fromEntries(entries) as Record<ActorProperty, Track>;
}

export function partTracks(keys: readonly PartKey[] | undefined): Record<PartProperty, Track> {
  const entries = (Object.keys(PART_DEFAULTS) as PartProperty[]).map((property) => [property, trackOf(keys ?? [], (key) => key[property], PART_DEFAULTS[property])] as const);
  return Object.fromEntries(entries) as Record<PartProperty, Track>;
}

/** A part the sketch never moves stays a single still layer (fewer animated views on the phone). */
export function isStillTrack(track: Track): boolean {
  return track.values.every((value) => value === track.values[0]);
}

/** The eased share of a segment (0–1): what both renderers apply between two keys. */
export function easeShare(ease: Ease, share: number): number {
  if (ease === 'linear') return share;
  if (ease === 'in') return share * share;
  if (ease === 'out') return 1 - (1 - share) * (1 - share);
  return share * share * (3 - 2 * share);
}

/** The value of a track at a moment (tests and anything that samples instead of animating). */
export function sampleTrack({ ats, values, eases }: Track, at: number): number {
  if (at <= ats[0]!) return values[0]!;
  for (let index = 1; index < ats.length; index += 1) {
    if (at <= ats[index]!) {
      const share = (at - ats[index - 1]!) / (ats[index]! - ats[index - 1]!);
      return values[index - 1]! + (values[index]! - values[index - 1]!) * easeShare(eases[index]!, share);
    }
  }
  return values.at(-1)!;
}

/**
 * The stage unit actors are sized by: the screen's width, but no more than
 * three quarters of its height nor 560 px, so a character fits a phone held
 * upright and still fills a good part of a wide desktop window.
 */
export const STAGE_MAX_UNIT = 560;
export function stageUnit(width: number, height: number): number {
  return Math.min(width, height * 0.75, STAGE_MAX_UNIT);
}

/** The width and height of an actor's box at scale 1, from its viewBox. */
export function actorBox(viewBox: string, fit: 'unit' | 'width' | undefined, screen: { width: number; height: number }): { width: number; height: number } {
  const [, , boxWidth = 1, boxHeight = 1] = viewBox.split(/\s+/).map(Number);
  const width = fit === 'width' ? screen.width : stageUnit(screen.width, screen.height);
  return { width, height: (width * boxHeight) / boxWidth };
}

/**
 * A dance (`DANCES`) repeated for one part inside a window of the wink, resting
 * at 0 at both ends. Lets a sketch say «dances from 10 % to 40 %».
 */
export function danceTrack(dance: Dance, part: RigPart, from: number, to: number, durationMs: number): PartKey[] {
  const values = (dance.parts as Partial<Record<RigPart, { rotate?: readonly number[] }>>)[part]?.rotate;
  if (!values || values.length < 2) return [];
  const loopShare = dance.loopMs / durationMs;
  const stepShare = loopShare / (values.length - 1);
  const keys: PartKey[] = [];
  for (let start = from; start < to - 1e-9; start += loopShare) {
    values.forEach((value, index) => {
      const at = start + index * stepShare;
      if (at <= to + 1e-9) keys.push({ at: Math.min(at, to), rotate: value });
    });
  }
  keys.push({ at: to, rotate: 0 });
  return dedupe([{ at: from, rotate: 0 }, ...keys]);
}

/** Two moments of the same part, in time order. */
export function mergeTracks(...tracks: readonly (readonly PartKey[])[]): PartKey[] {
  return tracks.flat().sort((a, b) => a.at - b.at);
}

function dedupe(keys: PartKey[]): PartKey[] {
  return keys.filter((key, index) => index === 0 || key.at !== keys[index - 1]!.at || key.rotate !== keys[index - 1]!.rotate);
}

/** The screen effects, the same on the app and the web: the path is in fractions of `amplitude` (px, or a share of the width for `squeeze`). */
export const SCREEN_EFFECTS: Record<ScreenEffect, { property: 'x' | 'scaleX'; amplitude: number; stepMs: number; path: readonly number[] }> = {
  knock: { property: 'x', amplitude: 10, stepMs: 40, path: [-1, 1, -0.6, 0.4, -0.2, 0] },
  crash: { property: 'x', amplitude: 16, stepMs: 45, path: [-1, 1, -1, 0.8, -0.7, 0.5, -0.3, 0.15, 0] },
  rumble: { property: 'x', amplitude: 4, stepMs: 50, path: [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -0.6, 0.6, -0.3, 0] },
  squeeze: { property: 'scaleX', amplitude: 0.05, stepMs: 150, path: [1, 0.4, 1, 0.4, 0] },
};
