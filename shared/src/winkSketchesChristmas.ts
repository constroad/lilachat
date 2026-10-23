import type { ActorKey, Sketch } from './winkTimeline.js';
import { appearAt, beats, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, prop, pump, rig, SIZE, sway, walk, wiggle, wink } from './winkSketchKit.js';

/**
 * The Christmas winks (pending 73; Stitch sheet `r152-navidad`): site and
 * office jokes in a Lima December, which is summer. Each one a sketch with a
 * punchline, 6.5–7 s. PURE.
 */

/** The Santa foreman checks his list, orders the gifts down, and the last one lands on his helmet: he sees stars and laughs it off. */
export function santaForeman(): Sketch {
  const durationMs = 7000;
  const santa = character('santa-foreman', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, rotate: 0 },
    { at: 0.18, x: 0.44, ease: 'out' },
    { at: 0.66, rotate: 0 },
    ...sway('rotate', 0.68, 0.8, durationMs, 6, 120, 0),
    { at: 0.88, x: 0.44, rotate: 0 },
    { at: 0.99, x: OFF_RIGHT, ease: 'in' },
  ], rig(
    walk(0, 0.18, durationMs, 260, 14),
    { head: [{ at: 0.2, rotate: 0 }, ...beats(0.2, 0.34, durationMs, 160).map((at, index) => ({ at, rotate: index % 2 === 0 ? 8 : 2 })), { at: 0.36, rotate: 0 }] },
    { 'arm-right': [{ at: 0.36, rotate: 0 }, { at: 0.4, rotate: -140, ease: 'out' }, { at: 0.5, rotate: -140 }, { at: 0.54, rotate: 0 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.66, scaleY: 1 }, { at: 0.68, scaleY: 0.2 }, { at: 0.76, scaleY: 0.2 }, { at: 0.78, scaleY: 1 }] })),
    pump('mouth', 0.78, 0.88, durationMs, 1.8, 110),
    walk(0.88, 0.99, durationMs, 130, 22)
  ));
  const tree = prop('christmas-tree', [...appearAt(0.02), { at: 0.02, x: 0.16, y: 0.62, scale: 0.5 }, { at: 0.9, opacity: 1 }, { at: 0.96, opacity: 0 }]);
  // Two gifts land on the floor; the third one, on his helmet.
  const gifts = ([[0.4, 0.74, 0.46], [0.48, 0.66, 0.52]] as const).map(([start, floorY, land], index) => prop('gift', [...appearAt(start), { at: start, x: 0.74, y: -0.1, scale: 0.22, rotate: index ? 12 : -8 }, { at: land, y: floorY, rotate: 0, ease: 'in' }, { at: 0.9, opacity: 1 }, { at: 0.96, opacity: 0 }]));
  const onHelmet = prop('gift', [...appearAt(0.58), { at: 0.58, x: 0.44, y: -0.1, scale: 0.2, rotate: 20 }, { at: 0.66, y: 0.36, rotate: 0, ease: 'in' }, { at: 0.7, y: 0.34 }, { at: 0.86, y: 0.36 }, { at: 0.88, opacity: 1 }, { at: 0.92, y: 0.6, opacity: 0, ease: 'in' }]);
  const stars = [0, 0.5].map((phase) => prop('star', [...appearAt(0.67), ...beats(0.67, 0.8, durationMs, 90).map((at, index) => ({ at, x: 0.44 + 0.1 * Math.cos((index / 3 + phase) * Math.PI * 2), y: 0.32 + 0.03 * Math.sin((index / 3 + phase) * Math.PI * 2), scale: 0.12 })), { at: 0.8, opacity: 1 }, { at: 0.82, opacity: 0 }]));
  return {
    durationMs,
    actors: [tree, ...gifts, santa, onHelmet, ...stars],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.4, sound: 'whistle' }, { at: 0.46, sound: 'thump' }, { at: 0.52, sound: 'thump' }, { at: 0.66, sound: 'knock', screen: 'knock' }, { at: 0.7, sound: 'ting' }, { at: 0.78, sound: 'laugh' }],
  };
}

/** The elf intern carries a tower of gifts that sways more and more until it falls; he gives up and takes a hot chocolate. */
export function elfIntern(): Sketch {
  const durationMs = 7000;
  const keys: ActorKey[] = [{ at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE }, { at: 0.24, x: 0.52, ease: 'out' }, { at: 0.86, x: 0.52 }, { at: 0.99, x: OFF_LEFT, ease: 'in' }];
  const elf = character('elf-intern', keys, rig(
    walk(0, 0.24, durationMs, 220, 12),
    { 'arm-left': [{ at: 0, rotate: 150 }, { at: 0.46, rotate: 150 }, { at: 0.5, rotate: 60 }, { at: 0.56, rotate: 0 }] },
    { 'arm-right': [{ at: 0, rotate: -150 }, { at: 0.46, rotate: -150 }, { at: 0.5, rotate: -60 }, { at: 0.56, rotate: 0 }, { at: 0.7, rotate: 0 }, { at: 0.74, rotate: -110 }, { at: 0.82, rotate: -110 }, { at: 0.86, rotate: 0 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.48, scale: 1 }, { at: 0.5, scale: 1.5, ease: 'out' as const }, { at: 0.6, scale: 1.5 }, { at: 0.64, scale: 1 }] })),
    { head: [{ at: 0.6, rotate: 0 }, { at: 0.64, rotate: 14 }, { at: 0.7, rotate: 14 }, { at: 0.74, rotate: 0 }] },
    walk(0.86, 0.99, durationMs, 160, 18)
  ));
  // The tower follows him in, sways wider and wider, and each box falls its own way.
  const tower = ([[0.34, 0.62, -0.25], [0.27, 0.66, 1.3], [0.2, 0.6, 0.9]] as const).map(([y, fall, endX], index) => prop('gift', [
    { at: 0, x: OFF_RIGHT, y, scale: 0.2, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.24, x: 0.52, ease: 'out' },
    ...sway('rotate', 0.24, 0.48, durationMs, 6 + index * 6, 180, 0),
    { at: 0.5, x: 0.52 + (index - 1) * 0.04, rotate: 0 },
    { at: fall, x: endX, y: 0.82, rotate: (index - 1) * 160 + 40, ease: 'in' },
    { at: fall + 0.01, opacity: 0 },
  ]));
  const cup = prop('chocolate-cup', [...appearAt(0.72), { at: 0.72, x: 0.66, y: 0.5, scale: 0.05 }, { at: 0.76, scale: 0.16, ease: 'out' }, { at: 0.84, opacity: 1 }, { at: 0.86, opacity: 0 }]);
  return {
    durationMs,
    actors: [elf, ...tower, cup],
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.36, sound: 'squeeze' }, { at: 0.5, sound: 'crash', screen: 'rumble' }, { at: 0.64, sound: 'yawn' }, { at: 0.76, sound: 'drip' }],
  };
}

/** The reindeer trucker drives his sleigh in, honks, brakes hard, almost flies out, and speeds off again. */
export function reindeerDriver(): Sketch {
  const durationMs = 6500;
  const ride: ActorKey[] = [{ at: 0, x: -0.6 }, { at: 0.3, x: 0.46, ease: 'out' }, { at: 0.72, x: 0.46 }, { at: 0.86, x: 1.7, ease: 'in' }];
  // The hard brake: he pitches forward and settles back.
  const brake: ActorKey[] = [{ at: 0.3, rotate: 0 }, { at: 0.34, rotate: 28, ease: 'out' }, { at: 0.42, rotate: -6 }, { at: 0.46, rotate: 0 }];
  const deerKeys: ActorKey[] = [...ride.map((key) => ({ ...key, y: FLOOR_Y - 0.04, scale: SIZE * 0.9 })), ...brake].sort((first, second) => first.at - second.at);
  const deer = character('reindeer-driver', deerKeys, rig(
    { 'arm-right': [{ at: 0.08, rotate: 0 }, ...beats(0.08, 0.26, durationMs, 140).map((at, index) => ({ at, rotate: index % 2 === 0 ? -40 : -20 })), { at: 0.3, rotate: 0 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.32, scale: 1 }, { at: 0.34, scale: 1.6 }, { at: 0.44, scale: 1.6 }, { at: 0.48, scale: 1 }] })),
    wink('eye-left', 0.62),
    pump('mouth', 0.5, 0.6, durationMs, 1.6, 120)
  ));
  // The sleigh goes in front of him: he rides in it.
  const sleigh = prop('sleigh', ride.map((key) => ({ ...key, y: 0.74, scale: 0.62 })));
  return {
    durationMs,
    actors: [deer, sleigh],
    cues: [{ at: 0.02, sound: 'rock' }, { at: 0.12, sound: 'horn' }, { at: 0.2, sound: 'horn' }, { at: 0.3, sound: 'squeeze', screen: 'knock' }, { at: 0.5, sound: 'laugh' }, { at: 0.72, sound: 'whoosh' }],
  };
}

/** The snowman guard whistles at the December sun, sweats, and melts into a puddle with his cap on top. */
export function snowmanGuard(): Sketch {
  const durationMs = 7000;
  const guard = character('snowman-guard', [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.52, sy: 1, sx: 1, y: FLOOR_Y },
    { at: 0.8, sy: 0.22, sx: 1.4, y: 0.76, ease: 'in' },
    { at: 0.84, opacity: 1 },
    { at: 0.88, opacity: 0 },
  ], rig(
    { 'arm-right': [{ at: 0.14, rotate: 0 }, { at: 0.18, rotate: -120, ease: 'out' }, ...beats(0.18, 0.36, durationMs, 150).map((at, index) => ({ at, rotate: index % 2 === 0 ? -130 : -110 })), { at: 0.4, rotate: 0 }] },
    pump('mouth', 0.18, 0.36, durationMs, 1.5, 150),
    wiggle('head', 0.4, 0.52, durationMs, 5, 200),
    wiggle('arm-left', 0.52, 0.78, durationMs, 20, 160)
  ));
  const sun = prop('sun-peek', [...appearAt(0.08), { at: 0.08, x: 0.86, y: -0.1, scale: 0.45 }, { at: 0.16, y: 0.14, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 0.96, opacity: 0, y: -0.1 }]);
  const sweat = ([[0.42, 0.38, 0.4, 0.5], [0.58, 0.36, 0.46, 0.56], [0.47, 0.4, 0.54, 0.64]] as const).map(([x, y, start, end]) => prop('sweat', [...appearAt(start), { at: start, x, y, scale: 0.12 }, { at: end, x: x - 0.02, y: 0.76, ease: 'in' }, { at: end, opacity: 1 }, { at: end + 0.01, opacity: 0 }]));
  const puddle = prop('puddle', [...appearAt(0.66), { at: 0.66, x: 0.5, y: 0.8, scale: 0.2, sy: 0.6 }, { at: 0.82, scale: 0.75, ease: 'out' }, { at: 0.94, opacity: 1 }, { at: 0.99, opacity: 0 }]);
  return {
    durationMs,
    actors: [sun, puddle, guard, ...sweat],
    cues: [{ at: 0.04, sound: 'groove' }, { at: 0.18, sound: 'whistle' }, { at: 0.28, sound: 'whistle' }, { at: 0.42, sound: 'sizzle' }, { at: 0.5, sound: 'drip' }, { at: 0.6, sound: 'drip' }, { at: 0.8, sound: 'splash' }],
  };
}

/** The secret Santa hands over his gift: a panettone pops out, then another, then a third. Forced smile, shrug. */
export function secretSanta(): Sketch {
  const durationMs = 7000;
  const coworker = character('secret-santa', [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.36, ease: 'out' },
    { at: 0.88, x: 0.36 },
    { at: 0.99, x: OFF_LEFT, ease: 'in' },
  ], rig(
    walk(0, 0.16, durationMs, 240, 14),
    { 'arm-right': [{ at: 0.18, rotate: 0 }, { at: 0.24, rotate: -80, ease: 'out' }, { at: 0.34, rotate: -80 }, { at: 0.38, rotate: 0 }, { at: 0.76, rotate: 0 }, { at: 0.8, rotate: -150 }, { at: 0.86, rotate: -150 }, { at: 0.88, rotate: 0 }] },
    { 'arm-left': [{ at: 0.76, rotate: 0 }, { at: 0.8, rotate: 150 }, { at: 0.86, rotate: 150 }, { at: 0.88, rotate: 0 }] },
    { mouth: [{ at: 0.4, scale: 1, scaleY: 1 }, { at: 0.44, scale: 1.3, scaleY: 0.6 }, { at: 0.74, scale: 1.3, scaleY: 0.6 }, { at: 0.78, scale: 1, scaleY: 1 }] },
    walk(0.88, 0.99, durationMs, 140, 20)
  ));
  const gift = prop('gift', [...appearAt(0.2), { at: 0.2, x: 0.5, y: 0.6, scale: 0.05 }, { at: 0.26, x: 0.6, y: 0.56, scale: 0.24, ease: 'out' }, ...sway('rotate', 0.26, 0.36, durationMs, 6, 80, 0), { at: 0.38, scale: 0.3 }, { at: 0.4, scale: 0.05, opacity: 1 }, { at: 0.41, opacity: 0 }]);
  const panettones = ([[0.4, 0.66, 0.52], [0.52, 0.8, 0.5], [0.64, 0.6, 0.38]] as const).map(([at, x, y]) => prop('panettone', [...appearAt(at), { at, x: 0.6, y: 0.56, scale: 0.05, rotate: 0 }, { at: at + 0.05, x, y, scale: 0.26, rotate: 8, ease: 'out' }, { at: at + 0.07, rotate: -4 }, { at: at + 0.09, rotate: 0 }, { at: 0.9, opacity: 1 }, { at: 0.95, opacity: 0 }]));
  return {
    durationMs,
    actors: [coworker, gift, ...panettones],
    // No confetti: the emoji particles over three pops took it to 12.8 % slow frames (R152).
    cues: [{ at: 0.02, sound: 'groove' }, { at: 0.24, sound: 'chime' }, { at: 0.4, sound: 'pop' }, { at: 0.52, sound: 'pop' }, { at: 0.64, sound: 'pop' }, { at: 0.7, sound: 'laugh' }, { at: 0.8, sound: 'boing' }],
  };
}
