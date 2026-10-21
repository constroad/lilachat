import type { WinkDance } from './winkDances.js';

/**
 * Winks, like MSN Messenger's (backlog 3, José 21/10): a full-screen animation
 * with sound that goes with a message of kind `guino`. Microsoft's are not
 * ours, so these are our own: a full-body character (drawn in Stitch, its parts
 * in `winkArt`) that dances with its whole body (`winkDances`), with a few
 * particles around it seeded by the message, so the app and the web, sender
 * and receiver, see the same. PURE: the app, the web and the server use it.
 */
export type CharacterWinkId = 'piggy' | 'worker' | 'cuppa' | 'sweetheart' | 'bear' | 'kitty' | 'puppy' | 'panda' | 'brick';
export type SiteWinkId = 'cone' | 'roller' | 'dumptruck' | 'excavator' | 'paver' | 'flagger';
export type EmojiWinkId = 'hearts' | 'applause' | 'party' | 'laugh' | 'hug' | 'hardhat' | 'coffee' | 'done';
export type WinkId = CharacterWinkId | SiteWinkId | EmojiWinkId;
/** How the particles move: up from the bottom, out from the center, or down from the top. */
export type WinkMotion = 'rise' | 'burst' | 'rain';
/** One of the sounds both clients carry (app: bundled files; web: the same files). */
export type WinkSound = 'chime' | 'pop' | 'clap' | 'horn' | 'groove';
/** The «Guiños» panel shows them in these three groups. */
export type WinkGroup = 'characters' | 'site' | 'emoji';

type WinkBase = { id: WinkId; name: string; group: WinkGroup; particles: readonly string[]; motion: WinkMotion; durationMs: number; sound: WinkSound };
/** A full-body character drawn in Stitch (`winkArt`) that dances with its whole body (`winkDances`). */
export type CharacterWink = WinkBase & { kind: 'character'; dance: WinkDance };
/** The first winks (José, 21/10: «deja los emojis que tenías antes, están bien»): a big emoji that pops and wiggles. */
export type EmojiWink = WinkBase & { kind: 'emoji'; hero: string };
export type Wink = CharacterWink | EmojiWink;

/** A character wink lasts long enough for its dance to land a joke (José, 21/10: «duraba un poco más su baile»). */
const CHARACTER_MS = 6500;

const character = (id: CharacterWinkId | SiteWinkId, name: string, group: WinkGroup, dance: WinkDance, sound: WinkSound, particles: readonly string[], motion: WinkMotion, durationMs = 3000): CharacterWink => ({ id, name, group, kind: 'character', dance, sound, particles, motion, durationMs });
const emoji = (id: EmojiWinkId, name: string, hero: string, particles: readonly string[], motion: WinkMotion, durationMs: number, sound: WinkSound): EmojiWink => ({ id, name, group: 'emoji', kind: 'emoji', hero, particles, motion, durationMs, sound });

export const WINKS: readonly Wink[] = [
  // Our own party pig (José, 21/10: «¿no podemos sacar el chanchito bailando?»), adult humor, not a kids' mascot.
  character('piggy', 'Chancho fiestero', 'characters', 'disco', 'groove', ['🎵', '🎶', '✨'], 'rise', CHARACTER_MS),
  character('worker', 'Maestro de obra', 'characters', 'cumbia', 'groove', ['🎵', '✨'], 'rise', CHARACTER_MS),
  character('sweetheart', 'Corazón galán', 'characters', 'hug', 'chime', ['❤️', '💕', '🌹'], 'rise', CHARACTER_MS),
  character('bear', 'Oso hincha', 'characters', 'clap', 'clap', ['⚽', '✨'], 'burst', CHARACTER_MS),
  character('kitty', 'Gato de fiesta', 'characters', 'disco', 'groove', ['🎊', '🎉', '✨'], 'rain', CHARACTER_MS),
  character('puppy', 'Perro carcajada', 'characters', 'laugh', 'pop', ['😂', '🤣'], 'burst', CHARACTER_MS),
  character('panda', 'Panda abrazón', 'characters', 'hug', 'chime', ['💛', '💕'], 'rise', CHARACTER_MS),
  character('cuppa', 'Café de lunes', 'characters', 'tired', 'pop', ['☕', '💤'], 'rise', CHARACTER_MS),
  character('brick', 'Ladrillo fisicoculturista', 'characters', 'flex', 'groove', ['💪', '✨'], 'burst', CHARACTER_MS),
  // Construction, roads and asphalt (José, 21/10: «agrega conceptos de obra, pistas y asfalto»).
  character('cone', 'Cono cumbiero', 'site', 'cumbia', 'groove', ['🚧', '🎵'], 'rise', CHARACTER_MS),
  character('roller', 'Rodillo chévere', 'site', 'disco', 'groove', ['💨', '✨'], 'burst', CHARACTER_MS),
  character('dumptruck', 'Volquete fanfarrón', 'site', 'flex', 'horn', ['🪨', '✨'], 'rain', CHARACTER_MS),
  character('excavator', 'Excavadora rockera', 'site', 'rock', 'groove', ['🤘', '🪨'], 'rain', CHARACTER_MS),
  character('paver', 'Asfaltador acalorado', 'site', 'tired', 'pop', ['🔥', '💦'], 'rise', CHARACTER_MS),
  character('flagger', 'Señalero estricto', 'site', 'wave', 'horn', ['🚧', '✋'], 'burst', CHARACTER_MS),
  emoji('hearts', 'Corazones', '❤️', ['❤️', '💜', '💕', '💖'], 'rise', 2800, 'chime'),
  emoji('applause', 'Aplausos', '👏', ['👏', '✨', '🙌'], 'burst', 2400, 'clap'),
  emoji('party', 'Fiesta', '🎉', ['🎊', '🎉', '✨', '🥳'], 'rain', 3000, 'pop'),
  emoji('laugh', 'Risa', '😂', ['😂', '🤣', '😆'], 'burst', 2400, 'pop'),
  emoji('hug', 'Abrazo', '🤗', ['💛', '🤗', '💕'], 'rise', 2800, 'chime'),
  emoji('hardhat', 'Casco de obra', '👷', ['🦺', '🚧', '🏗️', '⛑️'], 'rain', 3000, 'horn'),
  emoji('coffee', 'Café', '☕', ['☕', '🥐', '✨'], 'rise', 2600, 'pop'),
  emoji('done', '¡Listo!', '✅', ['✅', '💪', '⭐'], 'burst', 2400, 'chime'),
];

const WINK_IDS = new Set<string>(WINKS.map((wink) => wink.id));

export function isWinkId(value: unknown): value is WinkId {
  return typeof value === 'string' && WINK_IDS.has(value);
}

export function winkById(id: string | undefined): Wink | undefined {
  return WINKS.find((wink) => wink.id === id);
}

/** A particle in screen fractions (0–1 of the width and the height), with its timing. */
export type WinkParticle = {
  glyph: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delayMs: number;
  durationMs: number;
  /** Font size in dp/px. */
  size: number;
  /** Turns while it travels, in degrees. */
  rotate: number;
};

const PARTICLE_COUNT = 18;
const MIN_SIZE = 26;
const SIZE_RANGE = 30;
/** Particles start in the first half, so the last ones still finish in time. */
const DELAY_SHARE = 0.45;
const MIN_TRAVEL_SHARE = 0.35;

/** mulberry32: small, fast and the same on Hermes and in every browser. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Where a particle starts and ends for each motion. */
function path(motion: WinkMotion, random: () => number): Pick<WinkParticle, 'fromX' | 'fromY' | 'toX' | 'toY'> {
  if (motion === 'burst') {
    const angle = random() * Math.PI * 2;
    const reach = 0.3 + random() * 0.3;
    return { fromX: 0.5, fromY: 0.5, toX: 0.5 + Math.cos(angle) * reach, toY: 0.5 + Math.sin(angle) * reach };
  }
  const x = random();
  const drift = (random() - 0.5) * 0.3;
  if (motion === 'rise') return { fromX: x, fromY: 1.05, toX: clamp01(x + drift), toY: -0.1 };
  return { fromX: x, fromY: -0.1, toX: clamp01(x + drift), toY: 1.1 };
}

/**
 * The choreography of one wink, seeded by the message's `seq`: the sender and
 * the receiver, on the app or the web, see exactly the same.
 */
export function winkParticles(wink: Wink, seed: number): WinkParticle[] {
  const random = seededRandom(seed);
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const delayMs = Math.round(random() * wink.durationMs * DELAY_SHARE);
    const room = wink.durationMs - delayMs;
    const durationMs = Math.round(room * (MIN_TRAVEL_SHARE + random() * (1 - MIN_TRAVEL_SHARE)));
    return {
      glyph: wink.particles[Math.floor(random() * wink.particles.length)]!,
      ...path(wink.motion, random),
      delayMs,
      durationMs,
      size: Math.round(MIN_SIZE + random() * SIZE_RANGE),
      rotate: Math.round((random() - 0.5) * (wink.motion === 'rain' ? 360 : 60)),
    };
  });
}

export type FunToPlay = { seq: number; kind: 'zumbido'; mine: boolean } | { seq: number; kind: 'guino'; wink: WinkId; mine: boolean };

/**
 * The nudge or wink to play: the newest after `afterSeq`. When the chat opens,
 * `afterSeq` is what was already read, so the one that came while it was closed
 * plays once (spec: «la animación corre una sola vez al abrirlo»). A wink I
 * sent also plays for me; my own nudge does not shake my screen.
 */
export function funMessageToPlay(messages: readonly { seq: number; kind?: string; senderId: string; wink?: string }[], me: string, afterSeq: number): FunToPlay | null {
  let newest: FunToPlay | null = null;
  for (const message of messages) {
    if (message.seq <= afterSeq || (newest && message.seq < newest.seq)) continue;
    const mine = message.senderId === me;
    if (message.kind === 'zumbido' && !mine) newest = { seq: message.seq, kind: 'zumbido', mine };
    if (message.kind === 'guino' && isWinkId(message.wink)) newest = { seq: message.seq, kind: 'guino', wink: message.wink, mine };
  }
  return newest;
}

/** A muted chat stays still and quiet; reduced motion drops only the animation. */
export function shouldPlayFun(params: { muted: boolean; reducedMotion: boolean }): { animate: boolean; sound: boolean; vibrate: boolean } {
  if (params.muted) return { animate: false, sound: false, vibrate: false };
  return { animate: !params.reducedMotion, sound: true, vibrate: true };
}

/** The line that stays in the chat for a wink. */
export function funNoticeText(params: { kind: 'guino'; wink?: string; mine: boolean; author?: string }): string {
  const name = winkById(params.wink)?.name;
  const who = params.mine ? 'Mandaste un guiño' : params.author ? `${params.author} te mandó un guiño` : 'Te mandaron un guiño';
  return name ? `${who} · ${name}` : who;
}

/**
 * A nudge or wink that just arrived to a row of the chat list (José, 21/10:
 * «en la lista de chats el card item no se mueve»). Never on the first look
 * at the row (`previousSeq` unknown) and never for what I sent.
 */
export function funArrivedInRow(previousSeq: number | undefined, last: { seq: number; kind?: string; senderId: string } | null | undefined, me: string): 'zumbido' | 'guino' | null {
  if (previousSeq === undefined || !last || last.seq <= previousSeq || last.senderId === me) return null;
  return last.kind === 'zumbido' || last.kind === 'guino' ? last.kind : null;
}

/** The strong part of the shake: wide swings to each side. */
const STRONG_SWINGS: readonly number[] = [-1, 1, -0.9, 0.9, -1, 0.8, -0.9, 1];
/** How it calms down before stopping. */
const CALMING: readonly number[] = [-0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0];

/**
 * The nudge's shake, the same in the app and on the web (José, 21/10: too fast it
 * looked like a scroll glitch; like MSN, 2 s, sideways only, a bit quicker): the
 * whole screen swings sideways, wide, for about 2 s. 31 steps of 65 ms. Each
 * step is a fraction of `amplitude`.
 */
export const NUDGE_SHAKE = {
  amplitude: 18,
  stepMs: 65,
  path: [...STRONG_SWINGS, ...STRONG_SWINGS, ...STRONG_SWINGS.slice(0, 7), ...CALMING],
} as const;
