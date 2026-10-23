import type { ActorKey, Sketch } from './winkTimeline.js';
import { appearAt, beats, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, prop, rig, SIZE, sway, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The Halloween winks (pending 73, José 22/10; Stitch sheet
 * `r151-halloween`): office and site jokes with a scare that is a joke, never
 * gore. Each one a sketch with a punchline, 6–7 s. PURE.
 */

/** The pumpkin site worker takes his head off to show the candy inside, puts it back crooked and it spins. */
export function pumpkin(): Sketch {
  const durationMs = 6500;
  const guy = character('pumpkin-guy', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.18, x: 0.45, ease: 'out' },
    { at: 0.86, x: 0.45 },
    { at: 0.98, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.18, durationMs, 240, 16),
    { 'arm-left': [{ at: 0.2, rotate: 0 }, { at: 0.28, rotate: 150 }, { at: 0.5, rotate: 150 }, { at: 0.56, rotate: 0 }] },
    { 'arm-right': [{ at: 0.2, rotate: 0 }, { at: 0.28, rotate: -150 }, { at: 0.5, rotate: -150 }, { at: 0.56, rotate: 0 }] },
    // Off goes the head, it shakes the candy out, back on crooked, and it spins on its own.
    { head: [{ at: 0.28, rotate: 0, scale: 1 }, { at: 0.34, rotate: -25, scale: 1.1 }, ...beats(0.34, 0.48, durationMs, 110).map((at, index) => ({ at, rotate: index % 2 === 0 ? -35 : -15 })), { at: 0.56, rotate: 12, scale: 1 }, { at: 0.64, rotate: 12 }, { at: 0.74, rotate: 372, ease: 'in' as const }, { at: 0.78, rotate: 360 }] },
    wink('eye-left', 0.6),
    walk(0.86, 0.98, durationMs, 130, 24)
  ));
  const bucket = prop('candy-bucket', [...appearAt(0.34), { at: 0.34, x: 0.66, y: 0.74, scale: 0.05 }, { at: 0.4, scale: 0.28, ease: 'out' }, ...sway('rotate', 0.4, 0.5, durationMs, 10, 90, 0), { at: 0.86, opacity: 1 }, { at: 0.9, opacity: 0 }]);
  return {
    durationMs,
    actors: [bucket, guy],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.34, sound: 'pop' }, { at: 0.42, sound: 'pop' }, { at: 0.56, sound: 'thump' }, { at: 0.7, sound: 'whoosh' }, { at: 0.78, sound: 'boing' }],
    particlesAt: [0.36, 0.5],
  };
}

/** The vampire boss shows the contract («firma aquí»), bats fly out of his cape and he leaves as one. */
export function vampire(): Sketch {
  const durationMs = 7000;
  // He rises from behind his coffin, which stands in front of him and then goes.
  const boss = character('vampire-boss', [
    { at: 0, x: 0.5, y: FLOOR_Y + 0.3, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.14, y: FLOOR_Y, ease: 'out' },
    { at: 0.74, scale: SIZE, opacity: 1 },
    { at: 0.8, scale: SIZE * 0.2, opacity: 0, ease: 'in' },
  ], rig(
    { 'arm-right': [{ at: 0.1, rotate: 0 }, { at: 0.16, rotate: -70 }, ...beats(0.16, 0.36, durationMs, 160).map((at, index) => ({ at, rotate: index % 2 === 0 ? -80 : -60 })), { at: 0.4, rotate: 0 }] },
    { 'arm-left': [{ at: 0.42, rotate: 0 }, { at: 0.48, rotate: 110 }, { at: 0.62, rotate: 110 }, { at: 0.66, rotate: 0 }] },
    { mouth: [{ at: 0.44, scaleY: 1 }, ...beats(0.46, 0.62, durationMs, 120).map((at, index) => ({ at, scaleY: index % 2 === 0 ? 1.8 : 1 })), { at: 0.64, scaleY: 1 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.14, scale: 1 }, { at: 0.18, scale: 1.35 }, { at: 0.36, scale: 1.35 }, { at: 0.4, scale: 1 }] }))
  ));
  const coffin = prop('coffin', [...appearAt(0.01), { at: 0.01, x: 0.5, y: 0.8, scale: 0.46 }, { at: 0.14, opacity: 1 }, { at: 0.2, opacity: 0, y: 0.9 }]);
  const bats = ([[0.3, 0.2, 0.46], [0.7, 0.28, 0.5], [0.15, 0.4, 0.54]] as const).map(([x, y, at]) => prop('bat', [...appearAt(at), { at, x: 0.5, y: 0.45, scale: 0.05 }, { at: at + 0.08, x, y, scale: 0.3, ease: 'out' }, ...sway('y', at + 0.08, 0.7, durationMs, 0.02, 140, y), { at: 0.74, x: 1.5, y: -0.2, ease: 'in' }]));
  // The punchline: he leaves as one more bat.
  const leaving = prop('bat', [...appearAt(0.78), { at: 0.78, x: 0.5, y: 0.5, scale: 0.1 }, { at: 0.84, scale: 0.4, ease: 'out' }, ...sway('y', 0.84, 0.92, durationMs, 0.03, 100, 0.45), { at: 0.99, x: -0.4, y: 0.1, ease: 'in' }]);
  return {
    durationMs,
    actors: [boss, coffin, ...bats, leaving],
    cues: [{ at: 0.02, sound: 'rock' }, { at: 0.04, sound: 'knock' }, { at: 0.16, sound: 'knock', screen: 'knock' }, { at: 0.46, sound: 'whoosh' }, { at: 0.48, sound: 'laugh' }, { at: 0.78, sound: 'whoosh' }],
  };
}

/** The mummy walks stiff with its arms out, trips on its own bandage, and takes a coffee break on a tombstone. */
export function mummy(): Sketch {
  const durationMs = 7000;
  const keys: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, rotate: 0 },
    { at: 0.36, x: 0.5 },
    { at: 0.38, rotate: 0 },
    { at: 0.44, rotate: 80, y: FLOOR_Y + 0.12, ease: 'in' },
    { at: 0.56, rotate: 80 },
    { at: 0.62, rotate: 0, y: FLOOR_Y, ease: 'out' },
    { at: 0.66, x: 0.5 },
    { at: 0.74, x: 0.38 },
    { at: 0.9, x: 0.38, opacity: 1 },
    { at: 0.98, x: OFF_LEFT, ease: 'in' },
  ];
  const worker = character('mummy-worker', keys, rig(
    // The classic stiff walk: arms straight out, short steps.
    { 'arm-left': [{ at: 0, rotate: 80 }, { at: 0.38, rotate: 80 }, { at: 0.44, rotate: 160 }, { at: 0.62, rotate: 0 }, { at: 0.74, rotate: 0 }, { at: 0.78, rotate: 40 }] },
    { 'arm-right': [{ at: 0, rotate: -80 }, { at: 0.38, rotate: -80 }, { at: 0.44, rotate: -160 }, { at: 0.62, rotate: 0 }] },
    wiggle('leg-left', 0, 0.36, durationMs, 10, 320),
    wiggle('leg-right', 0, 0.36, durationMs, 10, 320, -1),
    { mouth: [{ at: 0.74, scaleY: 1 }, { at: 0.8, scaleY: 2.2, scale: 1.2 }, { at: 0.88, scaleY: 1, scale: 1 }] },
    walk(0.9, 0.98, durationMs, 120, 20)
  ));
  const tombstone = prop('tombstone', [...appearAt(0.64), { at: 0.64, x: 0.24, y: 0.9, scale: 0.05 }, { at: 0.7, y: 0.74, scale: 0.36, ease: 'out' }, { at: 0.92, opacity: 1 }, { at: 0.96, opacity: 0 }]);
  return {
    durationMs,
    actors: [tombstone, worker],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.44, sound: 'crash', screen: 'rumble' }, { at: 0.64, sound: 'thump' }, { at: 0.8, sound: 'yawn' }, { at: 0.9, sound: 'whoosh' }],
  };
}

/** The witch accountant stirs the cauldron, reads the calculator, panics, and throws it in. */
export function witch(): Sketch {
  const durationMs = 7000;
  const accountant = character('witch-accountant', [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.62, ease: 'out' },
    { at: 0.9, x: 0.62 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 16),
    wiggle('arm-left', 0.18, 0.4, durationMs, 35, 200),
    { 'arm-right': [{ at: 0.42, rotate: 0 }, { at: 0.46, rotate: -100 }, { at: 0.6, rotate: -100 }, { at: 0.66, rotate: 40 }, { at: 0.72, rotate: 0 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.5, scale: 1, scaleY: 1 }, { at: 0.53, scale: 1.5, scaleY: 1.5, ease: 'out' as const }, { at: 0.64, scale: 1.5, scaleY: 1.5 }, { at: 0.68, scale: 1, scaleY: 1 }] })),
    { mouth: [{ at: 0.52, scaleY: 1 }, { at: 0.55, scaleY: 2.2 }, { at: 0.64, scaleY: 2.2 }, { at: 0.68, scaleY: 1 }] },
    walk(0.9, 0.99, durationMs, 120, 22)
  ));
  const cauldron = prop('cauldron', [...appearAt(0.12), { at: 0.12, x: 0.32, y: 0.78, scale: 0.05 }, { at: 0.18, scale: 0.42, ease: 'out' }, ...sway('sy', 0.2, 0.66, durationMs, 0.04, 150, 1), { at: 0.7, sy: 1.25 }, { at: 0.76, sy: 1 }, { at: 0.92, opacity: 1 }, { at: 0.96, opacity: 0 }]);
  return {
    durationMs,
    actors: [cauldron, accountant],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.2, sound: 'sizzle' }, { at: 0.54, sound: 'alarm', screen: 'knock' }, { at: 0.68, sound: 'splash', screen: 'rumble' }, { at: 0.78, sound: 'laugh' }],
    particlesAt: [0.68, 0.82],
  };
}

/** The ghost intern drifts in tired, tries a «¡bu!» that fills the screen, gets embarrassed and leaves through the wall. */
export function ghost(): Sketch {
  const durationMs = 6500;
  const keys: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, opacity: 0.9 },
    { at: 0.22, x: 0.5, ease: 'out' },
    ...sway('y', 0.22, 0.4, durationMs, 0.015, 260, FLOOR_Y),
    { at: 0.42, scale: SIZE, y: FLOOR_Y },
    { at: 0.5, scale: SIZE * 1.9, y: 0.55, ease: 'out' },
    { at: 0.58, scale: SIZE * 1.9 },
    { at: 0.64, scale: SIZE * 0.85, y: FLOOR_Y, ease: 'in' },
    { at: 0.82, x: 0.5, opacity: 0.9 },
    { at: 0.98, x: OFF_RIGHT, opacity: 0, ease: 'in' },
  ];
  const intern = character('ghost-intern', keys, rig(
    { 'arm-left': [{ at: 0.42, rotate: 0 }, { at: 0.48, rotate: 130 }, { at: 0.6, rotate: 130 }, { at: 0.64, rotate: 0 }] },
    { 'arm-right': [{ at: 0.42, rotate: 0 }, { at: 0.48, rotate: -130 }, { at: 0.6, rotate: -130 }, { at: 0.64, rotate: 0 }, { at: 0.68, rotate: -40 }, { at: 0.8, rotate: -40 }] },
    { mouth: [{ at: 0.44, scale: 1, scaleY: 1 }, { at: 0.5, scale: 1.6, scaleY: 2.4, ease: 'out' }, { at: 0.6, scale: 1.6, scaleY: 2.4 }, { at: 0.64, scale: 1, scaleY: 0.6 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.02, scaleY: 0.5 }, { at: 0.4, scaleY: 0.5 }, { at: 0.46, scaleY: 1.2 }, { at: 0.62, scaleY: 1.2 }, { at: 0.66, scaleY: 0.4 }] }))
  ));
  const web = prop('spider-web', [...appearAt(0.64), { at: 0.64, x: 0.88, y: 0.12, scale: 0.05 }, { at: 0.7, scale: 0.4, ease: 'out' }, { at: 0.92, opacity: 1 }, { at: 0.98, opacity: 0 }]);
  return {
    durationMs,
    actors: [web, intern],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.5, sound: 'cheer', screen: 'squeeze' }, { at: 0.66, sound: 'boing' }, { at: 0.84, sound: 'whoosh' }],
  };
}
