import { easeShare } from './winkTimeline.js';
import type { Dance, WinkDance, WinkPart } from './winkDances.js';
import type { WinkArtId } from './winkArt.js';

/**
 * Animated stickers (backlog 31, José 21/10): the wink characters doing their
 * dances, in a short loop. A dance already starts and ends at rest, so each
 * sticker is a character plus a dance, rendered to an animated 512×512 WebP
 * by `web/scripts/render-animated-stickers.mts` (frames from `danceAt`). The
 * app and the web show them as any other sticker: an image that moves.
 */
export type AnimatedSticker = { slug: string; label: string; character: WinkArtId; dance: WinkDance };

export const ANIMATED_PACK_ID = 'lila-mov';
/** Frames per second of the files: «on twos», like hand-drawn animation: light on the phone. */
export const ANIMATED_STICKER_FPS = 12;

export const ANIMATED_STICKERS: AnimatedSticker[] = [
  { slug: 'worker-hello', label: '¡Hola!', character: 'worker', dance: 'wave' },
  { slug: 'piggy-disco', label: '¡A bailar!', character: 'piggy', dance: 'disco' },
  { slug: 'bear-clap', label: 'Aplausos', character: 'bear', dance: 'clap' },
  { slug: 'puppy-ready', label: '¡Listo!', character: 'puppy', dance: 'jump' },
  { slug: 'panda-hug', label: 'Un abrazo', character: 'panda', dance: 'hug' },
  { slug: 'kitty-laugh', label: 'Jajaja', character: 'kitty', dance: 'laugh' },
  { slug: 'brick-strong', label: '¡Fuerza!', character: 'brick', dance: 'flex' },
  { slug: 'cuppa-morning', label: '¡Buenos días!', character: 'cuppa', dance: 'cumbia' },
  { slug: 'excavator-work', label: '¡A trabajar!', character: 'excavator', dance: 'flex' },
  { slug: 'cone-go', label: '¡Vamos!', character: 'cone', dance: 'jump' },
  { slug: 'dumptruck-coming', label: 'En camino', character: 'dumptruck', dance: 'cumbia' },
  { slug: 'paver-tired', label: 'Cansado', character: 'paver', dance: 'tired' },
  { slug: 'sweetheart-love', label: 'Te quiero', character: 'sweetheart', dance: 'hug' },
  { slug: 'flagger-here', label: 'Por aquí', character: 'flagger', dance: 'wave' },
  { slug: 'roller-rock', label: '¡Con todo!', character: 'roller', dance: 'rock' },
];

/** One motion of a dance at a share (0–1) of its loop: evenly spaced steps, eased in between. */
function stepValue(values: readonly number[] | undefined, share: number): number {
  if (!values || values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  const position = Math.min(Math.max(share, 0), 1) * (values.length - 1);
  const index = Math.min(Math.floor(position), values.length - 2);
  const from = values[index]!;
  const to = values[index + 1]!;
  return from + (to - from) * easeShare('smooth', position - index);
}

/** The pose of a dance at a share of its loop: the whole body's shift and turn, and each part's turn (degrees). */
export function danceAt(dance: Dance, share: number): { whole: { x: number; y: number; rotate: number }; parts: Partial<Record<WinkPart, number>> } {
  const parts: Partial<Record<WinkPart, number>> = {};
  for (const [part, motion] of Object.entries(dance.parts) as [WinkPart, { rotate?: readonly number[] }][]) {
    if (motion.rotate) parts[part] = stepValue(motion.rotate, share);
  }
  return { whole: { x: stepValue(dance.whole?.x, share), y: stepValue(dance.whole?.y, share), rotate: stepValue(dance.whole?.rotate, share) }, parts };
}

/** The moments (0–1) of each frame of one loop; the end is the start again, so it is not repeated. */
export function animatedStickerFrames(loopMs: number): number[] {
  const count = Math.max(2, Math.round((loopMs / 1000) * ANIMATED_STICKER_FPS));
  return Array.from({ length: count }, (_, index) => index / count);
}

/** Like WhatsApp, an animated sticker in the chat plays for a while and stops; a tap plays it again. */
export const ANIMATED_STICKER_PLAY_MS = 8000;

/** Whether a sticker's file is of the animated pack (the chat stops it after a while). */
export function isAnimatedSticker(url: string | null | undefined): boolean {
  return Boolean(url) && url!.includes(`/stickers/${ANIMATED_PACK_ID}/`);
}

/** The animated pack's, or one of my own made from a GIF (pending 37: its media says `animated`). */
export function stickerIsAnimated(media: { url?: string | null; animated?: boolean } | null | undefined): boolean {
  return media?.animated === true || isAnimatedSticker(media?.url);
}
