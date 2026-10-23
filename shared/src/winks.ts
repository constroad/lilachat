import { WINK_PROPS, type WinkArtId, type WinkPropId } from './winkArt.js';
import { WINK_SKETCHES } from './winkSketches.js';
import { seasonOf, type WinkSeason } from './winkSeasons.js';
import type { ScreenEffect } from './winkTimeline.js';

/**
 * Winks, like MSN Messenger's (backlog 3, José 21/10): a full-screen animation
 * with sound that goes with a message of kind `guino`. Microsoft's are not
 * ours, so these are our own: a short sketch with a punchline (José, 21/10:
 * «se trata de que sean graciosos, no de que todos bailen»), played by
 * full-body characters and props drawn in Stitch (`winkArt`) following a
 * shared timeline (`winkSketches`), with a few particles seeded by the message,
 * so the app and the web, sender and receiver, see the same. PURE: the app,
 * the web and the server use it.
 */
export type CharacterWinkId = 'piggy' | 'balloon' | 'worker' | 'cuppa' | 'sweetheart' | 'bear' | 'kitty' | 'puppy' | 'panda' | 'brick' | 'rainy' | HalloweenWinkId | ChristmasWinkId | LaterSeasonsWinkId;
/** Pending 73: the Halloween ones (sheet `r151-halloween`). */
export type HalloweenWinkId = 'pumpkin' | 'vampire' | 'mummy' | 'witch' | 'ghost';
/** Pending 73: the Christmas ones (sheet `r152-navidad`). */
export type ChristmasWinkId = 'santa' | 'elf' | 'reindeer' | 'snowman' | 'secret-santa';
/** Pending 73: New Year, Valentine, Mother's Day and Fiestas Patrias (sheets `r153-*`). */
export type LaterSeasonsWinkId = 'countdown' | 'grapes' | 'suitcase' | 'yellow' | 'toast' | 'cupid' | 'roses' | 'serenade' | 'stood-up' | 'heartbroken' | 'multitask-mom' | 'grandma' | 'late-son' | 'engineer-mom' | 'voice-note' | 'flag' | 'marinera' | 'anticucho' | 'parade' | 'pisco';
export type SiteWinkId = 'cone' | 'roller' | 'dumptruck' | 'excavator' | 'paver' | 'flagger';
export type EmojiWinkId = 'hearts' | 'applause' | 'party' | 'laugh' | 'hug' | 'hardhat' | 'coffee' | 'done';
export type WinkId = CharacterWinkId | SiteWinkId | EmojiWinkId;
/** How the particles move: up from the bottom, out from the center, or down from the top. */
export type WinkMotion = 'rise' | 'burst' | 'rain';
/**
 * The sounds both clients carry (app: bundled files; web: the same files),
 * synthesized by us: the music beds (groove, rock) and the sketches' effects.
 */
export type WinkSound =
  | 'chime' | 'pop' | 'clap' | 'horn' | 'groove' | 'rock'
  | 'ting' | 'boing' | 'smooch' | 'whoosh' | 'splash' | 'drip' | 'knock' | 'glass' | 'thump' | 'squeeze'
  | 'cheer' | 'partyhorn' | 'laugh' | 'yawn' | 'snore' | 'alarm' | 'rumble' | 'sizzle' | 'whistle' | 'crash';
export const WINK_SOUNDS: readonly WinkSound[] = ['chime', 'pop', 'clap', 'horn', 'groove', 'rock', 'ting', 'boing', 'smooch', 'whoosh', 'splash', 'drip', 'knock', 'glass', 'thump', 'squeeze', 'cheer', 'partyhorn', 'laugh', 'yawn', 'snore', 'alarm', 'rumble', 'sizzle', 'whistle', 'crash'];
/** The «Guiños» panel shows them in these three groups. */
export type WinkGroup = 'characters' | 'site' | 'emoji' | 'season';

/** `particlesAt`: the share of the wink the particles fly in (none without it). */
type WinkBase = { id: WinkId; name: string; group: WinkGroup; particles: readonly string[]; motion: WinkMotion; durationMs: number; particlesAt?: readonly [number, number]; season?: WinkSeason };
/** A sketch (`WINK_SKETCHES`); its tile in the panel is the character, or `tile` for a wink without one (the water balloon) or whose id is not its art's (the dog under the rain). */
export type CharacterWink = WinkBase & { kind: 'character'; tile?: WinkPropId | WinkArtId };
/** The first winks (José, 21/10: «deja los emojis que tenías antes, están bien»): a big emoji that pops and wiggles. */
export type EmojiWink = WinkBase & { kind: 'emoji'; hero: string; sound: WinkSound };
export type Wink = CharacterWink | EmojiWink;

const character = (id: CharacterWinkId | SiteWinkId, name: string, group: WinkGroup, particles: readonly string[], motion: WinkMotion, tile?: WinkPropId | WinkArtId): CharacterWink => {
  const sketch = WINK_SKETCHES[id];
  return { id, name, group, kind: 'character', particles, motion, durationMs: sketch.durationMs, ...(sketch.particlesAt ? { particlesAt: sketch.particlesAt } : {}), ...(tile ? { tile } : {}) };
};
const emoji = (id: EmojiWinkId, name: string, hero: string, particles: readonly string[], motion: WinkMotion, durationMs: number, sound: WinkSound): EmojiWink => ({ id, name, group: 'emoji', kind: 'emoji', hero, particles, motion, durationMs, sound, particlesAt: [0, 1] });

export const WINKS: readonly Wink[] = [
  // Our own party pig (José, 21/10: «gordito moviendo y enseñando el rabo»), adult humor, not a kids' mascot.
  character('piggy', 'Chancho fiestero', 'characters', ['🎵', '🎶', '✨'], 'rise'),
  // MSN's best one, our way (José, 21/10: «¿dónde está el globo que te enviaban?»).
  character('balloon', 'Globo de agua', 'characters', ['💦', '💧'], 'burst', 'balloon'),
  character('sweetheart', 'Corazón galán', 'characters', ['❤️', '💕', '🌹'], 'rise'),
  character('panda', 'Panda abrazón', 'characters', ['💛', '💕'], 'rise'),
  character('worker', 'Maestro de obra', 'characters', [], 'burst'),
  character('bear', 'Oso hincha', 'characters', ['🎊', '🎉', '✨'], 'rain'),
  character('kitty', 'Gato de fiesta', 'characters', ['🎊', '🎉', '✨', '🥳'], 'burst'),
  character('puppy', 'Perro carcajada', 'characters', ['😂', '🤣'], 'burst'),
  character('cuppa', 'Café de lunes', 'characters', [], 'rise'),
  character('brick', 'Ladrillo fisicoculturista', 'characters', ['✨', '💪', '⭐'], 'burst'),
  // Pending 60 (José, 22/10): a sad dog the rain picks on, drawn in Stitch (`r149-perrito-lluvia`).
  character('rainy', 'Perrito bajo la lluvia', 'characters', ['💧', '💦'], 'rain', 'dog-sad'),
  // Halloween (pending 73): offered from October 1 to November 2.
  { ...character('pumpkin', 'Calabaza obrera', 'season', ['🍬', '🍭'], 'burst', 'pumpkin-guy'), season: 'halloween' },
  { ...character('vampire', 'Jefe vampiro', 'season', ['🦇'], 'burst', 'vampire-boss'), season: 'halloween' },
  { ...character('mummy', 'Momia de obra', 'season', [], 'rise', 'mummy-worker'), season: 'halloween' },
  { ...character('witch', 'Bruja contadora', 'season', ['✨', '💚'], 'rise', 'witch-accountant'), season: 'halloween' },
  { ...character('ghost', 'Fantasma practicante', 'season', ['👻'], 'rise', 'ghost-intern'), season: 'halloween' },
  // Christmas (pending 73): offered from December 1 to 26.
  { ...character('santa', 'Papá Noel capataz', 'season', ['⭐'], 'rise', 'santa-foreman'), season: 'christmas' },
  { ...character('elf', 'Elfo practicante', 'season', ['🎁'], 'rise', 'elf-intern'), season: 'christmas' },
  { ...character('reindeer', 'Reno chofer', 'season', ['💨'], 'burst', 'reindeer-driver'), season: 'christmas' },
  { ...character('snowman', 'Vigilante de nieve', 'season', ['💧'], 'rise', 'snowman-guard'), season: 'christmas' },
  { ...character('secret-santa', 'Amigo secreto', 'season', ['🎉'], 'burst', 'secret-santa'), season: 'christmas' },
  // New Year (pending 73): December 27 to January 7.
  { ...character('countdown', 'Cuenta regresiva', 'season', [], 'burst', 'countdown-boss'), season: 'newyear' },
  { ...character('grapes', 'Las doce uvas', 'season', [], 'rise', 'grape-guy'), season: 'newyear' },
  { ...character('suitcase', 'La maleta', 'season', [], 'rise', 'suitcase-runner'), season: 'newyear' },
  { ...character('yellow', 'Todo amarillo', 'season', [], 'rise', 'yellow-lucky'), season: 'newyear' },
  { ...character('toast', 'El brindis', 'season', [], 'burst', 'toast-engineer'), season: 'newyear' },
  // Valentine (pending 73): February 1 to 15.
  { ...character('cupid', 'Cupido practicante', 'season', ['💘'], 'rise', 'cupid-intern'), season: 'valentine' },
  { ...character('roses', 'Delivery de rosas', 'season', [], 'rise', 'roses-courier'), season: 'valentine' },
  { ...character('serenade', 'Serenata', 'season', [], 'rise', 'serenader'), season: 'valentine' },
  { ...character('stood-up', 'Plantón', 'season', [], 'rise', 'stood-up'), season: 'valentine' },
  { ...character('heartbroken', 'Corazón roto', 'season', [], 'rise', 'heartbroken'), season: 'valentine' },
  // Mother's Day (pending 73): May 1 to 15.
  { ...character('multitask-mom', 'Mamá multitarea', 'season', [], 'rise', 'multitask-mom'), season: 'mothers' },
  { ...character('grandma', '¿Ya comiste?', 'season', [], 'rise', 'grandma-cook'), season: 'mothers' },
  { ...character('late-son', 'Llegó tarde', 'season', ['🌸'], 'rise', 'late-son'), season: 'mothers' },
  { ...character('engineer-mom', 'Mamá ingeniera', 'season', [], 'rise', 'engineer-mom'), season: 'mothers' },
  { ...character('voice-note', 'El audio de mamá', 'season', [], 'rise', 'voice-note-mom'), season: 'mothers' },
  // Fiestas Patrias (pending 73): July 15 to 31.
  { ...character('flag', '¡Viva el Perú!', 'season', [], 'burst', 'flag-worker'), season: 'patrias' },
  { ...character('marinera', 'Marinera', 'season', [], 'rise', 'marinera-dancer'), season: 'patrias' },
  { ...character('anticucho', 'Anticuchos', 'season', [], 'rise', 'anticucho-chef'), season: 'patrias' },
  { ...character('parade', 'Paso de desfile', 'season', [], 'rise', 'parade-marcher'), season: 'patrias' },
  { ...character('pisco', 'Salud con pisco', 'season', [], 'rise', 'pisco-toast'), season: 'patrias' },
  // Construction, roads and asphalt (José, 21/10: «agrega conceptos de obra, pistas y asfalto»).
  character('cone', 'Cono cumbiero', 'site', ['🎵', '🎶'], 'rise'),
  character('roller', 'Rodillo chévere', 'site', ['💨', '✨'], 'rise'),
  character('dumptruck', 'Volquete fanfarrón', 'site', ['💨'], 'burst'),
  character('excavator', 'Excavadora rockera', 'site', ['🤘', '⚡'], 'burst'),
  character('paver', 'Asfaltador acalorado', 'site', ['💨', '🔥'], 'rise'),
  character('flagger', 'Señalero estricto', 'site', [], 'burst'),
  emoji('hearts', 'Corazones', '❤️', ['❤️', '💜', '💕', '💖'], 'rise', 2800, 'chime'),
  emoji('applause', 'Aplausos', '👏', ['👏', '✨', '🙌'], 'burst', 2400, 'clap'),
  emoji('party', 'Fiesta', '🎉', ['🎊', '🎉', '✨', '🥳'], 'rain', 3000, 'pop'),
  emoji('laugh', 'Risa', '😂', ['😂', '🤣', '😆'], 'burst', 2400, 'pop'),
  emoji('hug', 'Abrazo', '🤗', ['💛', '🤗', '💕'], 'rise', 2800, 'chime'),
  emoji('hardhat', 'Casco de obra', '👷', ['🦺', '🚧', '🏗️', '⛑️'], 'rain', 3000, 'horn'),
  emoji('coffee', 'Café', '☕', ['☕', '🥐', '✨'], 'rise', 2600, 'pop'),
  emoji('done', '¡Listo!', '✅', ['✅', '💪', '⭐'], 'burst', 2400, 'chime'),
];

/** What a wink sounds like and does to the screen, moment by moment (ms): an emoji wink, its sound; a sketch, its cues. */
export function winkCues(wink: Wink): { atMs: number; sound?: WinkSound; screen?: ScreenEffect }[] {
  if (wink.kind === 'emoji') return [{ atMs: 0, sound: wink.sound }];
  const sketch = WINK_SKETCHES[wink.id as CharacterWinkId | SiteWinkId];
  return sketch.cues.map((cue) => ({ atMs: Math.round(cue.at * sketch.durationMs), ...(cue.sound ? { sound: cue.sound } : {}), ...(cue.screen ? { screen: cue.screen } : {}) }));
}

/** The short sound of a wink landing in a row of the chat list: an emoji wink, its own; a sketch, a «ting» (its music is for the full screen). */
export function winkRowSound(wink: Wink | undefined): WinkSound {
  if (!wink) return 'pop';
  return wink.kind === 'emoji' ? wink.sound : 'ting';
}

const WINK_IDS = new Set<string>(WINKS.map((wink) => wink.id));

export function isWinkId(value: unknown): value is WinkId {
  return typeof value === 'string' && WINK_IDS.has(value);
}

/** A wink drawn by a prop (the water balloon), not by a character: its tile is drawn bigger. */
export function winkTileIsProp(wink: CharacterWink): boolean {
  return Boolean(wink.tile && wink.tile in WINK_PROPS);
}

/** The panel's groups (pending 73): the season's winks first when it is on, then the usual three; out of season they are not offered. */
export function winkPanelGroups(now: Date): { key: string; title: string; winks: Wink[] }[] {
  const season = seasonOf(now);
  const seasonal = season ? [{ key: season.season, title: season.title, winks: WINKS.filter((wink) => wink.season === season.season) }] : [];
  const usual = ([['characters', 'Personajes'], ['site', 'Obra y pistas'], ['emoji', 'Emojis']] as const).map(([group, title]) => ({ key: group, title, winks: WINKS.filter((wink) => wink.group === group && !wink.season) }));
  return [...seasonal, ...usual].filter((group) => group.winks.length > 0);
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
  if (!wink.particlesAt || wink.particles.length === 0) return [];
  const random = seededRandom(seed);
  const startMs = wink.particlesAt[0] * wink.durationMs;
  const endMs = wink.particlesAt[1] * wink.durationMs;
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const delayMs = Math.round(startMs + random() * (endMs - startMs) * DELAY_SHARE);
    const room = endMs - delayMs;
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

/** How recent a nudge or wink of mine must be to count as «just sent» (it comes back through the socket in a second or two; the margin covers a clock a little off). */
export const FUN_LIVE_MS = 30_000;

/**
 * The nudge or wink to play: the newest after `afterSeq`. When the chat opens,
 * `afterSeq` is what was already read, so the one that came while it was closed
 * plays once (spec: «la animación corre una sola vez al abrirlo»). A wink or
 * nudge I send plays for me when it goes (`mineToo`; José, 21/10: he did not
 * feel his own nudge), not again when I open the chat later. With `mineSince`,
 * mine only counts if it was sent after that moment: the history that arrives
 * after the chat opened is not «live» (José, 21/10: every time he went into
 * the chat, his old nudge buzzed again).
 */
export function funMessageToPlay(messages: readonly { seq: number; kind?: string; senderId: string; wink?: string; at?: string; deletedAt?: string }[], me: string, afterSeq: number, options: { mineToo: boolean; mineSince?: number } = { mineToo: true }): FunToPlay | null {
  let newest: FunToPlay | null = null;
  for (const message of messages) {
    // Deleted for everyone before it was seen: it never plays (22/10).
    if (message.seq <= afterSeq || message.deletedAt || (newest && message.seq < newest.seq)) continue;
    const mine = message.senderId === me;
    const fresh = options.mineSince === undefined || (message.at !== undefined && Date.parse(message.at) >= options.mineSince);
    const counts = !mine || (options.mineToo && fresh);
    if (message.kind === 'zumbido' && counts) newest = { seq: message.seq, kind: 'zumbido', mine };
    if (message.kind === 'guino' && isWinkId(message.wink) && counts) newest = { seq: message.seq, kind: 'guino', wink: message.wink, mine };
  }
  return newest;
}

/** Where a nudge or wink plays: in the open chat, on a row of the chat list, or again from «Ver otra vez». */
export type FunPlace = 'chat' | 'row' | 'replay';

/**
 * Whether it moves, sounds and vibrates. In the open chat it is what you are
 * looking at, so it always plays (José, 21/10: Wilson never saw them — a muted
 * chat or the phone's «remove animations», which Samsung's battery saver turns
 * on, skipped them): muting only silences it. «Ver otra vez» was asked for, so
 * it plays whole, with its sound and buzz. A row of the list stays quiet when muted and
 * still with reduced motion.
 */
export function shouldPlayFun(params: { muted: boolean; reducedMotion: boolean; place: FunPlace }): { animate: boolean; sound: boolean; vibrate: boolean } {
  if (params.place === 'replay') return { animate: true, sound: true, vibrate: true };
  if (params.place === 'chat') return { animate: true, sound: !params.muted, vibrate: !params.muted };
  if (params.muted) return { animate: false, sound: false, vibrate: false };
  return { animate: !params.reducedMotion, sound: true, vibrate: true };
}

const winkWho = (mine: boolean, author?: string) => (mine ? 'Mandaste un guiño' : author ? `${author} te mandó un guiño` : 'Te mandaron un guiño');

/** The line that stays in the chat for a wink. */
export function funNoticeText(params: { kind: 'guino'; wink?: string; mine: boolean; author?: string }): string {
  const name = winkById(params.wink)?.name;
  const who = winkWho(params.mine, params.author);
  return name ? `${who} · ${name}` : who;
}

/** The wink's card in the chat, next to its thumbnail (José, 21/10): who on top; which wink and when below. */
export function winkCardLines(params: { wink?: string; mine: boolean; author?: string; time?: string }): { who: string; detail: string } {
  const detail = [winkById(params.wink)?.name, params.time].filter(Boolean).join(' · ');
  return { who: winkWho(params.mine, params.author), detail };
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
