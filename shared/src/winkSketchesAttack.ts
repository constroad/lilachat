import type { WinkPropId } from './winkArt.js';
import { appearAt, burst, popAt, prop, STANDARD_MS, sway } from './winkSketchKit.js';
import type { ActorKey, Sketch } from './winkTimeline.js';

/**
 * «Te ataco» (José, 02/11: «debe enganchar a los usuarios»): each wink hits
 * the screen of whoever gets it, a prank between workmates that begs to be
 * sent back. Entrance, impact on the glass, punchline: the second slipper,
 * the egg that fries, the fly that laughs. Storyboards `r02nov-ataque-a…d`.
 * PURE.
 */
export type AttackWinkId = 'hit-slipper' | 'hit-pie' | 'hit-bucket' | 'hit-tomato' | 'hit-egg' | 'hit-pillow' | 'hit-ball' | 'hit-foam' | 'hit-flour' | 'hit-swatter' | 'hit-knock' | 'hit-kiss';

type Spot = { x: number; y: number; scale: number };
/** Below the screen: whatever falls there is gone. */
const FALLEN_Y = 1.3;
/** How long a thing takes to vanish when it bursts or leaves (share of the wink). */
const BLINK = 0.005;

/** Thrown at the glass: small and far away (or from an edge) until it hits, spinning, speeding up. */
function thrown(from: { at: number; x: number; y: number }, hit: { at: number } & Spot, spin: number): ActorKey[] {
  const small = hit.scale * 0.1;
  return [
    { at: 0, x: from.x, y: from.y, scale: small, rotate: 0, opacity: 0 },
    { at: from.at, x: from.x, y: from.y, scale: small, rotate: 0, opacity: 0 },
    { at: from.at + 0.02, opacity: 1 },
    { at: hit.at, x: hit.x, y: hit.y, scale: hit.scale, rotate: spin, ease: 'in' },
  ];
}

/** Squashed against the glass for a moment, the way a soft thing lands. */
const squash = (at: number, sx: number, sy: number): ActorKey[] => [{ at: at - 0.01, sx: 1, sy: 1 }, { at: at + 0.01, sx, sy }, { at: at + 0.04, sx: 1, sy: 1 }];

/** Gone at once (it burst, it fell off the bottom). */
const vanishAt = (at: number): ActorKey[] => [{ at, opacity: 1 }, { at: at + BLINK, opacity: 0 }];

/** A mark left on the glass at `at`: it spreads, stays until `until` and fades. */
function stain(at: number, spot: Spot, until: number, extra: ActorKey[] = []): ActorKey[] {
  return [...appearAt(at), { at, x: spot.x, y: spot.y, scale: spot.scale * 0.6 }, { at: at + 0.03, scale: spot.scale, ease: 'out' }, ...extra, { at: until, opacity: 1 }, { at: Math.min(until + 0.06, 1), opacity: 0 }];
}

/** Hidden until `from`, fades in until `shown`, stays until `until` and fades by the end. */
function fadeIn(from: number, shown: number, until: number, spot: Spot, peak = 1): ActorKey[] {
  return [{ at: 0, opacity: 0, x: spot.x, y: spot.y, scale: spot.scale }, { at: from, opacity: 0 }, { at: shown, opacity: peak }, { at: until, opacity: peak }, { at: Math.min(until + 0.05, 1), opacity: 0 }];
}

/** The chancla: it spins in, slaps the glass and leaves its red sole… and the second one comes. */
function slipperHit(): Sketch {
  const first: Spot = { x: 0.5, y: 0.45, scale: 0.8 };
  const second: Spot = { x: 0.56, y: 0.4, scale: 0.75 };
  const slipper = prop('slipper', [
    ...thrown({ at: 0.03, x: 0.25, y: 0.85 }, { at: 0.26, ...first }, 1080),
    ...squash(0.27, 1.12, 0.88),
    { at: 0.46, y: first.y, rotate: 1080 },
    { at: 0.62, y: FALLEN_Y + 0.05, rotate: 1110, ease: 'in' },
    ...vanishAt(0.62),
  ]);
  const again = prop('slipper', [...thrown({ at: 0.62, x: 0.85, y: 0.9 }, { at: 0.8, ...second }, -900), ...squash(0.81, 1.12, 0.88), { at: 0.9, y: second.y, rotate: -900 }, { at: 1, y: FALLEN_Y, rotate: -930, ease: 'in' }]);
  const mark = prop('slipper-mark', stain(0.26, first, 0.9));
  const markAgain = prop('slipper-mark', stain(0.8, second, 0.94, [{ at: 0.8, rotate: -20 }]));
  return {
    durationMs: STANDARD_MS,
    actors: [mark, markAgain, slipper, again],
    cues: [{ at: 0.03, sound: 'whoosh' }, { at: 0.26, sound: 'thump', screen: 'crash' }, { at: 0.5, sound: 'whoosh' }, { at: 0.64, sound: 'whoosh' }, { at: 0.8, sound: 'thump', screen: 'knock' }, { at: 0.88, sound: 'laugh' }],
  };
}

/** The cream pie: it flies at you, splats, the cream runs down and a cherry lands on top. */
function pieHit(): Sketch {
  const pie = prop('cream-pie', [...thrown({ at: 0.04, x: 0.5, y: 0.95 }, { at: 0.3, x: 0.5, y: 0.45, scale: 0.95 }, 8), ...squash(0.31, 1.4, 0.6), ...vanishAt(0.31)]);
  const splat = prop('cream-splat', [...appearAt(0.31), { at: 0.31, x: 0.5, y: 0.45, scale: 0.5, sy: 1 }, { at: 0.35, scale: 1.9, ease: 'out' }, { at: 0.4, sy: 1 }, { at: 0.88, y: 0.56, sy: 1.15 }, { at: 0.88, opacity: 1 }, { at: 0.95, opacity: 0 }]);
  const cherry = prop('cherry', [
    ...appearAt(0.7),
    { at: 0.7, x: 0.56, y: -0.1, scale: 0.22 },
    { at: 0.78, y: 0.4, ease: 'in' },
    { at: 0.82, y: 0.33, ease: 'out' },
    { at: 0.86, y: 0.4, ease: 'in' },
    { at: 0.88, y: 0.37, ease: 'out' },
    { at: 0.9, y: 0.4, ease: 'in' },
    { at: 0.9, opacity: 1 },
    { at: 0.96, opacity: 0 },
  ]);
  return {
    durationMs: STANDARD_MS,
    actors: [pie, splat, cherry],
    cues: [{ at: 0.04, sound: 'whoosh' }, { at: 0.31, sound: 'splash', screen: 'crash' }, { at: 0.5, sound: 'drip' }, { at: 0.64, sound: 'drip' }, { at: 0.78, sound: 'boing' }, { at: 0.86, sound: 'boing' }, { at: 0.9, sound: 'laugh' }],
  };
}

/** The bucket: it tips over the top of the screen, the water floods it, and the empty bucket falls with a clonk. */
function bucketHit(): Sketch {
  const bucket = prop('bucket', [
    { at: 0, x: 0.5, y: -0.2, scale: 0.5, rotate: 0, opacity: 0 },
    { at: 0.03, opacity: 1 },
    { at: 0.14, y: 0.13, ease: 'out' },
    { at: 0.2, rotate: 0 },
    { at: 0.3, rotate: 150, ease: 'out' },
    { at: 0.56, y: 0.13, rotate: 150 },
    { at: 0.7, y: 0.86, rotate: 200, ease: 'in' },
    { at: 0.75, y: 0.74, rotate: 185, ease: 'out' },
    { at: 0.8, y: 0.86, rotate: 195, ease: 'in' },
    { at: 0.92, y: 0.86, opacity: 1 },
    { at: 0.98, opacity: 0 },
  ]);
  const wave = prop('water-wave', [...appearAt(0.28), { at: 0.28, x: 0.5, y: 0.2, scale: 0.5, sy: 0.4 }, { at: 0.36, y: 0.5, scale: 1.5, sy: 1.4, ease: 'out' }, { at: 0.5, y: 0.55, opacity: 1 }, { at: 0.62, opacity: 0, y: 0.75, ease: 'in' }]);
  const drops = prop('glass-drops', [...appearAt(0.4), { at: 0.4, x: 0.5, y: 0.48, scale: 1.5 }, { at: 0.92, y: 0.62, opacity: 1 }, { at: 0.98, opacity: 0 }]);
  const moreDrops = prop('glass-drops', [...appearAt(0.42), { at: 0.42, x: 0.28, y: 0.3, scale: 1, rotate: 30 }, { at: 0.92, y: 0.42, opacity: 1 }, { at: 0.98, opacity: 0 }]);
  return {
    durationMs: STANDARD_MS,
    actors: [wave, drops, moreDrops, bucket],
    cues: [{ at: 0.03, sound: 'whoosh' }, { at: 0.3, sound: 'splash', screen: 'crash' }, { at: 0.45, sound: 'drip' }, { at: 0.56, sound: 'drip' }, { at: 0.7, sound: 'knock', screen: 'knock' }, { at: 0.8, sound: 'knock' }, { at: 0.86, sound: 'laugh' }],
  };
}

/** The tomato: it bursts on the glass, the pulp slides down and only its little stem falls at the end. */
function tomatoHit(): Sketch {
  const tomato = prop('tomato', [...thrown({ at: 0.03, x: 0.15, y: 0.9 }, { at: 0.26, x: 0.5, y: 0.42, scale: 0.6 }, 720), ...squash(0.27, 1.3, 0.7), ...vanishAt(0.27)]);
  const splat = prop('tomato-splat', [...appearAt(0.27), { at: 0.27, x: 0.5, y: 0.42, scale: 0.6, sy: 1 }, { at: 0.31, scale: 1.5, ease: 'out' }, { at: 0.4, sy: 1 }, { at: 0.86, y: 0.56, sy: 1.35, opacity: 1 }, { at: 0.93, opacity: 0 }]);
  const stem = prop('tomato-stem', [
    ...appearAt(0.27),
    { at: 0.27, x: 0.5, y: 0.34, scale: 0.2, rotate: 0 },
    { at: 0.68, y: 0.37, rotate: -10 },
    { at: 0.7, rotate: 15 },
    { at: 0.72, rotate: -15 },
    { at: 0.74, rotate: 0 },
    { at: 0.9, y: 1.25, rotate: 220, ease: 'in' },
    ...vanishAt(0.9),
  ]);
  return {
    durationMs: STANDARD_MS,
    actors: [tomato, splat, stem],
    cues: [{ at: 0.03, sound: 'whoosh' }, { at: 0.27, sound: 'splash', screen: 'crash' }, { at: 0.45, sound: 'drip' }, { at: 0.6, sound: 'drip' }, { at: 0.7, sound: 'pop' }, { at: 0.78, sound: 'whoosh' }, { at: 0.88, sound: 'laugh' }],
  };
}

/** The egg: it cracks on the glass, the yolk slides slowly… and the screen is so hot it fries. */
function eggHit(): Sketch {
  const egg = prop('egg', [...thrown({ at: 0.03, x: 0.75, y: 0.9 }, { at: 0.24, x: 0.5, y: 0.4, scale: 0.4 }, 540), ...vanishAt(0.24)]);
  const shell = prop('eggshell', [...appearAt(0.245), { at: 0.245, x: 0.5, y: 0.38, scale: 0.45, rotate: 0 }, { at: 0.28, scale: 0.55, ease: 'out' }, { at: 0.46, y: FALLEN_Y, rotate: 160, ease: 'in' }, ...vanishAt(0.46)]);
  const raw = prop('raw-egg', [...appearAt(0.245), { at: 0.245, x: 0.5, y: 0.4, scale: 0.4, sy: 1 }, { at: 0.28, scale: 1, ease: 'out' }, { at: 0.32, sy: 1 }, { at: 0.6, y: 0.52, sy: 1.25, ease: 'linear' }, { at: 0.64, sy: 1, opacity: 1 }, { at: 0.7, opacity: 0 }]);
  const fried = prop('fried-egg', [
    ...fadeIn(0.62, 0.7, 0.92, { x: 0.5, y: 0.52, scale: 1 }),
    { at: 0.72, scale: 1.05 },
    { at: 0.76, scale: 1 },
    { at: 0.8, scale: 1.05 },
    { at: 0.84, scale: 1 },
  ]);
  const steam = prop('steam', [...fadeIn(0.66, 0.7, 0.92, { x: 0.5, y: 0.4, scale: 0.5 }), { at: 0.66, y: 0.4 }, { at: 0.95, y: 0.3 }]);
  return {
    durationMs: STANDARD_MS,
    actors: [raw, fried, steam, shell, egg],
    cues: [{ at: 0.03, sound: 'whoosh' }, { at: 0.245, sound: 'crash', screen: 'crash' }, { at: 0.4, sound: 'drip' }, { at: 0.55, sound: 'drip' }, { at: 0.64, sound: 'sizzle', screen: 'rumble' }, { at: 0.8, sound: 'sizzle' }, { at: 0.9, sound: 'laugh' }],
  };
}

/** Where each feather starts falling: [x, y, start, end]. */
const FEATHERS = [
  [0.2, 0.3, 0.38, 0.86],
  [0.38, 0.22, 0.4, 0.9],
  [0.62, 0.28, 0.39, 0.84],
  [0.8, 0.35, 0.41, 0.92],
  [0.3, 0.5, 0.42, 0.88],
  [0.72, 0.52, 0.4, 0.9],
] as const;

/** The pillow: two swings at the glass, it bursts into feathers, and the last one tickles the screen until it shakes laughing. */
function pillowHit(): Sketch {
  const durationMs = STANDARD_MS;
  const pillow = prop('pillow', [
    { at: 0, x: -0.5, y: 0.45, scale: 1, rotate: -35, opacity: 0 },
    { at: 0.02, opacity: 1 },
    { at: 0.18, x: 0.5, rotate: 8, ease: 'in' },
    ...squash(0.19, 0.8, 1.1),
    { at: 0.25, x: 0.38, rotate: -15, ease: 'out' },
    { at: 0.31, x: 0.5, rotate: 10, ease: 'in' },
    ...squash(0.32, 0.8, 1.1),
    ...vanishAt(0.355),
  ]);
  const cloud = prop('feather-burst', burst(0.36, 0.5, 0.45, 1.7, 0.14));
  const falling = FEATHERS.map(([x, y, start, end]) =>
    prop('feather', [...appearAt(start), { at: start, x, y, scale: 0.22, rotate: 0 }, ...sway('rotate', start, end, durationMs, 28, 420, 0), ...sway('x', start, end, durationMs, 0.05, 420, x), { at: end, y: 1.25, ease: 'linear' }, ...vanishAt(end)])
  );
  const tickler = prop('feather', [...appearAt(0.4), { at: 0.4, x: 0.5, y: 0.3, scale: 0.3, rotate: 0 }, { at: 0.56, y: 0.55, ease: 'out' }, ...sway('rotate', 0.6, 0.82, durationMs, 35, 110, 0), { at: 0.86, y: 0.55 }, { at: 0.96, y: 1.25, ease: 'in' }, ...vanishAt(0.96)]);
  return {
    durationMs,
    actors: [pillow, cloud, ...falling, tickler],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.18, sound: 'thump', screen: 'crash' }, { at: 0.31, sound: 'thump', screen: 'knock' }, { at: 0.36, sound: 'pop' }, { at: 0.62, sound: 'laugh', screen: 'rumble' }, { at: 0.76, sound: 'laugh', screen: 'rumble' }],
  };
}

/** The ball: it comes spinning from far away, sticks in the cracked glass, falls, and «¡Fue sin querer!». */
function ballHit(): Sketch {
  const ball = prop('soccer-ball', [
    { at: 0, x: 0.5, y: 0.32, scale: 0.05, rotate: 0, opacity: 0 },
    { at: 0.03, opacity: 1 },
    { at: 0.28, y: 0.45, scale: 0.6, rotate: 1080, ease: 'in' },
    ...squash(0.29, 1.15, 0.85),
    { at: 0.58, y: 0.45, rotate: 1080 },
    { at: 0.6, y: 0.4, ease: 'out' },
    { at: 0.8, y: FALLEN_Y, rotate: 1300, ease: 'in' },
    ...vanishAt(0.8),
  ]);
  const crack = prop('glass-star-crack', [...appearAt(0.28), { at: 0.28, x: 0.5, y: 0.45, scale: 0.4 }, { at: 0.31, scale: 1.7, ease: 'out' }, { at: 0.9, opacity: 1 }, { at: 0.96, opacity: 0 }]);
  const shard = prop('glass-shard', [...appearAt(0.6), { at: 0.6, x: 0.58, y: 0.52, scale: 0.16, rotate: 0 }, { at: 0.82, y: 1.25, rotate: 280, ease: 'in' }, ...vanishAt(0.82)]);
  const sorry = prop('sorry-sign', [...popAt(0.68, 0.5, 0.22, 0.85, 0.93), { at: 0.72, rotate: -4 }, { at: 0.78, rotate: 3 }, { at: 0.84, rotate: -2 }]);
  return {
    durationMs: STANDARD_MS,
    actors: [crack, ball, shard, sorry],
    cues: [{ at: 0.03, sound: 'whoosh' }, { at: 0.28, sound: 'glass', screen: 'crash' }, { at: 0.6, sound: 'ting' }, { at: 0.68, sound: 'pop' }, { at: 0.8, sound: 'laugh' }],
  };
}

/** Where each lump of foam lands: [at, x, y, scale]. */
const FOAM = [
  [0.26, 0.32, 0.32, 0.55],
  [0.36, 0.6, 0.3, 0.5],
  [0.44, 0.42, 0.52, 0.65],
  [0.52, 0.66, 0.56, 0.45],
  [0.56, 0.25, 0.6, 0.4],
] as const;
/** Each spray of the can: [at, x, y, rotate]. */
const SPRAYS = [
  [0.22, 0.45, 0.4, -20],
  [0.34, 0.35, 0.3, 10],
  [0.46, 0.55, 0.5, -35],
] as const;

/** The carnival foam can: it shakes, sprays the screen white… and gives a sad «pfff» with one last bubble. */
function foamHit(): Sketch {
  const durationMs = STANDARD_MS;
  // Mirrored, so its nozzle points up and left, at the middle of the screen.
  const can = prop('foam-can', [
    { at: 0, x: 1.25, y: 1.05, scale: 0.45, sx: -1, sy: 1, rotate: -10, opacity: 0 },
    { at: 0.02, opacity: 1 },
    { at: 0.12, x: 0.78, y: 0.74, ease: 'out' },
    ...sway('rotate', 0.12, 0.2, durationMs, 12, 70, -10),
    ...sway('x', 0.2, 0.56, durationMs, 0.012, 80, 0.78),
    { at: 0.62, rotate: -10, sy: 1 },
    { at: 0.66, rotate: 15, sy: 0.92 },
    { at: 0.7, sy: 1 },
    { at: 0.84, x: 0.78, y: 0.74 },
    { at: 0.96, x: 1.3, y: 1.1, ease: 'in' },
    ...vanishAt(0.96),
  ]);
  const sprays = SPRAYS.map(([at, x, y, rotate]) => prop('foam-stream', [...appearAt(at), { at, x, y, scale: 0.2, rotate }, { at: at + 0.04, scale: 0.8, ease: 'out' }, { at: 0.85, opacity: 1 }, { at: 0.9, opacity: 0 }]));
  const lumps = FOAM.map(([at, x, y, scale]) => prop('foam-blob', [...popAt(at, x, y, scale, 0.9), { at: at + 0.04, y }, { at: 0.9, y: y + 0.08 }]));
  const lastBubble = prop('foam-blob', [...appearAt(0.67), { at: 0.67, x: 0.7, y: 0.62, scale: 0.02 }, { at: 0.7, scale: 0.09, ease: 'out' }, { at: 0.8, x: 0.68, y: 0.5, scale: 0.1 }, { at: 0.8, opacity: 1 }, { at: 0.805, opacity: 0, scale: 0.14 }]);
  return {
    durationMs,
    actors: [...sprays, ...lumps, can, lastBubble],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.13, sound: 'squeeze' }, { at: 0.22, sound: 'whoosh' }, { at: 0.26, sound: 'splash', screen: 'knock' }, { at: 0.34, sound: 'whoosh' }, { at: 0.46, sound: 'whoosh' }, { at: 0.66, sound: 'squeeze' }, { at: 0.8, sound: 'pop' }, { at: 0.86, sound: 'laugh' }],
  };
}

/** The flour: a fistful thrown from below, a white cloud, and a finger writes «JA JA» in the dust. */
function flourHit(): Sketch {
  const durationMs = STANDARD_MS;
  const hand = prop('flour-hand', [{ at: 0, x: 0.5, y: 1.35, scale: 0.5, rotate: 0, opacity: 0 }, { at: 0.02, opacity: 1 }, { at: 0.14, y: 0.82, ease: 'out' }, { at: 0.18, rotate: -12, y: 0.86 }, { at: 0.22, rotate: 8, y: 0.7, ease: 'in' }, { at: 0.36, y: 1.35, rotate: 0, ease: 'in' }, ...vanishAt(0.36)]);
  const cloud = prop('flour-cloud', [...appearAt(0.22), { at: 0.22, x: 0.5, y: 0.62, scale: 0.3 }, { at: 0.3, y: 0.45, scale: 2.4, ease: 'out' }, { at: 0.5, scale: 2.6, opacity: 1 }, { at: 0.64, opacity: 0 }]);
  const dust = prop('flour-dust', fadeIn(0.48, 0.6, 0.93, { x: 0.5, y: 0.45, scale: 1.25 }));
  const finger = prop('knock-finger', [
    { at: 0, x: 1.3, y: 0.48, scale: 0.32, rotate: -30, opacity: 0 },
    { at: 0.6, x: 1.3, opacity: 0 },
    { at: 0.61, opacity: 1 },
    { at: 0.66, x: 0.28, ease: 'out' },
    ...sway('y', 0.66, 0.82, durationMs, 0.04, 90, 0.48),
    { at: 0.82, x: 0.72, ease: 'linear' },
    { at: 0.9, x: 1.35, ease: 'in' },
    ...vanishAt(0.9),
  ]);
  return {
    durationMs,
    actors: [dust, cloud, hand, finger],
    cues: [{ at: 0.02, sound: 'whoosh' }, { at: 0.22, sound: 'whoosh', screen: 'crash' }, { at: 0.66, sound: 'squeeze' }, { at: 0.74, sound: 'squeeze' }, { at: 0.84, sound: 'laugh' }],
  };
}

/** The fly's zigzag over the screen: [at, x, y], landing in the middle. */
const FLIGHT = [
  [0.02, 0.15, 0.3],
  [0.08, 0.7, 0.2],
  [0.14, 0.35, 0.55],
  [0.2, 0.8, 0.45],
  [0.26, 0.25, 0.7],
  [0.32, 0.65, 0.3],
  [0.38, 0.45, 0.62],
  [0.43, 0.5, 0.5],
] as const;

/** The swatter: a fly buzzes around and lands, the swatter slams down… and lifts with no fly under it: it is up there laughing. */
function swatterHit(): Sketch {
  const durationMs = STANDARD_MS;
  const fly = prop('fly', [{ at: 0, x: -0.45, y: 0.3, scale: 0.2, opacity: 0 }, { at: 0.02, opacity: 1 }, ...FLIGHT.map(([at, x, y]) => ({ at, x, y })), ...sway('rotate', 0.02, 0.43, durationMs, 18, 100, 0), ...sway('rotate', 0.44, 0.51, durationMs, 10, 80, 0), ...vanishAt(0.515)]);
  const path = prop('fly-path', [{ at: 0, x: 0.5, y: 0.45, scale: 1.1, opacity: 0 }, { at: 0.04, opacity: 0 }, { at: 0.1, opacity: 0.6 }, { at: 0.38, opacity: 0.6 }, { at: 0.44, opacity: 0 }]);
  // The swatter's head is up and left of its middle: its middle lands down and right of the fly.
  const swatter = prop('swatter', [
    { at: 0, x: 0.62, y: -0.3, scale: 0.75, rotate: 35, opacity: 0 },
    { at: 0.44, opacity: 0 },
    { at: 0.45, opacity: 1 },
    { at: 0.52, x: 0.55, y: 0.6, rotate: 0, ease: 'in' },
    ...squash(0.53, 1.06, 0.94),
    { at: 0.62, x: 0.55, y: 0.6, rotate: 0 },
    { at: 0.7, x: 0.66, y: -0.35, rotate: 35, ease: 'in' },
    ...vanishAt(0.7),
  ]);
  const back = prop('fly', [{ at: 0, x: 0.75, y: 0.22, scale: 0.2, opacity: 0 }, { at: 0.64, opacity: 0 }, { at: 0.66, opacity: 1 }, ...sway('y', 0.66, 0.78, durationMs, 0.03, 90, 0.22), ...sway('rotate', 0.66, 0.95, durationMs, 15, 100, 0), { at: 0.8, x: 0.75 }, { at: 0.95, x: 1.45, y: 0.05, ease: 'in' }]);
  const laugh = prop('haha-text', popAt(0.68, 0.5, 0.2, 0.8, 0.88));
  return {
    durationMs,
    actors: [path, fly, swatter, back, laugh],
    cues: [{ at: 0.02, sound: 'buzz' }, { at: 0.21, sound: 'buzz' }, { at: 0.52, sound: 'thump', screen: 'crash' }, { at: 0.62, sound: 'ting' }, { at: 0.66, sound: 'buzz' }, { at: 0.68, sound: 'laugh' }, { at: 0.82, sound: 'buzz' }],
  };
}

/** Where the finger draws the «?» in the fog: [at, x, y]. */
const QUESTION_STROKE = [
  [0.79, 0.46, 0.5],
  [0.82, 0.54, 0.45],
  [0.85, 0.54, 0.52],
  [0.88, 0.5, 0.6],
] as const;
/** The three knocks on the glass. */
const KNOCKS = [0.17, 0.23, 0.29];

/** Knock knock: a giant finger knocks on the glass, a giant eye peeks in, and its breath fogs a «?». */
function knockHit(): Sketch {
  const durationMs = STANDARD_MS;
  const knocker = prop('knock-finger', [
    { at: 0, x: 0.5, y: 1.35, scale: 0.55, opacity: 0 },
    { at: 0.02, opacity: 1 },
    { at: 0.12, y: 0.6, ease: 'out' },
    ...KNOCKS.flatMap((at): ActorKey[] => [{ at: at - 0.03, scale: 0.55, y: 0.6 }, { at, scale: 0.66, y: 0.56, ease: 'in' }]),
    { at: 0.31, scale: 0.55, y: 0.6 },
    { at: 0.4, y: 1.35, ease: 'in' },
    ...vanishAt(0.4),
  ]);
  const eye = prop('peeking-eye', [
    { at: 0, x: 0.5, y: 0.45, scale: 0.3, opacity: 0 },
    { at: 0.4, opacity: 0 },
    { at: 0.43, opacity: 1 },
    { at: 0.5, scale: 1.4, ease: 'out' },
    ...sway('x', 0.5, 0.64, durationMs, 0.07, 260, 0.5),
    { at: 0.6, sy: 1 },
    { at: 0.61, sy: 0.1 },
    { at: 0.63, sy: 1 },
    { at: 0.66, scale: 1.4, opacity: 1 },
    { at: 0.72, scale: 0.3, opacity: 0 },
  ]);
  const fog = prop('fog-question', [...fadeIn(0.68, 0.72, 0.93, { x: 0.5, y: 0.45, scale: 0.4 }, 0.95), { at: 0.68, scale: 0.4 }, { at: 0.74, scale: 1.2, ease: 'out' }]);
  const writer = prop('knock-finger', [{ at: 0, x: 0.5, y: 1.3, scale: 0.4, rotate: -20, opacity: 0 }, { at: 0.72, y: 1.3, opacity: 0 }, { at: 0.73, opacity: 1 }, { at: 0.76, y: 0.55, ease: 'out' }, ...QUESTION_STROKE.map(([at, x, y]) => ({ at, x, y })), { at: 0.96, y: 1.3, ease: 'in' }, ...vanishAt(0.96)]);
  return {
    durationMs,
    actors: [fog, eye, knocker, writer],
    cues: [...KNOCKS.map((at) => ({ at, sound: 'knock' as const, screen: 'knock' as const })), { at: 0.43, sound: 'whoosh' }, { at: 0.61, sound: 'ting' }, { at: 0.7, sound: 'whoosh' }, { at: 0.8, sound: 'squeeze' }, { at: 0.9, sound: 'laugh' }],
  };
}

/** The big kiss: puckered lips come at you, squash on the glass like a suction cup, and leave their lipstick mark. */
function kissHit(): Sketch {
  const durationMs = STANDARD_MS;
  const lips = prop('big-lips', [
    { at: 0, x: 0.5, y: 0.5, scale: 0.08, sy: 1, opacity: 0 },
    { at: 0.03, opacity: 1 },
    ...sway('sx', 0.05, 0.34, durationMs, 0.08, 220, 1),
    { at: 0.36, scale: 1, sy: 1, ease: 'in' },
    { at: 0.37, sx: 1.45, sy: 0.7 },
    ...sway('x', 0.4, 0.54, durationMs, 0.012, 60, 0.5),
    { at: 0.55, sx: 1.45, sy: 0.7 },
    { at: 0.57, sx: 0.9, sy: 1.1, scale: 1 },
    { at: 0.62, opacity: 1 },
    { at: 0.66, scale: 0.25 },
    { at: 0.67, opacity: 0 },
  ]);
  const mark = prop('lipstick-mark', [...appearAt(0.56), { at: 0.56, x: 0.5, y: 0.5, scale: 1, sx: 1.35, sy: 0.8 }, { at: 0.93, opacity: 1 }, { at: 0.98, opacity: 0 }]);
  const heart = prop('heart', [...appearAt(0.66), { at: 0.66, x: 0.56, y: 0.42, scale: 0.03 }, { at: 0.7, scale: 0.3, ease: 'out' }, ...sway('x', 0.7, 0.92, durationMs, 0.03, 300, 0.56), { at: 0.92, y: 0.22, opacity: 1 }, { at: 0.97, opacity: 0 }]);
  return {
    durationMs,
    actors: [mark, lips, heart],
    cues: [{ at: 0.04, sound: 'whistle' }, { at: 0.37, sound: 'smooch', screen: 'squeeze' }, { at: 0.46, sound: 'squeeze' }, { at: 0.56, sound: 'pop' }, { at: 0.68, sound: 'chime' }, { at: 0.86, sound: 'laugh' }],
    particlesAt: [0.6, 0.95],
  };
}

export const ATTACK_SKETCHES: Record<AttackWinkId, Sketch> = {
  'hit-slipper': slipperHit(),
  'hit-pie': pieHit(),
  'hit-bucket': bucketHit(),
  'hit-tomato': tomatoHit(),
  'hit-egg': eggHit(),
  'hit-pillow': pillowHit(),
  'hit-ball': ballHit(),
  'hit-foam': foamHit(),
  'hit-flour': flourHit(),
  'hit-swatter': swatterHit(),
  'hit-knock': knockHit(),
  'hit-kiss': kissHit(),
};

/** The tile of each attack in the panel: what is thrown. */
export const ATTACK_TILES: Record<AttackWinkId, WinkPropId> = {
  'hit-slipper': 'slipper',
  'hit-pie': 'cream-pie',
  'hit-bucket': 'bucket',
  'hit-tomato': 'tomato',
  'hit-egg': 'egg',
  'hit-pillow': 'pillow',
  'hit-ball': 'soccer-ball',
  'hit-foam': 'foam-can',
  'hit-flour': 'flour-cloud',
  'hit-swatter': 'swatter',
  'hit-knock': 'knock-finger',
  'hit-kiss': 'big-lips',
};
