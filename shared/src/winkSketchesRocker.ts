import type { Sketch } from './winkTimeline.js';
import { appearAt, beats, burst, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, popAt, prop, pump, rig, SIZE, sway, talk, walk, wiggle } from './winkSketchKit.js';

/**
 * «Rockero furioso» (pending 77, José 23/10, like Messenger's): he plays
 * hard, a string snaps, the anger cloud comes, he smashes the guitar on the
 * floor and kicks the amp on his way out. Stitch sheet `r154-rockero`. PURE.
 */
export function rocker(): Sketch {
  const durationMs = 7000;
  const man = character('angry-rocker', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.12, x: 0.46, ease: 'out' },
    ...sway('x', 0.4, 0.5, durationMs, 0.01, 60, 0.46),
    { at: 0.84, x: 0.46 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.12, durationMs, 200, 18),
    wiggle('arm-right', 0.14, 0.34, durationMs, 30, 110),
    pump('head', 0.14, 0.34, durationMs, 18, 220),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.34, scale: 1 }, { at: 0.36, scale: 1.5 }, { at: 0.42, scale: 1.5 }, { at: 0.46, scale: 0.9 }] })),
    { 'arm-left': [{ at: 0.5, rotate: 0 }, { at: 0.55, rotate: 160, ease: 'out' }, { at: 0.58, rotate: 40, ease: 'in' }, { at: 0.64, rotate: 0 }] },
    { 'arm-right': [{ at: 0.5, rotate: 0 }, { at: 0.55, rotate: -160, ease: 'out' }, { at: 0.58, rotate: -40, ease: 'in' }, { at: 0.64, rotate: 0 }] },
    talk(0.6, 0.76, durationMs, 160, 2.2),
    { 'leg-left': [{ at: 0.76, rotate: 0 }, { at: 0.79, rotate: 60, ease: 'out' }, { at: 0.83, rotate: 0 }] },
    walk(0.84, 0.99, durationMs, 160, 22)
  ));
  // The guitar goes with him, rocks while he plays, up over his head, and down onto the floor.
  const guitar = prop('guitar', [
    { at: 0, x: OFF_LEFT + 0.04, y: 0.66, scale: 0.4, rotate: -30, opacity: 1 },
    { at: 0.12, x: 0.5, ease: 'out' },
    ...sway('rotate', 0.14, 0.34, durationMs, 6, 110, -30),
    { at: 0.5, x: 0.5, y: 0.66, rotate: -30 },
    { at: 0.55, x: 0.48, y: 0.24, rotate: -170, ease: 'out' },
    { at: 0.58, x: 0.52, y: 0.84, rotate: 20, ease: 'in' },
    { at: 0.585, opacity: 1 },
    { at: 0.59, opacity: 0 },
  ]);
  const strings = prop('guitar-strings', burst(0.34, 0.56, 0.58, 0.22, 0.14));
  const cloud = prop('anger-cloud', [...popAt(0.4, 0.46, 0.2, 0.32, 0.6), ...sway('x', 0.44, 0.6, durationMs, 0.01, 60, 0.46)]);
  const pieces = ([[0.2, 0.7, -260, -0.2, -480], [0.78, 0.66, 300, 1.2, 520], [0.5, 0.5, 200, 0.6, 400]] as const).map(([x, y, spin, endX, endSpin]) =>
    prop('guitar-piece', [...appearAt(0.59), { at: 0.59, x: 0.52, y: 0.84, scale: 0.3, rotate: 0 }, { at: 0.68, x, y, rotate: spin, ease: 'out' }, { at: 0.86, x: endX, y: 1.2, rotate: endSpin, ease: 'in' }]));
  const amp = prop('amplifier', [...appearAt(0.02), { at: 0.02, x: 0.2, y: 0.72, scale: 0.05, rotate: 0 }, { at: 0.06, scale: 0.3, ease: 'out' }, ...beats(0.14, 0.34, durationMs, 220).map((at, index) => ({ at, scale: index % 2 === 0 ? 0.32 : 0.3 })), { at: 0.79, rotate: 0, x: 0.2 }, { at: 0.84, rotate: -90, x: 0.1, y: 0.78, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 0.95, opacity: 0 }]);
  return {
    durationMs,
    actors: [amp, man, guitar, strings, cloud, ...pieces],
    cues: [{ at: 0.02, sound: 'rock' }, { at: 0.34, sound: 'boing' }, { at: 0.42, sound: 'rumble', screen: 'rumble' }, { at: 0.58, sound: 'crash', screen: 'knock' }, { at: 0.8, sound: 'thump' }],
  };
}
