/**
 * How the wink characters move (José, 21/10: full body and body movement, not
 * just turning it; then: MSN's was funnier and its dance lasted longer). Each character is a puppet: its parts
 * (`WinkPart`) turn around their joints (shoulder, hip, neck, the root of the
 * tail). A dance is one long loop of evenly spaced values per part, with
 * several moves inside, that repeats for the whole wink (about 6.5 s); the app
 * (Reanimated) and the web (Web Animations) play the same numbers.
 *
 * Every value is an OFFSET from the drawn pose, starting and ending at 0: the
 * characters come posed (an arm pointing up, the biceps out) and that pose is
 * the gag, so a dance moves around it instead of forcing absolute angles.
 *
 * Conventions: «left» is the viewer's left; `rotate` is in degrees, clockwise
 * on screen (a left arm that rises outward turns +, a right one −); `x` and
 * `y` move in units of the character's viewBox (240 × 320). PURE.
 */
export type WinkPart = 'leg-left' | 'leg-right' | 'tail' | 'body' | 'head' | 'arm-left' | 'arm-right';
export type WinkDance = 'disco' | 'cumbia' | 'clap' | 'jump' | 'hug' | 'laugh' | 'wave' | 'flex' | 'rock' | 'tired';
export type PartMotion = { rotate?: readonly number[]; x?: readonly number[]; y?: readonly number[] };
export type Dance = { loopMs: number; whole?: PartMotion; parts: Partial<Record<WinkPart, PartMotion>> };

export const DANCES: Record<WinkDance, Dance> = {
  // The disco groove: the raised arm pumps to the beat, the hips pop side to side, the head bobs.
  disco: {
    loopMs: 2200,
    whole: { x: [0, -12, 0, 12, 0, -10, 0, 10, 0], y: [0, -8, 0, -8, 0, -8, 0, -8, 0] },
    parts: {
      'arm-right': { rotate: [0, -25, 10, -25, 10, -30, 15, -30, 0] },
      'arm-left': { rotate: [0, 18, 0, 18, 0, 25, 0, 25, 0] },
      body: { rotate: [0, -8, 0, 8, 0, -8, 0, 8, 0] },
      head: { rotate: [0, 10, 0, -10, 0, 10, 0, -10, 0] },
      'leg-left': { rotate: [0, 14, 0, -6, 0, 14, 0, -6, 0] },
      'leg-right': { rotate: [0, 6, 0, -14, 0, 6, 0, -14, 0] },
      tail: { rotate: [0, -30, 30, -30, 30, -30, 30, -30, 0] },
    },
  },
  // A cumbia side step: hips side to side, shoulders bouncing, arms swinging in turns.
  cumbia: {
    loopMs: 1600,
    whole: { x: [0, -14, 0, 14, 0], y: [0, -5, 0, -5, 0] },
    parts: {
      body: { rotate: [0, -8, 0, 8, 0] },
      head: { rotate: [0, 6, -4, -6, 0] },
      'arm-left': { rotate: [0, 28, 0, -10, 0] },
      'arm-right': { rotate: [0, 10, 0, -28, 0] },
      'leg-left': { rotate: [0, 14, 0, -6, 0] },
      'leg-right': { rotate: [0, 6, 0, -14, 0] },
      tail: { rotate: [0, -25, 25, -25, 0] },
    },
  },
  // Wild claps, then a hop with the arms thrown up.
  clap: {
    loopMs: 1800,
    whole: { y: [0, -5, 0, -5, 0, -5, 0, -34, 0] },
    parts: {
      'arm-left': { rotate: [0, -40, 0, -40, 0, -40, 0, 70, 0] },
      'arm-right': { rotate: [0, 40, 0, 40, 0, 40, 0, -70, 0] },
      head: { rotate: [0, 6, 0, 6, 0, 6, 0, -8, 0] },
      'leg-left': { rotate: [0, 4, 0, 4, 0, 4, 0, -14, 0] },
      'leg-right': { rotate: [0, -4, 0, -4, 0, -4, 0, 14, 0] },
    },
  },
  // A party jump: arms up, legs tucked, and a wobble on landing.
  jump: {
    loopMs: 1400,
    whole: { y: [0, -48, -48, 0, -10, 0] },
    parts: {
      'arm-left': { rotate: [0, 60, 60, 0, 25, 0] },
      'arm-right': { rotate: [0, -60, -60, 0, -25, 0] },
      'leg-left': { rotate: [0, -16, -16, 0, 8, 0] },
      'leg-right': { rotate: [0, 16, 16, 0, -8, 0] },
      head: { rotate: [0, -6, 6, 0, -10, 0] },
      body: { rotate: [0, 0, 0, 0, 6, 0] },
      tail: { rotate: [0, 30, -30, 0, 20, 0] },
    },
  },
  // The open arms close in a hug and open again, swaying.
  hug: {
    loopMs: 2000,
    whole: { x: [0, -8, 8, 0, 0], y: [0, -6, 0, -6, 0] },
    parts: {
      'arm-left': { rotate: [0, 10, -55, -55, 0] },
      'arm-right': { rotate: [0, -10, 55, 55, 0] },
      body: { rotate: [0, -6, 6, 0, 0] },
      head: { rotate: [0, -10, 10, 4, 0] },
      'leg-left': { rotate: [0, 6, -4, 0, 0] },
      'leg-right': { rotate: [0, 4, -6, 0, 0] },
    },
  },
  // Belly laughing: the body shakes, the head goes back, the pointing hand jabs.
  laugh: {
    loopMs: 1200,
    whole: { y: [0, -6, 0, -6, 0, -6, 0] },
    parts: {
      body: { rotate: [0, 5, -5, 5, -5, 5, 0] },
      head: { rotate: [0, -14, -2, -14, -2, -14, 0] },
      'arm-left': { rotate: [0, -10, 0, -10, 0, -10, 0] },
      'arm-right': { rotate: [0, -14, 0, -14, 0, -14, 0] },
      'leg-left': { rotate: [0, 6, 0, 6, 0, 6, 0] },
      'leg-right': { rotate: [0, -6, 0, -6, 0, -6, 0] },
    },
  },
  // Waving big with one arm, tapping a foot.
  wave: {
    loopMs: 1600,
    whole: { y: [0, -6, 0, -6, 0] },
    parts: {
      'arm-right': { rotate: [0, -35, 0, -35, 0] },
      'arm-left': { rotate: [0, 8, 0, 8, 0] },
      head: { rotate: [0, -6, 6, -6, 0] },
      'leg-left': { rotate: [0, 12, 0, 12, 0] },
      'leg-right': { rotate: [0, -3, 0, -3, 0] },
    },
  },
  // Bodybuilder pumps: the arms flex to the beat, a turn to each side, chest out.
  flex: {
    loopMs: 2000,
    whole: { x: [0, 0, -8, 8, 0], y: [0, -8, -8, -8, 0] },
    parts: {
      'arm-left': { rotate: [0, 18, 0, 18, 0] },
      'arm-right': { rotate: [0, -18, 0, -18, 0] },
      body: { rotate: [0, 0, -8, 8, 0] },
      head: { rotate: [0, -8, 8, -8, 0] },
      'leg-left': { rotate: [0, 10, 10, 10, 0] },
      'leg-right': { rotate: [0, -10, -10, -10, 0] },
    },
  },
  // Rock horns pumping and headbanging.
  rock: {
    loopMs: 1200,
    whole: { y: [0, -8, 0, -8, 0] },
    parts: {
      'arm-left': { rotate: [0, -22, 0, -22, 0] },
      'arm-right': { rotate: [0, 22, 0, 22, 0] },
      head: { rotate: [0, 18, 0, 18, 0] },
      body: { rotate: [0, 6, 0, 6, 0] },
      'leg-left': { rotate: [0, 10, 0, 10, 0] },
      'leg-right': { rotate: [0, -10, 0, -10, 0] },
    },
  },
  // Monday tired: a slow sway, wiping the forehead, the head drooping.
  tired: {
    loopMs: 2200,
    whole: { x: [0, -6, 0, 6, 0], y: [0, 4, 0, 4, 0] },
    parts: {
      'arm-right': { rotate: [0, -40, -50, -40, 0] },
      'arm-left': { rotate: [0, 6, 0, 6, 0] },
      head: { rotate: [0, 12, 4, 12, 0] },
      body: { rotate: [0, -4, 0, 4, 0] },
      'leg-left': { rotate: [0, 4, 0, 4, 0] },
      'leg-right': { rotate: [0, -4, 0, -4, 0] },
    },
  },
};

/** How many loops of a dance it takes to fill the whole wink (it fades out at the end). */
export function loopsFor(durationMs: number, loopMs: number): number {
  return Math.max(1, Math.ceil(durationMs / loopMs));
}
