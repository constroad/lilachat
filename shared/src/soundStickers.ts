/**
 * Animated stickers with sound (José 26/11, designs ss-01…ss-04), like the
 * ones WhatsApp started rolling out on 25/11: a video clip of up to 6 seconds
 * becomes a 512×512 animated WebP, and its sound travels next to it. In the
 * chat it arrives muted with a speaker button; a tap plays it three times.
 */
import type { WinkSound } from './winks.js';

/** The longest clip a sticker keeps, like the animated stickers made from a GIF. */
export const VIDEO_STICKER_MAX_MS = 6_000;
/** Shorter than this is a blink, not a sticker. */
export const VIDEO_STICKER_MIN_MS = 500;
/** A tap on the speaker plays the sound this many times in a row (WhatsApp does the same). */
export const STICKER_SOUND_PLAYS = 3;
/** A phone video can be heavy: the server cuts it, so the whole file goes up once. */
export const MAX_STICKER_VIDEO_BYTES = 60 * 1024 * 1024;
/** A recorded voice or an uploaded clip of a few seconds. */
export const MAX_STICKER_AUDIO_BYTES = 4 * 1024 * 1024;

export type StickerSoundPreset = { id: string; label: string; sound: WinkSound };

/** «Sonidos de Lilachat»: our own synthesized wink sounds, already served by the web and bundled in the app. */
export const STICKER_SOUND_PRESETS: readonly StickerSoundPreset[] = [
  { id: 'aplausos', label: 'Aplausos', sound: 'clap' },
  { id: 'ovacion', label: 'Ovación', sound: 'cheer' },
  { id: 'bocina', label: 'Bocina', sound: 'horn' },
  { id: 'risa', label: 'Risa', sound: 'laugh' },
  { id: 'silbido', label: 'Silbido', sound: 'whistle' },
  { id: 'corneta', label: 'Corneta', sound: 'partyhorn' },
  { id: 'alarma', label: 'Alarma', sound: 'alarm' },
  { id: 'golpe', label: 'Golpe', sound: 'crash' },
];

/** Where a preset's file is served (the web's `public/sonidos`), or null for an unknown one. */
export function soundPresetPath(presetId: string): string | null {
  const preset = STICKER_SOUND_PRESETS.find((candidate) => candidate.id === presetId);
  return preset ? `/sonidos/wink-${preset.sound}.mp3` : null;
}

/** What the sticker sounds like: the video's own sound, a recorded or uploaded file, one of ours, or nothing. */
export type StickerSound = { kind: 'original' } | { kind: 'file' } | { kind: 'none' } | { kind: 'preset'; presetId: string };

const PRESET_PREFIX = 'preset:';

/** The form field `sound` → a sound choice, or null when it is not one. */
export function parseStickerSound(raw: unknown): StickerSound | null {
  if (raw === 'original' || raw === 'file' || raw === 'none') return { kind: raw };
  if (typeof raw !== 'string' || !raw.startsWith(PRESET_PREFIX)) return null;
  const presetId = raw.slice(PRESET_PREFIX.length);
  return soundPresetPath(presetId) ? { kind: 'preset', presetId } : null;
}

/** The form value of a sound choice (the inverse of `parseStickerSound`). */
export function stickerSoundField(sound: StickerSound): string {
  return sound.kind === 'preset' ? `${PRESET_PREFIX}${sound.presetId}` : sound.kind;
}

export type ClipWindow = { startMs: number; durationMs: number };

const toMs = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

/** The part of the video the sticker keeps: from `start`, at most 6 s, at least half a second. */
export function clipWindowOf(start: unknown, end: unknown): ClipWindow | null {
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (startMs === null || endMs === null) return null;
  const from = Math.max(0, startMs);
  const durationMs = Math.min(endMs - from, VIDEO_STICKER_MAX_MS);
  return durationMs >= VIDEO_STICKER_MIN_MS ? { startMs: from, durationMs } : null;
}

/** A sticker (or its message's media) that carries a sound. */
export function stickerHasSound(media: { audioUrl?: string | null } | null | undefined): boolean {
  return typeof media?.audioUrl === 'string' && media.audioUrl.length > 0;
}

/** After `playsDone` plays of the sound, whether it plays once more. */
export function shouldReplaySound(playsDone: number): boolean {
  return playsDone < STICKER_SOUND_PLAYS;
}
