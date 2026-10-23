import { DANCES } from './winkDances.js';
import { danceTrack, type ActorKey, type Sketch } from './winkTimeline.js';
import { SEASONAL_SKETCHES } from './winkSketchesSeasonal.js';
import { appearAt, beats, character, FLOOR_Y, OFF_LEFT, OFF_RIGHT, pump, popIn, prop, rig, SIZE, STANDARD_MS, sway, turn, walk, wiggle, wink } from './winkSketchKit.js';
import type { CharacterWinkId, SiteWinkId } from './winks.js';

/**
 * The wink sketches (José, 21/10: they are meant to be funny, not everybody
 * dancing; the hugger must hug; the pig chubby, wiggling and showing its
 * tail). Each one is a short gag with a setup and a punchline,
 * like MSN's: the party pig turns around and wiggles its tail, the water
 * balloon bursts on the glass, the foreman knocks until the screen cracks, the
 * panda really hugs the screen. Only the cone dances. Adult humor: nothing
 * cute or childish (`stitch-design` §5-bis). PURE.
 */
export type SketchWinkId = CharacterWinkId | SiteWinkId;

/** The party pig: winks, turns around, wiggles its round butt and curly tail, turns back and blows a kiss. */
function piggy(): Sketch {
  const durationMs = 7000;
  const place: ActorKey[] = [{ at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE }, { at: 0.15, x: 0.5, ease: 'out' }, { at: 0.84, x: 0.5 }, { at: 1, x: OFF_LEFT, ease: 'in' }];
  const toBack = turn(0.26, 0.05);
  const toFront = turn(0.64, 0.05);
  const butt = [0.34, 0.44, 0.54];
  const front = character('piggy', [...place, ...toBack.leaving, ...toFront.arriving], rig(
    walk(0, 0.15, durationMs),
    { head: [{ at: 0.16, rotate: 0 }, { at: 0.19, rotate: 8 }, { at: 0.25, rotate: 0 }, { at: 0.72, rotate: 0 }, { at: 0.75, rotate: -8 }, { at: 0.82, rotate: 0 }] },
    wink('eye-right', 0.21),
    { mouth: [{ at: 0.17, scale: 1 }, { at: 0.2, scale: 1.2 }, { at: 0.25, scale: 1 }] },
    { 'arm-right': [{ at: 0.68, rotate: 0 }, { at: 0.73, rotate: -45 }, { at: 0.77, rotate: 25, ease: 'out' }, { at: 0.83, rotate: 0 }] },
    wink('eye-left', 0.8),
    walk(0.84, 1, durationMs)
  ));
  // Before the first turn the back view must not show: the arriving keys hide it until the middle of the turn.
  const back = character('piggy-back', [...place, { at: 0, opacity: 0 }, ...toBack.arriving, ...toFront.leaving, ...sway('x', 0.31, 0.62, durationMs, 0.025, 360, 0.5)], rig(
    wiggle('body', 0.31, 0.62, durationMs, 9, 360),
    wiggle('tail', 0.31, 0.62, durationMs, 40, 180),
    { tail: [{ at: 0.31, scale: 1 }, { at: 0.34, scale: 1.8, ease: 'out' }, { at: 0.6, scale: 1.8 }, { at: 0.63, scale: 1 }] },
    wiggle('arm-left', 0.31, 0.62, durationMs, 6, 360, -1),
    wiggle('arm-right', 0.31, 0.62, durationMs, 6, 360),
    { head: [{ at: 0.4, rotate: 0 }, { at: 0.44, rotate: -12 }, { at: 0.56, rotate: -12 }, { at: 0.6, rotate: 0 }] },
    wink('eye-right', 0.5)
  ));
  const kiss = prop('heart', [...appearAt(0.77), { at: 0.77, x: 0.57, y: 0.42, scale: 0.08, rotate: -10 }, { at: 0.87, x: 0.5, y: 0.45, scale: 0.95, rotate: 10, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 0.95, opacity: 0, scale: 1.1 }]);
  return {
    durationMs,
    actors: [front, back, kiss],
    cues: [{ at: 0, sound: 'groove' }, { at: 0.21, sound: 'ting' }, ...butt.map((at) => ({ at, sound: 'boing' as const })), { at: 0.5, sound: 'ting' }, { at: 0.76, sound: 'smooch' }],
    particlesAt: [0.3, 0.7],
  };
}

/** A water balloon flies at the screen, bursts on the glass and the water runs down. */
function balloon(): Sketch {
  const durationMs = 6000;
  const wobble = beats(0, 0.3, durationMs, 120).map((at, index) => ({ at, sx: index % 2 === 0 ? 1.12 : 0.9, sy: index % 2 === 0 ? 0.9 : 1.12 }));
  const flying = prop('balloon', [
    { at: 0, x: 0.12, y: 1.15, scale: 0.18, rotate: -40 },
    { at: 0.12, x: 0.3, y: 0.35, scale: 0.4, rotate: -10 },
    { at: 0.3, x: 0.5, y: 0.45, scale: 1.25, rotate: 15, ease: 'in' },
    ...wobble,
    { at: 0.3, sx: 1, sy: 1 },
    { at: 0.31, sx: 1.5, sy: 0.7 },
    { at: 0.31, opacity: 1 },
    { at: 0.315, opacity: 0 },
  ]);
  const splash = prop('splash', [...appearAt(0.31), { at: 0.31, x: 0.5, y: 0.45, scale: 0.6 }, { at: 0.36, scale: 2.1, ease: 'out' }, { at: 0.55, scale: 2.2, y: 0.5 }, { at: 0.55, opacity: 1 }, { at: 0.72, opacity: 0, y: 0.62, ease: 'in' }]);
  const drips = [
    [0.22, 0.38, 0.4, 0.86],
    [0.38, 0.5, 0.44, 0.94],
    [0.55, 0.42, 0.42, 0.84],
    [0.68, 0.48, 0.46, 0.97],
    [0.82, 0.36, 0.5, 0.9],
  ].map(([x, y, start, end]) => prop('drip', [...appearAt(start!), { at: start!, x, y, scale: 0.26, sy: 1 }, { at: start! + 0.06, sy: 1.25 }, { at: end!, y: 1.2, ease: 'in' }]));
  return {
    durationMs,
    actors: [flying, splash, ...drips],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.31, sound: 'splash', screen: 'crash' }, { at: 0.5, sound: 'drip' }, { at: 0.62, sound: 'drip' }, { at: 0.74, sound: 'drip' }],
    particlesAt: [0.31, 0.6],
  };
}

/** The charmer winks twice for real and throws you his rose. */
function sweetheart(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [{ at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE }, { at: 0.18, x: 0.45, ease: 'out' }, { at: 0.86, x: 0.45 }, { at: 1, x: OFF_RIGHT, ease: 'in' }, ...sway('rotate', 0, 0.18, durationMs, 4, 320, 0), { at: 0.62, rotate: 0 }, { at: 0.66, rotate: 8 }, { at: 0.74, rotate: 0 }];
  const galan = character('sweetheart', keys, rig(
    walk(0, 0.18, durationMs, 320, 14),
    { head: [{ at: 0.19, rotate: 0 }, { at: 0.22, rotate: -6 }, { at: 0.38, rotate: -6 }, { at: 0.41, rotate: 0 }] },
    wink('eye-right', 0.26),
    wink('eye-right', 0.34),
    { mouth: [{ at: 0.24, scale: 1 }, { at: 0.26, scale: 1.15 }, { at: 0.36, scale: 1.15 }, { at: 0.38, scale: 1 }] },
    { 'arm-right': [{ at: 0.4, rotate: 0 }, { at: 0.46, rotate: -50 }, { at: 0.5, rotate: 40, ease: 'out' }, { at: 0.6, rotate: 0 }] },
    { held: [{ at: 0.499, opacity: 1 }, { at: 0.5, opacity: 0 }] },
    wink('eye-left', 0.78),
    walk(0.86, 1, durationMs, 320, 14)
  ));
  const rose = prop('rose', [...appearAt(0.5), { at: 0.5, x: 0.62, y: 0.47, scale: 0.2, rotate: 20 }, { at: 0.62, x: 0.5, y: 0.42, scale: 1.4, rotate: 380, ease: 'out' }, { at: 0.8, y: 0.46, rotate: 370 }, { at: 0.8, opacity: 1 }, { at: 0.9, opacity: 0, y: 0.5 }]);
  return {
    durationMs,
    actors: [galan, rose],
    cues: [{ at: 0.26, sound: 'ting' }, { at: 0.34, sound: 'ting' }, { at: 0.5, sound: 'whoosh' }, { at: 0.62, sound: 'smooch' }],
    particlesAt: [0.55, 0.95],
  };
}

/** The panda walks right up to you and hugs the screen, squeezing it three times. */
function panda(): Sketch {
  const durationMs = STANDARD_MS;
  const squeezes = [0.52, 0.62, 0.72];
  const keys: ActorKey[] = [
    { at: 0, x: 0.5, y: 0.62, scale: 0.5, opacity: 0 },
    { at: 0.04, opacity: 1 },
    { at: 0.08, scale: 0.5 },
    { at: 0.4, scale: 1.75, y: 0.78 },
    ...sway('rotate', 0.08, 0.4, durationMs, 5, 360, 0),
    ...squeezes.flatMap((at) => [{ at, sx: 0.9, sy: 1.06 }, { at: at + 0.05, sx: 1, sy: 1 }]),
    { at: 0.8, scale: 1.75, y: 0.78 },
    { at: 0.92, scale: 0.6, y: 0.62 },
    { at: 0.92, opacity: 1 },
    { at: 1, opacity: 0 },
  ];
  const hug = character('panda', keys, rig(
    walk(0.08, 0.4, durationMs, 360, 12),
    { 'arm-left': [{ at: 0.4, rotate: 0 }, { at: 0.42, rotate: 15 }, { at: 0.5, rotate: -75, ease: 'out' }, { at: 0.8, rotate: -75 }, { at: 0.88, rotate: 0 }] },
    { 'arm-right': [{ at: 0.4, rotate: 0 }, { at: 0.42, rotate: -15 }, { at: 0.5, rotate: 75, ease: 'out' }, { at: 0.8, rotate: 75 }, { at: 0.88, rotate: 0 }] },
    wiggle('head', 0.5, 0.8, durationMs, 8, 500)
  ));
  return {
    durationMs,
    actors: [hug],
    cues: squeezes.map((at) => ({ at, sound: 'squeeze' as const, screen: 'squeeze' as const })),
    particlesAt: [0.48, 0.9],
  };
}

/** The foreman comes up to the glass and knocks three times, until it cracks; then he runs. */
function worker(): Sketch {
  const durationMs = STANDARD_MS;
  const knocks = [0.44, 0.52, 0.6];
  const keys: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: 0.6 },
    { at: 0.16, x: 0.5, ease: 'out' },
    { at: 0.26, scale: 0.6, y: FLOOR_Y },
    { at: 0.36, scale: 1.5, y: 0.7 },
    { at: 0.64, scale: 1.5, y: 0.7 },
    { at: 0.7, scale: 0.6, y: 0.5, ease: 'out' },
    { at: 0.73, y: FLOOR_Y },
    { at: 0.75, x: 0.5 },
    { at: 0.86, x: 1.6, ease: 'in' },
  ];
  const foreman = character('worker', keys, rig(
    walk(0, 0.16, durationMs),
    { head: [{ at: 0.17, rotate: 0 }, { at: 0.19, rotate: 10 }, { at: 0.23, rotate: -10 }, { at: 0.26, rotate: 0 }, { at: 0.64, rotate: 0 }, { at: 0.67, rotate: -14 }, { at: 0.74, rotate: 0 }] },
    { 'arm-left': [{ at: 0.64, rotate: 0 }, { at: 0.67, rotate: 40 }, { at: 0.74, rotate: 0 }] },
    { 'arm-right': [{ at: 0.64, rotate: 0 }, { at: 0.67, rotate: -40 }, { at: 0.74, rotate: 0 }] },
    walk(0.75, 0.86, durationMs, 130, 28)
  ));
  const fist = prop('fist', [...appearAt(0.38), { at: 0.38, x: 0.5, y: 0.5, scale: 0.9 }, ...knocks.flatMap((at) => [{ at: at - 0.03, scale: 0.8 }, { at, scale: 1.35, ease: 'in' as const }, { at: at + 0.04, scale: 0.9 }]), { at: 0.65, opacity: 1 }, { at: 0.66, opacity: 0 }]);
  const cracks = prop('cracks', [...appearAt(0.6), { at: 0.6, x: 0.5, y: 0.5, scale: 2.3 }, { at: 0.88, opacity: 1 }, { at: 0.96, opacity: 0 }]);
  return {
    durationMs,
    actors: [foreman, fist, cracks],
    cues: [{ at: 0.44, sound: 'knock', screen: 'knock' }, { at: 0.52, sound: 'knock', screen: 'knock' }, { at: 0.6, sound: 'glass', screen: 'crash' }, { at: 0.75, sound: 'whoosh' }],
  };
}

/** The fan claps, jumps, and «¡GOL!» explodes on the screen. */
function bear(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [
    ...popIn(0.66),
    { at: 0.42, y: FLOOR_Y, sy: 1 },
    { at: 0.45, sy: 0.9 },
    { at: 0.47, sy: 1.05 },
    { at: 0.46, y: FLOOR_Y },
    { at: 0.5, y: 0.4, ease: 'out' },
    { at: 0.56, y: FLOOR_Y, ease: 'in' },
    { at: 0.57, sy: 0.9 },
    { at: 0.6, sy: 1 },
    ...sway('y', 0.62, 0.88, durationMs, -0.06, 260, FLOOR_Y),
  ];
  const fan = character('bear', keys, rig(
    pump('arm-left', 0.06, 0.4, durationMs, -40, 150),
    pump('arm-right', 0.06, 0.4, durationMs, 40, 150),
    { 'arm-left': [{ at: 0.44, rotate: 0 }, { at: 0.5, rotate: 70 }, { at: 0.9, rotate: 70 }, { at: 0.95, rotate: 0 }] },
    { 'arm-right': [{ at: 0.44, rotate: 0 }, { at: 0.5, rotate: -70 }, { at: 0.9, rotate: -70 }, { at: 0.95, rotate: 0 }] },
    wiggle('head', 0.6, 0.9, durationMs, 10, 260)
  ));
  const goal = prop('goal', [...appearAt(0.48), { at: 0.48, x: 0.5, y: 0.2, scale: 0.2, rotate: -8 }, { at: 0.53, scale: 1.05, rotate: 5, ease: 'out' }, { at: 0.57, scale: 0.92, rotate: -3 }, { at: 0.62, rotate: 0 }, { at: 0.92, opacity: 1 }, { at: 1, opacity: 0 }]);
  return {
    durationMs,
    actors: [fan, goal],
    cues: [{ at: 0.06, sound: 'clap' }, { at: 0.48, sound: 'cheer' }, { at: 0.49, sound: 'horn' }, { at: 0.7, sound: 'horn' }],
    particlesAt: [0.48, 0.9],
  };
}

/** The party cat blows its horn so loud the screen rattles, and the confetti cannon goes off. */
function kitty(): Sketch {
  const durationMs = STANDARD_MS;
  const hops = [0.45, 0.55, 0.65, 0.75];
  const keys: ActorKey[] = [
    { at: 0, x: OFF_RIGHT, y: FLOOR_Y, scale: SIZE },
    { at: 0.16, x: 0.5, ease: 'out' },
    { at: 0.2, rotate: 0 },
    { at: 0.28, rotate: -6 },
    { at: 0.31, rotate: 5, ease: 'out' },
    { at: 0.36, rotate: 0 },
    ...hops.flatMap((at) => [{ at, y: FLOOR_Y }, { at: at + 0.04, y: 0.5, ease: 'out' as const }, { at: at + 0.08, y: FLOOR_Y, ease: 'in' as const }]),
    { at: 0.92, opacity: 1 },
    { at: 1, opacity: 0 },
  ];
  const cat = character('kitty', keys, rig(
    walk(0, 0.16, durationMs),
    { head: [{ at: 0.2, rotate: 0, scale: 1 }, { at: 0.28, rotate: -10 }, { at: 0.31, rotate: 8, scale: 1.4, ease: 'out' }, { at: 0.4, rotate: 0, scale: 1 }, { at: 0.56, rotate: 0, scale: 1 }, { at: 0.6, rotate: 6, scale: 1.4, ease: 'out' }, { at: 0.68, rotate: 0, scale: 1 }] },
    ...(['arm-left', 'arm-right', 'leg-left', 'leg-right', 'tail'] as const).map((part) => ({ [part]: danceTrack(DANCES.jump, part, 0.42, 0.84, durationMs) }))
  ));
  return {
    durationMs,
    actors: [cat],
    cues: [{ at: 0.3, sound: 'partyhorn', screen: 'rumble' }, { at: 0.33, sound: 'pop' }, { at: 0.36, sound: 'groove' }, { at: 0.6, sound: 'partyhorn', screen: 'rumble' }],
    particlesAt: [0.3, 0.75],
  };
}

/** The dog laughs so hard it falls over and rolls on the floor, kicking. */
function puppy(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [
    ...popIn(0.64),
    ...sway('sy', 0.06, 0.3, durationMs, -0.04, 120, 1),
    { at: 0.3, rotate: 0 },
    { at: 0.36, rotate: -10 },
    { at: 0.36, y: FLOOR_Y },
    { at: 0.42, rotate: 80, y: 0.72, ease: 'in' },
    ...sway('rotate', 0.42, 0.82, durationMs, 8, 300, 80),
    ...sway('x', 0.42, 0.82, durationMs, 0.02, 300, 0.5),
    { at: 0.84, y: 0.72 },
    { at: 0.9, rotate: 0, y: FLOOR_Y },
  ];
  const dog = character('puppy', keys, rig(
    wiggle('head', 0.05, 0.36, durationMs, 6, 240),
    wiggle('arm-right', 0.05, 0.36, durationMs, 10, 240),
    wiggle('leg-left', 0.42, 0.84, durationMs, 35, 160),
    wiggle('leg-right', 0.42, 0.84, durationMs, 35, 160, -1),
    wiggle('arm-left', 0.42, 0.84, durationMs, 25, 200),
    wiggle('tail', 0.42, 0.84, durationMs, 30, 120),
    { 'arm-left': [{ at: 0.86, rotate: 0 }, { at: 0.89, rotate: -40 }, { at: 0.95, rotate: 0 }] }
  ));
  return {
    durationMs,
    actors: [dog],
    cues: [{ at: 0.05, sound: 'laugh' }, { at: 0.42, sound: 'thump', screen: 'knock' }, { at: 0.45, sound: 'laugh' }, { at: 0.66, sound: 'laugh' }],
    particlesAt: [0.4, 0.85],
  };
}

/** Monday coffee yawns and dozes off; the alarm rings and it runs off in a panic. */
function cuppa(): Sketch {
  const durationMs = 7000;
  const keys: ActorKey[] = [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.03, opacity: 1 },
    { at: 0.3, rotate: 0, sy: 1 },
    { at: 0.4, rotate: 6, sy: 0.95 },
    { at: 0.53, rotate: 6, sy: 0.95 },
    { at: 0.56, rotate: 0, sy: 1 },
    { at: 0.54, y: FLOOR_Y },
    { at: 0.58, y: 0.45, ease: 'out' },
    { at: 0.64, y: FLOOR_Y, ease: 'in' },
    { at: 0.72, x: 0.5, rotate: 0 },
    { at: 0.75, rotate: 8 },
    { at: 0.88, x: 1.6, ease: 'in' },
  ];
  const cup = character('cuppa', keys, rig(
    { 'arm-left': [{ at: 0.04, rotate: 0 }, { at: 0.12, rotate: 55 }, { at: 0.22, rotate: 0 }, { at: 0.54, rotate: 0 }, { at: 0.56, rotate: 70 }, { at: 0.7, rotate: 70 }, { at: 0.72, rotate: 0 }] },
    { 'arm-right': [{ at: 0.04, rotate: 0 }, { at: 0.12, rotate: -55 }, { at: 0.22, rotate: 0 }, { at: 0.54, rotate: 0 }, { at: 0.56, rotate: -70 }, { at: 0.7, rotate: -70 }, { at: 0.72, rotate: 0 }] },
    { mouth: [{ at: 0.04, scale: 1, scaleY: 1 }, { at: 0.12, scale: 1.3, scaleY: 2.4 }, { at: 0.2, scale: 1, scaleY: 1 }, { at: 0.54, scaleY: 1 }, { at: 0.56, scaleY: 1.8, scale: 1.2 }, { at: 0.66, scaleY: 1, scale: 1 }] },
    ...(['eye-left', 'eye-right'] as const).map((eye) => ({ [eye]: [{ at: 0.04, scaleY: 1, scale: 1 }, { at: 0.12, scaleY: 0.3 }, { at: 0.2, scaleY: 0.6 }, { at: 0.3, scaleY: 0.08 }, { at: 0.54, scaleY: 0.08 }, { at: 0.55, scaleY: 1.35, scale: 1.25, ease: 'out' as const }, { at: 0.7, scaleY: 1.35, scale: 1.25 }, { at: 0.74, scaleY: 1, scale: 1 }] })),
    { head: [{ at: 0.04, rotate: 0 }, { at: 0.12, rotate: -4 }, { at: 0.22, rotate: 0 }, { at: 0.32, rotate: 10 }, { at: 0.38, rotate: 4 }, { at: 0.44, rotate: 10 }, { at: 0.5, rotate: 4 }, { at: 0.55, rotate: 0 }] },
    walk(0.72, 0.88, durationMs, 130, 30)
  ));
  const zzz = prop('zzz', [{ at: 0, opacity: 0 }, { at: 0.28, x: 0.66, y: 0.3, scale: 0.15, opacity: 0 }, { at: 0.32, opacity: 1, scale: 0.35 }, { at: 0.52, x: 0.72, y: 0.2, scale: 0.45 }, { at: 0.52, opacity: 1 }, { at: 0.53, opacity: 0 }]);
  const alarm = prop('alarm', [...appearAt(0.52), { at: 0.52, x: 0.22, y: 0.38, scale: 0.05 }, { at: 0.54, scale: 0.42, ease: 'out' }, ...sway('rotate', 0.54, 0.72, durationMs, 14, 70, 0), { at: 0.74, opacity: 1 }, { at: 0.77, opacity: 0 }]);
  return {
    durationMs,
    actors: [cup, zzz, alarm],
    cues: [{ at: 0.05, sound: 'yawn' }, { at: 0.31, sound: 'snore' }, { at: 0.42, sound: 'snore' }, { at: 0.52, sound: 'alarm', screen: 'rumble' }, { at: 0.72, sound: 'whoosh' }],
  };
}

/** The bodybuilder brick hits three poses, swells huge on the last one, then kisses its biceps. */
function brick(): Sketch {
  const durationMs = STANDARD_MS;
  const pumped = 0.76;
  const keys: ActorKey[] = [
    ...popIn(),
    { at: 0.12, scale: SIZE },
    { at: 0.15, scale: pumped, ease: 'out' },
    { at: 0.3, scale: pumped, sx: 1 },
    { at: 0.33, scale: SIZE },
    { at: 0.36, sx: -1 },
    { at: 0.39, scale: pumped, ease: 'out' },
    { at: 0.52, scale: pumped, sx: -1 },
    { at: 0.56, scale: SIZE, sx: 1, y: FLOOR_Y, sy: 1 },
    { at: 0.6, scale: 1.12, sy: 0.94, y: 0.66, ease: 'out' },
    ...sway('rotate', 0.61, 0.74, durationMs, 2.5, 60, 0),
    { at: 0.74, scale: 1.12, sy: 0.94, y: 0.66 },
    { at: 0.8, scale: SIZE, sy: 1, y: FLOOR_Y },
  ];
  const brickman = character('brick', keys, rig(
    { 'arm-left': [{ at: 0.05, rotate: -80 }, { at: 0.12, rotate: -80 }, { at: 0.14, rotate: 0, ease: 'out' }, { at: 0.34, rotate: 0 }, { at: 0.39, rotate: -90, ease: 'out' }, { at: 0.52, rotate: -90 }, { at: 0.56, rotate: 0 }, { at: 0.6, rotate: -35, ease: 'out' }, { at: 0.74, rotate: -35 }, { at: 0.78, rotate: 0 }] },
    { 'arm-right': [{ at: 0.05, rotate: 80 }, { at: 0.12, rotate: 80 }, { at: 0.14, rotate: 0, ease: 'out' }, { at: 0.56, rotate: 0 }, { at: 0.6, rotate: 35, ease: 'out' }, { at: 0.74, rotate: 35 }, { at: 0.78, rotate: 0 }] },
    { head: [{ at: 0.78, rotate: 0 }, { at: 0.81, rotate: 15 }, { at: 0.87, rotate: 0 }] }
  ));
  return {
    durationMs,
    actors: [brickman],
    cues: [{ at: 0.14, sound: 'thump' }, { at: 0.15, sound: 'ting' }, { at: 0.39, sound: 'thump' }, { at: 0.4, sound: 'ting' }, { at: 0.6, sound: 'rumble', screen: 'rumble' }, { at: 0.61, sound: 'ting' }, { at: 0.81, sound: 'smooch' }],
    particlesAt: [0.14, 0.8],
  };
}

/** The cumbia cone: the only one that dances, side steps and a double spin. */
function cone(): Sketch {
  const durationMs = STANDARD_MS;
  const parts = ['body', 'head', 'arm-left', 'arm-right', 'leg-left', 'leg-right'] as const;
  const keys: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE },
    { at: 0.12, x: 0.4, ease: 'out' },
    { at: 0.3, x: 0.6 },
    { at: 0.5, x: 0.4 },
    { at: 0.7, x: 0.5 },
    ...sway('y', 0.12, 0.7, durationMs, -0.015, 200, FLOOR_Y),
    { at: 0.72, sx: 1 },
    { at: 0.76, sx: -1 },
    { at: 0.8, sx: 1 },
    { at: 0.84, sx: -1 },
    { at: 0.88, sx: 1 },
    { at: 0.93, opacity: 1 },
    { at: 1, opacity: 0 },
  ];
  return {
    durationMs,
    actors: [character('cone', keys, rig(...parts.map((part) => ({ [part]: danceTrack(DANCES.cumbia, part, 0, 0.88, durationMs) }))))],
    cues: [{ at: 0, sound: 'groove' }],
    particlesAt: [0.1, 0.9],
  };
}

/** The roller crosses the screen and leaves a fresh asphalt stripe, steaming. */
function roller(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [{ at: 0.05, x: -0.5, y: 0.62, scale: 0.6 }, { at: 0.8, x: 1.5, ease: 'linear' }, ...sway('y', 0.05, 0.8, durationMs, -0.006, 200, 0.62)];
  const asphalt = prop('asphalt', [{ at: 0.05, x: -1.05, y: 0.8, scale: 1, sy: 0.45 }, { at: 0.63, x: 0.5, ease: 'linear' }, { at: 0.9, opacity: 1 }, { at: 1, opacity: 0 }], { fit: 'width' });
  const machine = character('roller', keys, rig(wiggle('arm-left', 0.05, 0.8, durationMs, 20, 300), wiggle('leg-left', 0.05, 0.8, durationMs, 6, 150), wiggle('leg-right', 0.05, 0.8, durationMs, 6, 150, -1)));
  return {
    durationMs,
    actors: [asphalt, machine],
    cues: [{ at: 0.05, sound: 'rumble', screen: 'rumble' }, { at: 0.65, sound: 'sizzle' }],
    particlesAt: [0.6, 0.95],
  };
}

/** The show-off dump truck honks, tips back and dumps a pile of sand at the bottom of the screen. */
function dumptruck(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [
    { at: 0, x: OFF_RIGHT, y: 0.58, scale: SIZE },
    { at: 0.2, x: 0.62, ease: 'out' },
    ...sway('y', 0, 0.2, durationMs, -0.006, 150, 0.58),
    { at: 0.32, rotate: 0 },
    { at: 0.38, rotate: -14 },
    { at: 0.6, rotate: -14 },
    { at: 0.64, rotate: 0 },
    { at: 0.8, x: 0.62 },
    { at: 0.95, x: 1.6, ease: 'in' },
  ];
  const truck = character('dumptruck', keys, rig(
    wiggle('leg-left', 0, 0.2, durationMs, 8, 120),
    wiggle('leg-right', 0, 0.2, durationMs, 8, 120, -1),
    pump('arm-left', 0.22, 0.3, durationMs, 20, 120),
    pump('arm-right', 0.22, 0.3, durationMs, -20, 120),
    pump('arm-left', 0.66, 0.78, durationMs, 25, 150),
    pump('arm-right', 0.66, 0.78, durationMs, -25, 150),
    wiggle('leg-left', 0.8, 0.95, durationMs, 8, 120),
    wiggle('leg-right', 0.8, 0.95, durationMs, 8, 120, -1)
  ));
  const sand = prop('sand', [...appearAt(0.36), { at: 0.36, x: 0.42, y: 0.9, scale: 1.3, sy: 0.05 }, { at: 0.56, sy: 1, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 1, opacity: 0 }]);
  return {
    durationMs,
    actors: [sand, truck],
    cues: [{ at: 0.22, sound: 'horn' }, { at: 0.27, sound: 'horn' }, { at: 0.36, sound: 'rumble', screen: 'rumble' }, { at: 0.7, sound: 'horn' }],
    particlesAt: [0.38, 0.62],
  };
}

/** The rocker excavator headbangs and smashes its guitar on the floor. */
function excavator(): Sketch {
  const durationMs = STANDARD_MS;
  const bob = sway('y', 0.04, 0.46, durationMs, 0.008, 240, FLOOR_Y);
  const keys: ActorKey[] = [{ at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 }, { at: 0.03, opacity: 1 }, ...bob, { at: 0.46, rotate: 0 }, { at: 0.52, rotate: -6 }, { at: 0.56, rotate: 8, ease: 'in' }, { at: 0.64, rotate: 0 }, { at: 0.92, opacity: 1 }, { at: 1, opacity: 0 }];
  const rocker = character('excavator', keys, rig(
    pump('head', 0.04, 0.46, durationMs, 22, 120),
    pump('arm-left', 0.04, 0.46, durationMs, 20, 240),
    { 'arm-right': [{ at: 0.46, rotate: 0 }, { at: 0.52, rotate: -20 }, { at: 0.56, rotate: 10 }, { at: 0.62, rotate: 0 }] },
    { 'arm-left': [{ at: 0.6, rotate: 0 }, { at: 0.64, rotate: 30 }, { at: 0.9, rotate: 30 }, { at: 0.94, rotate: 0 }] },
    pump('head', 0.62, 0.9, durationMs, 15, 240)
  ));
  const guitar = prop('guitar', [{ at: 0, opacity: 0 }, { at: 0.03, opacity: 1 }, { at: 0.04, x: 0.53, y: 0.72, scale: 0.42, rotate: -30 }, ...bob.map((key) => ({ ...key, y: (key.y ?? FLOOR_Y) + 0.12 })), ...sway('rotate', 0.04, 0.46, durationMs, 4, 120, -30), { at: 0.52, x: 0.56, y: 0.3, rotate: -160, scale: 0.5, ease: 'out' }, { at: 0.56, x: 0.5, y: 0.86, rotate: 20, ease: 'in' }, { at: 0.56, opacity: 1 }, { at: 0.565, opacity: 0 }]);
  const pieces = [
    [0.18, 0.55, -200, 0.05, -400, 1],
    [0.82, 0.5, 220, 0.95, 420, -1],
  ].map(([x, y, spin, endX, endSpin, mirror]) => prop('guitar-piece', [...appearAt(0.565), { at: 0.565, x: 0.5, y: 0.86, scale: 0.35, rotate: 0, sx: mirror }, { at: 0.66, x, y, rotate: spin, ease: 'out' }, { at: 0.85, x: endX, y: 1.2, rotate: endSpin, ease: 'in' }]));
  return {
    durationMs,
    actors: [rocker, guitar, ...pieces],
    cues: [{ at: 0, sound: 'rock' }, { at: 0.56, sound: 'crash', screen: 'crash' }],
    particlesAt: [0.56, 0.85],
  };
}

/** The paver in the heat: sweats, steams and melts into a puddle, then pops back up. */
function paver(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [
    { at: 0, x: 0.5, y: FLOOR_Y, scale: SIZE, opacity: 0 },
    { at: 0.03, opacity: 1 },
    ...sway('sy', 0.05, 0.4, durationMs, -0.03, 500, 1),
    { at: 0.5, sy: 1, sx: 1, y: FLOOR_Y },
    { at: 0.74, sy: 0.3, sx: 1.45, y: 0.74, ease: 'in' },
    { at: 0.82, sy: 0.3, sx: 1.45, y: 0.74 },
    { at: 0.86, sy: 1.15, sx: 0.95, y: FLOOR_Y, ease: 'out' },
    { at: 0.9, sy: 1, sx: 1 },
    { at: 0.92, opacity: 1 },
    { at: 1, opacity: 0 },
  ];
  const worker = character('paver', keys, rig(
    wiggle('head', 0.05, 0.4, durationMs, 4, 500),
    wiggle('arm-left', 0.05, 0.4, durationMs, 12, 300),
    { 'arm-left': [{ at: 0.5, rotate: 0 }, { at: 0.7, rotate: -40 }, { at: 0.84, rotate: -40 }, { at: 0.88, rotate: 0 }] },
    { 'arm-right': [{ at: 0.5, rotate: 0 }, { at: 0.7, rotate: 30 }, { at: 0.84, rotate: 30 }, { at: 0.88, rotate: 0 }] },
    wiggle('head', 0.86, 0.92, durationMs, 12, 80)
  ));
  const asphalt = prop('asphalt', [{ at: 0, x: 0.5, y: 0.8, scale: 1, sy: 0.45, opacity: 0 }, { at: 0.05, opacity: 1 }, { at: 0.92, opacity: 1 }, { at: 1, opacity: 0 }], { fit: 'width' });
  const sweat = [
    [0.44, 0.3, 0.12, 0.3],
    [0.58, 0.28, 0.2, 0.38],
    [0.47, 0.29, 0.3, 0.46],
  ].map(([x, y, start, end]) => prop('sweat', [...appearAt(start!), { at: start!, x, y, scale: 0.16 }, { at: end!, x: x! - 0.03, y: 0.75, ease: 'in' }, { at: end!, opacity: 1 }, { at: end! + 0.01, opacity: 0 }]));
  return {
    durationMs,
    actors: [asphalt, worker, ...sweat],
    cues: [{ at: 0.05, sound: 'sizzle' }, { at: 0.3, sound: 'drip' }, { at: 0.38, sound: 'drip' }, { at: 0.46, sound: 'drip' }, { at: 0.5, sound: 'sizzle' }],
    particlesAt: [0.5, 0.85],
  };
}

/** The strict flagger blows the whistle and the STOP paddle fills the whole screen. */
function flagger(): Sketch {
  const durationMs = STANDARD_MS;
  const keys: ActorKey[] = [{ at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE }, { at: 0.16, x: 0.5, ease: 'out' }, { at: 0.86, x: 0.5 }, { at: 1, x: OFF_RIGHT, ease: 'in' }];
  const man = character('flagger', keys, rig(
    walk(0, 0.16, durationMs, 240, 20),
    { head: [{ at: 0.18, rotate: 0 }, { at: 0.2, rotate: -6 }, { at: 0.3, rotate: -6 }, { at: 0.32, rotate: 0 }] },
    { 'arm-right': [{ at: 0.2, rotate: 0 }, { at: 0.22, rotate: -15, ease: 'out' }, { at: 0.26, rotate: 0 }, { at: 0.28, rotate: -15, ease: 'out' }, { at: 0.32, rotate: 0 }] },
    pump('head', 0.8, 0.86, durationMs, 8, 90),
    walk(0.86, 1, durationMs, 240, 20)
  ));
  const stop = prop('stop', [...appearAt(0.34), { at: 0.34, x: 0.3, y: 0.32, scale: 0.15 }, { at: 0.42, x: 0.5, y: 0.5, scale: 2.4, ease: 'out' }, ...sway('rotate', 0.42, 0.78, durationMs, 2, 600, 0), { at: 0.78, x: 0.5, y: 0.5, scale: 2.4 }, { at: 0.86, x: 0.3, y: 0.32, scale: 0.15, ease: 'in' }, { at: 0.86, opacity: 1 }, { at: 0.87, opacity: 0 }]);
  return {
    durationMs,
    actors: [man, stop],
    cues: [{ at: 0.2, sound: 'whistle' }, { at: 0.28, sound: 'whistle' }, { at: 0.42, sound: 'thump', screen: 'knock' }, { at: 0.55, sound: 'whistle' }],
  };
}

/**
 * The dog under the rain (pending 60, José 22/10): a little cloud rains only on
 * him; he sobs, runs and the cloud catches up; his umbrella flips in the wind;
 * he cries a puddle and, as he walks away from behind, the sun peeks out to
 * mock him. Telenovela drama, adult humor.
 */
function rainy(): Sketch {
  const durationMs = 7000;
  const dogX: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: FLOOR_Y, scale: SIZE, rotate: 4 },
    { at: 0.2, x: 0.42, ease: 'out' },
    { at: 0.4, x: 0.42 },
    { at: 0.47, x: 0.7, ease: 'out' },
    { at: 0.82, x: 0.7 },
  ];
  const sob = sway('y', 0.22, 0.4, durationMs, -0.012, 160, FLOOR_Y);
  const front = character('dog-sad', [...dogX, ...sob, { at: 0.82, opacity: 1 }, { at: 0.84, opacity: 0 }], rig(
    walk(0, 0.2, durationMs, 260, 14),
    walk(0.4, 0.47, durationMs, 90, 30),
    { head: [{ at: 0.2, rotate: 0 }, ...beats(0.22, 0.4, durationMs, 160).map((at, index) => ({ at, rotate: index % 2 === 0 ? -6 : 3 })), { at: 0.4, rotate: 0 }, { at: 0.62, rotate: 0 }, { at: 0.66, rotate: -10 }, { at: 0.8, rotate: -10 }] },
    { mouth: [{ at: 0.22, scaleY: 1 }, ...beats(0.22, 0.4, durationMs, 160).map((at, index) => ({ at, scaleY: index % 2 === 0 ? 1.5 : 0.9 })), { at: 0.66, scaleY: 1.7, scale: 1.2 }, { at: 0.8, scaleY: 1.7 }] },
    { 'arm-right': [{ at: 0.5, rotate: 0 }, { at: 0.54, rotate: -120 }, { at: 0.64, rotate: -120 }, { at: 0.68, rotate: 0 }] },
    { 'arm-left': [{ at: 0.64, rotate: 0 }, { at: 0.68, rotate: 60 }, { at: 0.8, rotate: 60 }] }
  ));
  const flip = turn(0.82, 0.04);
  const back = character('dog-sad-back', [{ at: 0, x: 0.7, y: FLOOR_Y, scale: SIZE, opacity: 0 }, ...flip.arriving, { at: 0.86, x: 0.7 }, { at: 0.98, x: OFF_RIGHT, ease: 'in' }], walk(0.86, 0.98, durationMs, 130, 24));
  // The cloud follows him a beat late, and it rains only under it.
  const cloudKeys: ActorKey[] = [
    { at: 0, x: OFF_LEFT, y: 0.22, scale: 0.42, opacity: 1 },
    { at: 0.24, x: 0.44, ease: 'out' },
    ...sway('y', 0.24, 0.42, durationMs, 0.01, 300, 0.22),
    { at: 0.44, x: 0.44 },
    { at: 0.52, x: 0.7, ease: 'smooth' },
    { at: 0.84, x: 0.7, scale: 0.42, opacity: 1 },
    { at: 0.9, scale: 0.7, opacity: 0, ease: 'out' },
  ];
  const cloud = prop('rain-cloud', cloudKeys);
  const rain = prop('rain-drops', [
    { at: 0, x: OFF_LEFT, y: 0.4, scale: 0.36, opacity: 0.9 },
    { at: 0.24, x: 0.44, ease: 'out' },
    ...beats(0, 0.84, durationMs, 120).map((at, index) => ({ at, y: index % 2 === 0 ? 0.42 : 0.4 })),
    { at: 0.44, x: 0.44 },
    { at: 0.52, x: 0.7 },
    { at: 0.84, opacity: 0.9 },
    { at: 0.87, opacity: 0 },
  ]);
  const umbrella = prop('umbrella-broken', [
    ...appearAt(0.54),
    { at: 0.54, x: 0.72, y: 0.36, scale: 0.08, rotate: 180 },
    { at: 0.57, scale: 0.4, ease: 'out' },
    { at: 0.6, rotate: 180 },
    // The wind turns it inside out.
    { at: 0.62, rotate: 0, sy: 1.2 },
    ...sway('rotate', 0.62, 0.68, durationMs, 12, 70, 0),
    { at: 0.68, x: 0.72, y: 0.36 },
    { at: 0.76, x: 1.4, y: 0.1, rotate: 200, ease: 'in' },
  ]);
  const puddle = prop('puddle', [...appearAt(0.66), { at: 0.66, x: 0.7, y: 0.86, scale: 0.1 }, { at: 0.82, scale: 0.75, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 1, opacity: 0 }]);
  const sun = prop('sun-peek', [...appearAt(0.86), { at: 0.86, x: 0.86, y: -0.1, scale: 0.3 }, { at: 0.9, y: 0.16, ease: 'out' }, ...sway('rotate', 0.9, 0.97, durationMs, 10, 120, 0), { at: 0.97, opacity: 1 }, { at: 1, opacity: 0 }]);
  return {
    durationMs,
    actors: [puddle, cloud, rain, front, back, umbrella, sun],
    cues: [{ at: 0.02, sound: 'drip' }, { at: 0.12, sound: 'drip' }, { at: 0.24, sound: 'drip' }, { at: 0.34, sound: 'drip' }, { at: 0.41, sound: 'whoosh' }, { at: 0.55, sound: 'whoosh' }, { at: 0.62, sound: 'boing', screen: 'knock' }, { at: 0.7, sound: 'splash' }, { at: 0.88, sound: 'laugh' }],
    particlesAt: [0.02, 0.82],
  };
}

export const WINK_SKETCHES: Record<SketchWinkId, Sketch> = {
  rainy: rainy(),
  ...SEASONAL_SKETCHES,
  piggy: piggy(),
  balloon: balloon(),
  sweetheart: sweetheart(),
  panda: panda(),
  worker: worker(),
  bear: bear(),
  kitty: kitty(),
  puppy: puppy(),
  cuppa: cuppa(),
  brick: brick(),
  cone: cone(),
  roller: roller(),
  dumptruck: dumptruck(),
  excavator: excavator(),
  paver: paver(),
  flagger: flagger(),
};
