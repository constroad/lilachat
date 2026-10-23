import type { Sketch } from './winkTimeline.js';
import { appearAt, beats, burst, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, popAt, prop, rig, SIZE, sway, talk, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The Valentine winks (pending 73; Stitch sheet `r153-san-valentin`):
 * romance with a joke, never sappy. Each one a sketch with a punchline,
 * 6.5–7 s. PURE.
 */

/** The cupid intern aims, shoots, misses, and the arrow comes back around and gets him: he falls in love with himself. */
export function cupid(): Sketch {
  const durationMs = 7000;
  const intern = character('cupid-intern', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.14, x: 0.34, ease: 'out' },
    { at: 0.66, x: 0.34, rotate: 0 },
    { at: 0.7, x: 0.3, rotate: -8, ease: 'out' },
    { at: 0.76, x: 0.34, rotate: 0 },
    { at: 0.9, x: 0.34 },
    { at: 0.99, x: OFF_LEFT, ease: 'in' },
  ], rig(
    walk(0, 0.14, durationMs, 240, 14),
    { 'arm-left': [{ at: 0.16, rotate: 0 }, { at: 0.22, rotate: 80, ease: 'out' }, { at: 0.36, rotate: 80 }, { at: 0.4, rotate: 0 }] },
    wink('eye-left', 0.28, 0.08),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.7, scale: 1 }, { at: 0.73, scale: 1.5 }, { at: 0.88, scale: 1.5 }, { at: 0.9, scale: 1 }] })),
    walk(0.9, 0.99, durationMs, 140, 20)
  ));
  // Out to the right, round the back of the screen, and in from the left into him.
  const arrow = prop('heart-arrow', [...appearAt(0.38), { at: 0.38, x: 0.46, y: 0.48, scale: 0.22, sx: 1 }, { at: 0.5, x: 1.4, ease: 'in' }, { at: 0.56, x: -0.4, sx: 1 }, { at: 0.66, x: 0.3, ease: 'in' }, { at: 0.67, opacity: 1 }, { at: 0.68, opacity: 0 }]);
  const balloon = prop('heart-balloon', [...appearAt(0.7), { at: 0.7, x: 0.34, y: 0.4, scale: 0.05 }, { at: 0.76, y: 0.22, scale: 0.26, ease: 'out' }, ...sway('y', 0.76, 0.9, durationMs, 0.015, 220, 0.22), { at: 0.94, opacity: 1 }, { at: 0.99, y: -0.3, opacity: 0, ease: 'in' }]);
  return {
    durationMs,
    actors: [intern, arrow, balloon],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.38, sound: 'whoosh' }, { at: 0.56, sound: 'whoosh' }, { at: 0.67, sound: 'knock', screen: 'knock' }, { at: 0.72, sound: 'smooch' }],
    particlesAt: [0.7, 0.86],
  };
}

/** The courier rushes in with a huge bouquet, hands it over (it fills the screen), and waits with his hand out for the payment. */
export function roses(): Sketch {
  const durationMs = 7000;
  const courier = character('roses-courier', [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE },
    { at: 0.18, x: 0.6, ease: 'out' },
    { at: 0.9, x: 0.6 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.18, durationMs, 160, 22),
    { 'arm-left': [{ at: 0.6, rotate: 0 }, { at: 0.64, rotate: 70, ease: 'out' }, { at: 0.86, rotate: 70 }, { at: 0.9, rotate: 0 }] },
    wiggle('leg-right', 0.66, 0.86, durationMs, 10, 160),
    { mouth: [{ at: 0.64, scale: 1 }, { at: 0.68, scale: 1.3 }, { at: 0.86, scale: 1.3 }, { at: 0.9, scale: 1 }] },
    walk(0.9, 0.99, durationMs, 120, 22)
  ));
  const bouquet = prop('rose-bouquet', [
    { at: 0, x: OFF_RIGHT - 0.12, y: 0.56, scale: 0.3, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.18, x: 0.48, ease: 'out' },
    { at: 0.26, x: 0.48, scale: 0.3 },
    { at: 0.34, x: 0.5, y: 0.5, scale: 1.6, ease: 'out' },
    { at: 0.5, scale: 1.6 },
    { at: 0.56, x: 0.2, y: 0.56, scale: 0.3, ease: 'in' },
    { at: 0.9, opacity: 1 },
    { at: 0.94, opacity: 0 },
  ]);
  return {
    durationMs,
    actors: [courier, bouquet],
    cues: [{ at: 0.02, sound: 'horn' }, { at: 0.12, sound: 'horn' }, { at: 0.34, sound: 'chime' }, { at: 0.66, sound: 'knock' }, { at: 0.74, sound: 'knock' }, { at: 0.82, sound: 'knock' }],
  };
}

/** The serenade: guitar and voice with his eyes shut, someone throws a bucket of water from the window, and he keeps singing. */
export function serenade(): Sketch {
  const durationMs = 7000;
  const singer = character('serenader', [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.5, sy: 1 },
    { at: 0.54, sy: 0.92, ease: 'out' },
    { at: 0.6, sy: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    wiggle('arm-right', 0.06, 0.9, durationMs, 18, 140),
    talk(0.08, 0.48, durationMs, 260, 2),
    talk(0.62, 0.9, durationMs, 260, 2),
    wiggle('head', 0.08, 0.9, durationMs, 5, 520)
  ));
  const water = prop('splash', [...appearAt(0.48), { at: 0.48, x: 0.5, y: -0.1, scale: 0.6 }, { at: 0.52, y: 0.36, scale: 1.4, ease: 'in' }, { at: 0.58, y: 0.5, opacity: 1 }, { at: 0.66, y: 0.7, opacity: 0, ease: 'in' }]);
  const drips = ([[0.44, 0.3, 0.56], [0.56, 0.32, 0.6], [0.5, 0.28, 0.64]] as const).map(([x, y, at]) => prop('drip', [...appearAt(at), { at, x, y, scale: 0.12 }, { at: at + 0.12, y: 0.78, ease: 'in' }, { at: at + 0.12, opacity: 1 }, { at: at + 0.13, opacity: 0 }]));
  return {
    durationMs,
    actors: [singer, water, ...drips],
    cues: [{ at: 0.04, sound: 'rock' }, { at: 0.5, sound: 'splash', screen: 'rumble' }, { at: 0.6, sound: 'drip' }, { at: 0.66, sound: 'rock' }],
  };
}

/** Stood up: she checks her watch, taps her foot, the clock goes round, and she leaves happy eating the chocolates herself. */
export function stoodUp(): Sketch {
  const durationMs = 7000;
  const woman = character('stood-up', [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE },
    { at: 0.14, x: 0.56, ease: 'out' },
    { at: 0.86, x: 0.56 },
    { at: 0.99, x: OFF_LEFT, ease: 'in' },
  ], rig(
    walk(0, 0.14, durationMs, 240, 14),
    { 'arm-left': [{ at: 0.16, rotate: 0 }, { at: 0.2, rotate: 90, ease: 'out' }, { at: 0.28, rotate: 90 }, { at: 0.32, rotate: 0 }, { at: 0.42, rotate: 0 }, { at: 0.46, rotate: 90 }, { at: 0.52, rotate: 90 }, { at: 0.56, rotate: 0 }] },
    wiggle('leg-right', 0.2, 0.56, durationMs, 12, 140),
    wiggle('head', 0.56, 0.62, durationMs, 10, 80),
    talk(0.7, 0.86, durationMs, 140, 1.8),
    walk(0.86, 0.99, durationMs, 180, 18)
  ));
  const clock = prop('clock', [...appearAt(0.2), { at: 0.2, x: 0.24, y: 0.28, scale: 0.05, rotate: 0 }, { at: 0.24, scale: 0.26, ease: 'out' }, { at: 0.58, rotate: 720, ease: 'linear' }, { at: 0.62, opacity: 1 }, { at: 0.66, opacity: 0 }]);
  const box = prop('chocolate-box', popAt(0.64, 0.4, 0.58, 0.2, 0.86));
  return {
    durationMs,
    actors: [clock, woman, box],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.22, sound: 'knock' }, { at: 0.34, sound: 'knock' }, { at: 0.46, sound: 'knock' }, { at: 0.58, sound: 'alarm' }, { at: 0.66, sound: 'pop' }, { at: 0.74, sound: 'laugh' }],
  };
}

/** Heartbroken: the drama, tears flying, down on his knees, and a box of chocolates brings him back in a second. */
export function heartbroken(): Sketch {
  const durationMs = 7000;
  const guy = character('heartbroken', [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.36, y: FLOOR_Y, sy: 1 },
    { at: 0.42, y: FLOOR_Y + 0.06, sy: 0.85, ease: 'out' },
    { at: 0.62, y: FLOOR_Y + 0.06, sy: 0.85 },
    { at: 0.66, y: FLOOR_Y - 0.08, sy: 1.05, ease: 'out' },
    { at: 0.72, y: FLOOR_Y, sy: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    { 'arm-left': [{ at: 0.06, rotate: 0 }, { at: 0.1, rotate: 140, ease: 'out' }, { at: 0.34, rotate: 140 }, { at: 0.38, rotate: 0 }] },
    wiggle('head', 0.12, 0.6, durationMs, 8, 300),
    talk(0.12, 0.34, durationMs, 300, 2.2),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.64, scale: 1 }, { at: 0.66, scale: 1.5 }, { at: 0.76, scale: 1.5 }, { at: 0.8, scale: 1 }] })),
    { 'arm-right': [{ at: 0.66, rotate: 0 }, { at: 0.7, rotate: -150, ease: 'out' }, { at: 0.86, rotate: -150 }, { at: 0.9, rotate: 0 }] }
  ));
  const broken = prop('broken-heart', popAt(0.08, 0.5, 0.26, 0.2, 0.6));
  const tears = beats(0.14, 0.58, durationMs, 440).map((at, index) => prop('drip', [...appearAt(at), { at, x: 0.5 + (index % 2 === 0 ? -0.08 : 0.08), y: 0.36, scale: 0.1 }, { at: at + 0.08, x: 0.5 + (index % 2 === 0 ? -0.26 : 0.26), y: 0.6, ease: 'in' }, { at: at + 0.08, opacity: 1 }, { at: at + 0.09, opacity: 0 }]));
  const box = prop('chocolate-box', burst(0.62, 0.5, 0.36, 0.3, 0.3));
  return {
    durationMs,
    actors: [broken, guy, ...tears, box],
    cues: [{ at: 0.02, sound: 'drip' }, { at: 0.14, sound: 'drip' }, { at: 0.4, sound: 'thump' }, { at: 0.64, sound: 'chime' }, { at: 0.68, sound: 'cheer' }],
  };
}
