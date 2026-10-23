import type { Sketch } from './winkTimeline.js';
import { appearAt, beats, burst, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, popAt, prop, rig, SIZE, sway, talk, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The Fiestas Patrias winks (pending 73; Stitch sheet `r153-fiestas-patrias`):
 * proud and exaggerated, with respect for the symbols. Each one a sketch with
 * a punchline, 6.5–7 s. PURE.
 */

const fireworks = (at: number) =>
  ([[0.22, 0.16, 0], [0.76, 0.14, 0.06], [0.5, 0.08, 0.12]] as const).map(([x, y, delay]) => prop('firework', burst(at + delay, x, y, 0.4, 0.16)));

/** «¡Viva el Perú!»: the worker waves the flag harder and harder, the rosettes pop, and fireworks close it. */
export function flag(): Sketch {
  const durationMs = 7000;
  const worker = character('flag-worker', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.44, ease: 'out' },
    { at: 0.6, y: FLOOR_Y },
    { at: 0.64, y: FLOOR_Y - 0.08, ease: 'out' },
    { at: 0.7, y: FLOOR_Y, ease: 'in' },
    { at: 0.88, x: 0.44 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 14),
    wiggle('arm-left', 0.18, 0.4, durationMs, 18, 260),
    wiggle('arm-left', 0.4, 0.6, durationMs, 34, 140),
    talk(0.6, 0.74, durationMs, 120, 2.2),
    walk(0.88, 0.99, durationMs, 140, 20)
  ));
  const rosettes = ([[0.7, 0.36, 0.3], [0.2, 0.4, 0.4]] as const).map(([x, y, at]) => prop('rosette', popAt(at, x, y, 0.14, 0.86)));
  return {
    durationMs,
    actors: [...rosettes, worker, ...fireworks(0.6)],
    cues: [{ at: 0.02, sound: 'rock' }, { at: 0.3, sound: 'pop' }, { at: 0.4, sound: 'pop' }, { at: 0.6, sound: 'cheer' }, { at: 0.62, sound: 'partyhorn', screen: 'rumble' }],
  };
}

/** The marinera: she dances side to side with the handkerchief in the air, a full turn, and the final pose gets applause. */
export function marinera(): Sketch {
  const durationMs = 7000;
  const dancer = character('marinera-dancer', [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0, rotate: 0 },
    { at: 0.04, opacity: 1 },
    ...sway('x', 0.06, 0.5, durationMs, 0.12, 700, 0.5),
    ...sway('rotate', 0.06, 0.5, durationMs, 6, 350, 0),
    { at: 0.54, rotate: 0, sx: 1 },
    { at: 0.6, sx: -1 },
    { at: 0.66, sx: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    wiggle('arm-right', 0.06, 0.66, durationMs, 25, 350),
    wiggle('leg-left', 0.06, 0.66, durationMs, 12, 175),
    wiggle('leg-right', 0.06, 0.66, durationMs, 12, 175, -1),
    wink('eye-left', 0.74)
  ));
  const handkerchief = prop('handkerchief', [...appearAt(0.06), { at: 0.06, x: 0.62, y: 0.3, scale: 0.16 }, ...sway('x', 0.06, 0.5, durationMs, 0.12, 700, 0.62), ...sway('rotate', 0.06, 0.66, durationMs, 20, 175, 0), { at: 0.9, opacity: 1 }, { at: 0.94, opacity: 0 }]);
  return {
    durationMs,
    actors: [dancer, handkerchief],
    cues: [{ at: 0.04, sound: 'groove' }, { at: 0.7, sound: 'clap' }, { at: 0.76, sound: 'clap' }, { at: 0.82, sound: 'cheer' }],
  };
}

/** The anticuchos: he fans the grill, tastes one, the chili gets him, and he runs off fanning himself. */
export function anticucho(): Sketch {
  const durationMs = 7000;
  const chef = character('anticucho-chef', [
    { at: 0, x: 0.36, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.76, x: 0.36 },
    ...sway('y', 0.62, 0.76, durationMs, 0.02, 80, FLOOR_Y),
    { at: 0.86, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    wiggle('arm-right', 0.06, 0.4, durationMs, 35, 130),
    { 'arm-left': [{ at: 0.42, rotate: 0 }, { at: 0.46, rotate: -110 }, { at: 0.5, rotate: -110 }, { at: 0.54, rotate: 0 }] },
    talk(0.48, 0.58, durationMs, 120, 1.6),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.58, scale: 1 }, { at: 0.6, scale: 1.6 }, { at: 0.76, scale: 1.6 }] })),
    { mouth: [{ at: 0.6, scaleY: 1 }, { at: 0.62, scaleY: 2.4 }, { at: 0.86, scaleY: 2.4 }] },
    wiggle('arm-right', 0.62, 0.86, durationMs, 40, 80),
    walk(0.76, 0.86, durationMs, 80, 32)
  ));
  const grill = prop('grill', [...popAt(0.04, 0.62, 0.66, 0.36, 0.9), ...sway('sy', 0.08, 0.4, durationMs, 0.03, 130, 1)]);
  const sweat = beats(0.6, 0.78, durationMs, 160).map((at, index) => prop('sweat', [...appearAt(at), { at, x: 0.36 + (index % 2 === 0 ? -0.06 : 0.06), y: 0.34, scale: 0.1 }, { at: at + 0.08, x: 0.36 + (index % 2 === 0 ? -0.2 : 0.2), y: 0.24, ease: 'out' }, { at: at + 0.08, opacity: 1 }, { at: at + 0.09, opacity: 0 }]));
  return {
    durationMs,
    actors: [grill, chef, ...sweat],
    cues: [{ at: 0.04, sound: 'sizzle' }, { at: 0.48, sound: 'pop' }, { at: 0.6, sound: 'alarm', screen: 'rumble' }, { at: 0.76, sound: 'whoosh' }],
  };
}

/** The parade: goose steps to the drum, he stops and salutes, and marches off stiff the other way. */
export function parade(): Sketch {
  const durationMs = 7000;
  const marcher = character('parade-marcher', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, sx: 1 },
    { at: 0.34, x: 0.5 },
    { at: 0.66, x: 0.5, sx: 1 },
    { at: 0.7, sx: -1 },
    { at: 0.99, x: OFF_LEFT, sx: -1 },
  ], rig(
    wiggle('leg-left', 0, 0.34, durationMs, 40, 280),
    wiggle('leg-right', 0, 0.34, durationMs, 10, 280, -1),
    { 'arm-right': [{ at: 0.38, rotate: 0 }, { at: 0.42, rotate: -150, ease: 'out' }, { at: 0.62, rotate: -150 }, { at: 0.66, rotate: 0 }] },
    wiggle('leg-left', 0.7, 0.99, durationMs, 40, 280),
    wiggle('leg-right', 0.7, 0.99, durationMs, 10, 280, -1)
  ));
  const drum = prop('drum', [...popAt(0.02, 0.8, 0.66, 0.22, 0.94), ...beats(0.02, 0.34, durationMs, 280).map((at, index) => ({ at, sy: index % 2 === 0 ? 0.9 : 1 }))]);
  return {
    durationMs,
    actors: [drum, marcher],
    cues: [...beats(0.02, 0.34, durationMs, 560).map((at) => ({ at, sound: 'thump' as const })), { at: 0.42, sound: 'horn' as const }, ...beats(0.7, 0.98, durationMs, 560).map((at) => ({ at, sound: 'thump' as const }))],
  };
}

/** Cheers with pisco: two glasses clink, he drinks it in one go, his eyes cross, a hiccup, and he leaves wobbling. */
export function pisco(): Sketch {
  const durationMs = 7000;
  const guy = character('pisco-toast', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, rotate: 0 },
    { at: 0.14, x: 0.4, ease: 'out' },
    ...sway('rotate', 0.6, 0.86, durationMs, 8, 200, 0),
    { at: 0.86, x: 0.4 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.14, durationMs, 240, 14),
    { 'arm-right': [{ at: 0.18, rotate: 0 }, { at: 0.22, rotate: -60, ease: 'out' }, { at: 0.34, rotate: -60 }, { at: 0.42, rotate: -150 }, { at: 0.52, rotate: -150 }, { at: 0.56, rotate: 0 }] },
    { head: [{ at: 0.4, rotate: 0 }, { at: 0.44, rotate: -25 }, { at: 0.52, rotate: -25 }, { at: 0.56, rotate: 0 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.56, scaleY: 1 }, { at: 0.58, scaleY: 0.4 }, { at: 0.84, scaleY: 0.4 }, { at: 0.86, scaleY: 1 }] })),
    wink('eye-left', 0.9),
    walk(0.86, 0.99, durationMs, 200, 24)
  ));
  const other = prop('pisco-glass', [...appearAt(0.2), { at: 0.2, x: 1.2, y: 0.46, scale: 0.16 }, { at: 0.3, x: 0.62, ease: 'out' }, { at: 0.34, x: 0.6 }, { at: 0.4, x: 1.2, ease: 'in' }, { at: 0.41, opacity: 0 }]);
  return {
    durationMs,
    actors: [guy, other],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.31, sound: 'glass' }, { at: 0.46, sound: 'drip' }, { at: 0.62, sound: 'pop' }, { at: 0.72, sound: 'pop' }, { at: 0.78, sound: 'laugh' }],
  };
}
