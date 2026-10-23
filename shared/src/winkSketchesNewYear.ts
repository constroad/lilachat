import type { ActorKey, Sketch } from './winkTimeline.js';
import { appearAt, beats, burst, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, popAt, prop, pump, rig, SIZE, sway, talk, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The New Year winks (pending 73; Stitch sheet `r153-anio-nuevo`): the
 * countdown, the twelve grapes, the suitcase around the block, all in yellow
 * and the toast. Each one a sketch with a punchline, 6.5–7 s. PURE.
 */

const fireworks = (at: number): ReturnType<typeof prop>[] =>
  ([[0.22, 0.18, 0], [0.72, 0.14, 0.05], [0.5, 0.08, 0.1]] as const).map(([x, y, delay]) => prop('firework', burst(at + delay, x, y, 0.42, 0.16)));

/** The foreman counts down with his stopwatch, the clock strikes twelve, fireworks, and he jumps so high his hat flies. */
export function countdown(): Sketch {
  const durationMs = 7000;
  const boss = character('countdown-boss', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.42, ease: 'out' },
    { at: 0.56, y: FLOOR_Y },
    { at: 0.62, y: FLOOR_Y - 0.12, ease: 'out' },
    { at: 0.7, y: FLOOR_Y, ease: 'in' },
    { at: 0.88, x: 0.42 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 14),
    { 'arm-left': [{ at: 0.18, rotate: 0 }, { at: 0.22, rotate: 120, ease: 'out' }, { at: 0.54, rotate: 120 }, { at: 0.58, rotate: 160 }, { at: 0.72, rotate: 0 }] },
    pump('head', 0.24, 0.54, durationMs, 10, 330),
    talk(0.24, 0.54, durationMs, 330, 2),
    { 'arm-right': [{ at: 0.56, rotate: 0 }, { at: 0.6, rotate: -160 }, { at: 0.74, rotate: -160 }, { at: 0.78, rotate: 0 }] },
    walk(0.88, 0.99, durationMs, 130, 22)
  ));
  const clock = prop('clock', popAt(0.2, 0.74, 0.3, 0.3, 0.6));
  return {
    durationMs,
    actors: [clock, boss, ...fireworks(0.56)],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.28, sound: 'ting' }, { at: 0.37, sound: 'ting' }, { at: 0.46, sound: 'ting' }, { at: 0.56, sound: 'partyhorn' }, { at: 0.58, sound: 'cheer', screen: 'rumble' }],
  };
}

/** The office guy races the clock with the twelve grapes: cheeks full, the clock strikes, he gives up and swallows them all at once. */
export function grapes(): Sketch {
  const durationMs = 7000;
  const guy = character('grape-guy', [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.62, sx: 1, sy: 1 },
    { at: 0.66, sx: 1.12, sy: 0.9, ease: 'out' },
    { at: 0.72, sx: 1, sy: 1 },
    { at: 0.92, opacity: 1 },
    { at: 0.99, opacity: 0 },
  ], rig(
    { 'arm-right': [{ at: 0.06, rotate: 0 }, ...beats(0.06, 0.6, durationMs, 260).map((at, index) => ({ at, rotate: index % 2 === 0 ? -110 : -20 })), { at: 0.62, rotate: 0 }] },
    talk(0.08, 0.6, durationMs, 130, 1.6),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.4, scale: 1 }, { at: 0.44, scale: 1.4 }, { at: 0.62, scale: 1.4 }, { at: 0.68, scale: 1 }] })),
    { mouth: [{ at: 0.62, scaleY: 1 }, { at: 0.66, scaleY: 2.4 }, { at: 0.7, scaleY: 0.6 }, { at: 0.78, scaleY: 1 }] },
    wink('eye-left', 0.84)
  ));
  const bunch = prop('grapes', popAt(0.04, 0.68, 0.62, 0.2, 0.6));
  const clock = prop('clock', [...appearAt(0.36), { at: 0.36, x: 0.24, y: 0.28, scale: 0.05 }, { at: 0.4, scale: 0.28, ease: 'out' }, ...sway('rotate', 0.4, 0.6, durationMs, 8, 90, 0), { at: 0.66, opacity: 1 }, { at: 0.7, opacity: 0 }]);
  return {
    durationMs,
    actors: [bunch, clock, guy],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.36, sound: 'alarm' }, { at: 0.64, sound: 'squeeze', screen: 'squeeze' }, { at: 0.72, sound: 'laugh' }],
  };
}

/** The suitcase around the block: he crosses with it at full speed, again a bit slower, and the third lap he barely makes it. */
export function suitcase(): Sketch {
  const durationMs = 7000;
  const laps: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, opacity: 1, rotate: 0 },
    { at: 0.18, x: OFF_RIGHT, ease: 'linear' },
    { at: 0.2, x: OFF_LEFT },
    { at: 0.44, x: OFF_RIGHT, ease: 'linear' },
    { at: 0.46, x: OFF_LEFT },
    { at: 0.64, x: 0.46, ease: 'out' },
    { at: 0.9, x: 0.46, rotate: 0, opacity: 1 },
    { at: 0.99, x: 0.46, y: FLOOR_Y + 0.08, rotate: 85, opacity: 0, ease: 'in' },
  ];
  const runner = character('suitcase-runner', laps, rig(
    walk(0, 0.18, durationMs, 120, 30),
    walk(0.2, 0.44, durationMs, 170, 24),
    walk(0.46, 0.64, durationMs, 260, 14),
    talk(0.66, 0.88, durationMs, 160, 2.2),
    wiggle('head', 0.66, 0.88, durationMs, 6, 160)
  ));
  // The suitcase rolls behind him on every lap, and falls over with him at the end.
  const bag = prop('suitcase', laps.map(({ x, ...key }) => ({ ...key, ...(x === undefined ? {} : { x: x - 0.14 }), y: 0.74, scale: 0.18 })));
  return {
    durationMs,
    actors: [bag, runner],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.22, sound: 'whoosh' }, { at: 0.5, sound: 'whoosh' }, { at: 0.68, sound: 'yawn' }, { at: 0.92, sound: 'thump' }],
  };
}

/** All in yellow for luck: thumbs up, stars around him, a little dance, and the party hat lands on his helmet. */
export function yellowLucky(): Sketch {
  const durationMs = 6500;
  const worker = character('yellow-lucky', [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE, rotate: 0 },
    { at: 0.16, x: 0.5, ease: 'out' },
    ...sway('rotate', 0.36, 0.66, durationMs, 7, 220, 0),
    { at: 0.88, x: 0.5 },
    { at: 0.99, x: OFF_LEFT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 16),
    { 'arm-right': [{ at: 0.18, rotate: 0 }, { at: 0.22, rotate: -120, ease: 'out' }, { at: 0.34, rotate: -120 }, { at: 0.38, rotate: 0 }] },
    wink('eye-left', 0.3),
    wiggle('leg-left', 0.36, 0.66, durationMs, 14, 220),
    wiggle('leg-right', 0.36, 0.66, durationMs, 14, 220, -1),
    walk(0.88, 0.99, durationMs, 140, 20)
  ));
  const stars = ([[0.3, 0.32, 0.2], [0.7, 0.36, 0.26], [0.5, 0.18, 0.32]] as const).map(([x, y, at]) => prop('star', burst(at, x, y, 0.14, 0.2)));
  const hat = prop('party-hat', [...appearAt(0.66), { at: 0.66, x: 0.5, y: -0.1, scale: 0.14, rotate: 30 }, { at: 0.74, y: 0.36, rotate: 0, ease: 'in' }, { at: 0.88, x: 0.5, y: 0.36 }, { at: 0.99, x: OFF_LEFT, y: 0.36, ease: 'in' }]);
  return {
    durationMs,
    actors: [worker, ...stars, hat],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.22, sound: 'ting' }, { at: 0.36, sound: 'rock' }, { at: 0.74, sound: 'boing' }, { at: 0.78, sound: 'laugh' }],
  };
}

/** The engineer pops the bottle, the foam sprays all over the screen, and she toasts anyway. */
export function toast(): Sketch {
  const durationMs = 7000;
  const engineer = character('toast-engineer', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.36, ease: 'out' },
    { at: 0.88, x: 0.36 },
    { at: 0.99, x: OFF_LEFT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 14),
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.46, scale: 1 }, { at: 0.48, scale: 1.5 }, { at: 0.6, scale: 1.5 }, { at: 0.64, scale: 1 }] })),
    { 'arm-right': [{ at: 0.66, rotate: 0 }, { at: 0.7, rotate: -150, ease: 'out' }, { at: 0.84, rotate: -150 }, { at: 0.88, rotate: 0 }] },
    talk(0.7, 0.8, durationMs, 110, 1.8),
    wink('eye-left', 0.8),
    walk(0.88, 0.99, durationMs, 140, 20)
  ));
  const bottle = prop('champagne-bottle', [...appearAt(0.18), { at: 0.18, x: 0.62, y: 0.6, scale: 0.05, rotate: 0 }, { at: 0.22, scale: 0.3, ease: 'out' }, ...sway('rotate', 0.24, 0.46, durationMs, 18, 80, 0), { at: 0.48, rotate: -25 }, { at: 0.62, opacity: 1 }, { at: 0.66, opacity: 0 }]);
  const foam = prop('splash', [...appearAt(0.47), { at: 0.47, x: 0.6, y: 0.4, scale: 0.4 }, { at: 0.52, x: 0.5, y: 0.45, scale: 2.2, ease: 'out' }, { at: 0.62, opacity: 1, y: 0.5 }, { at: 0.68, opacity: 0, y: 0.62, ease: 'in' }]);
  return {
    durationMs,
    actors: [engineer, bottle, foam],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.24, sound: 'squeeze' }, { at: 0.47, sound: 'pop', screen: 'knock' }, { at: 0.48, sound: 'splash' }, { at: 0.7, sound: 'glass' }, { at: 0.74, sound: 'cheer' }],
  };
}
