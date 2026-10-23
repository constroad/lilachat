import type { Sketch } from './winkTimeline.js';
import { burst, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, popAt, prop, rig, SIZE, sway, talk, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The Mother's Day winks (pending 73; the R153 Stitch sheet for that season):
 * loving and exaggerated, never sappy. Each one a sketch with a punchline,
 * 6.5–7 s. PURE.
 */

/** The multitasking mom: phone, keys, coffee, all at once, a full turn, and she is gone faster than she came. */
export function multitaskMom(): Sketch {
  const durationMs = 6500;
  const mom = character('multitask-mom', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, rotate: 0 },
    { at: 0.12, x: 0.46, ease: 'out' },
    { at: 0.66, rotate: 0 },
    { at: 0.74, rotate: 360 },
    { at: 0.8, x: 0.46, rotate: 360 },
    { at: 0.88, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.12, durationMs, 120, 26),
    wiggle('arm-right', 0.14, 0.4, durationMs, 30, 120),
    talk(0.2, 0.62, durationMs, 110, 1.9),
    wiggle('arm-left', 0.42, 0.64, durationMs, 25, 110),
    walk(0.8, 0.88, durationMs, 80, 34)
  ));
  const phone = prop('smartphone', popAt(0.16, 0.68, 0.38, 0.14, 0.4));
  const mug = prop('coffee-mug', popAt(0.42, 0.26, 0.5, 0.16, 0.64));
  return {
    durationMs,
    actors: [mom, phone, mug],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.16, sound: 'alarm' }, { at: 0.44, sound: 'ting' }, { at: 0.5, sound: 'ting' }, { at: 0.68, sound: 'whoosh' }, { at: 0.8, sound: 'whoosh' }],
  };
}

/** «¿Ya comiste?»: the grandma stirs, serves a cake, and every «¿más?» makes it bigger until it fills the screen. */
export function grandma(): Sketch {
  const durationMs = 7000;
  const cook = character('grandma-cook', [
    { at: 0, x: 0.34, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    wiggle('arm-right', 0.06, 0.32, durationMs, 35, 180),
    talk(0.34, 0.86, durationMs, 520, 2.2),
    wink('eye-left', 0.88)
  ));
  const ladle = prop('ladle', [...popAt(0.06, 0.5, 0.52, 0.18, 0.32), ...sway('rotate', 0.1, 0.32, durationMs, 25, 180, 0)]);
  const cake = prop('cake', [
    ...popAt(0.34, 0.64, 0.62, 0.2, 0.9),
    { at: 0.46, scale: 0.2 },
    { at: 0.5, scale: 0.42, y: 0.56, ease: 'out' },
    { at: 0.62, scale: 0.42 },
    { at: 0.66, scale: 0.8, x: 0.6, y: 0.5, ease: 'out' },
    { at: 0.76, scale: 0.8 },
    { at: 0.8, scale: 1.6, x: 0.5, y: 0.5, ease: 'out' },
  ]);
  return {
    durationMs,
    actors: [cook, ladle, cake],
    cues: [{ at: 0.04, sound: 'groove' }, { at: 0.08, sound: 'sizzle' }, { at: 0.36, sound: 'pop' }, { at: 0.5, sound: 'pop' }, { at: 0.66, sound: 'pop' }, { at: 0.8, sound: 'boing', screen: 'squeeze' }, { at: 0.84, sound: 'laugh' }],
  };
}

/** The son who arrives late: tiptoes in, hides the flowers, presents them with a nervous grin, and the card pops out. */
export function lateSon(): Sketch {
  const durationMs = 7000;
  const son = character('late-son', [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE },
    { at: 0.34, x: 0.56 },
    { at: 0.88, x: 0.56 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.34, durationMs, 420, 10),
    { 'arm-left': [{ at: 0.36, rotate: 0 }, { at: 0.42, rotate: 90, ease: 'out' }, { at: 0.84, rotate: 90 }, { at: 0.88, rotate: 0 }] },
    { mouth: [{ at: 0.42, scale: 1 }, { at: 0.46, scale: 1.4 }, { at: 0.84, scale: 1.4 }, { at: 0.88, scale: 1 }] },
    walk(0.88, 0.99, durationMs, 120, 22)
  ));
  const flowers = prop('flower-bouquet', [
    { at: 0, x: OFF_RIGHT + 0.14, y: 0.6, scale: 0.24, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.34, x: 0.7 },
    { at: 0.4, x: 0.7 },
    { at: 0.46, x: 0.4, y: 0.5, scale: 0.4, ease: 'out' },
    { at: 0.86, x: 0.4 },
    { at: 0.9, opacity: 1 },
    { at: 0.94, opacity: 0 },
  ]);
  const card = prop('heart-card', burst(0.58, 0.36, 0.28, 0.26, 0.3));
  const sweat = ([[0.62, 0.32, 0.2], [0.5, 0.3, 0.5]] as const).map(([x, y, at]) => prop('sweat', [...popAt(at, x, y, 0.1, at + 0.1)]));
  return {
    durationMs,
    actors: [son, flowers, card, ...sweat],
    cues: [{ at: 0.02, sound: 'squeeze' }, { at: 0.46, sound: 'chime' }, { at: 0.58, sound: 'pop' }, { at: 0.62, sound: 'smooch' }, { at: 0.7, sound: 'laugh' }],
    particlesAt: [0.48, 0.66],
  };
}

/** The engineer mom reviews the plan, stamps it approved (the whole screen shakes) and takes a sip of coffee. */
export function engineerMom(): Sketch {
  const durationMs = 6500;
  const mom = character('engineer-mom', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.44, ease: 'out' },
    { at: 0.88, x: 0.44 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 14),
    { head: [{ at: 0.18, rotate: 0 }, { at: 0.22, rotate: 8 }, { at: 0.3, rotate: -6 }, { at: 0.38, rotate: 8 }, { at: 0.44, rotate: 0 }] },
    { 'arm-right': [{ at: 0.44, rotate: 0 }, { at: 0.48, rotate: -150, ease: 'out' }, { at: 0.52, rotate: 20, ease: 'in' }, { at: 0.56, rotate: 0 }, { at: 0.66, rotate: 0 }, { at: 0.7, rotate: -100 }, { at: 0.82, rotate: -100 }, { at: 0.86, rotate: 0 }] },
    wink('eye-left', 0.6),
    walk(0.88, 0.99, durationMs, 140, 18)
  ));
  const mug = prop('coffee-mug', popAt(0.66, 0.6, 0.42, 0.14, 0.86));
  const stars = ([[0.3, 0.3], [0.62, 0.26]] as const).map(([x, y]) => prop('star', burst(0.52, x, y, 0.14, 0.16)));
  return {
    durationMs,
    actors: [mom, mug, ...stars],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.52, sound: 'thump', screen: 'knock' }, { at: 0.54, sound: 'ting' }, { at: 0.72, sound: 'drip' }],
  };
}

/** Mom's voice note: she talks and talks into the phone, the clock spins round and round, and she ends it with a wink. */
export function voiceNote(): Sketch {
  const durationMs = 7000;
  const mom = character('voice-note-mom', [
    { at: 0, x: 0.42, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    talk(0.06, 0.82, durationMs, 110, 1.9),
    wiggle('arm-right', 0.08, 0.82, durationMs, 30, 260),
    wiggle('head', 0.08, 0.82, durationMs, 6, 400),
    wink('eye-left', 0.88)
  ));
  const clock = prop('clock', [...popAt(0.2, 0.76, 0.28, 0.26, 0.84), { at: 0.24, rotate: 0 }, { at: 0.82, rotate: 1440, ease: 'linear' }]);
  return {
    durationMs,
    actors: [mom, clock],
    cues: [{ at: 0.04, sound: 'groove' }, { at: 0.3, sound: 'laugh' }, { at: 0.6, sound: 'yawn' }, { at: 0.84, sound: 'ting' }],
  };
}
