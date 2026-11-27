/**
 * Animated stickers with sound (José 26/11, designs ss-01…ss-04), like the
 * ones WhatsApp started rolling out on 25/11: a video clip of up to 6 seconds
 * becomes a 512×512 animated WebP, and its sound travels next to it. In the
 * chat it arrives muted with a speaker button; a tap plays it three times.
 */
import type { WinkSound } from './winks.js';
import { stickerVoiceOf, type StickerVoiceId } from './stickerVoice.js';

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
export type StickerSound = { kind: 'original' } | { kind: 'file' } | { kind: 'none' } | { kind: 'preset'; presetId: string } | { kind: 'voice'; voiceId: StickerVoiceId };

const PRESET_PREFIX = 'preset:';
/** A phrase spoken by one of the sticker voices; the phrase travels in its own field (`voiceText`). */
const VOICE_PREFIX = 'voice:';

/** The form field `sound` → a sound choice, or null when it is not one. */
export function parseStickerSound(raw: unknown): StickerSound | null {
  if (raw === 'original' || raw === 'file' || raw === 'none') return { kind: raw };
  if (typeof raw === 'string' && raw.startsWith(VOICE_PREFIX)) {
    const voice = stickerVoiceOf(raw.slice(VOICE_PREFIX.length));
    return voice ? { kind: 'voice', voiceId: voice.id } : null;
  }
  if (typeof raw !== 'string' || !raw.startsWith(PRESET_PREFIX)) return null;
  const presetId = raw.slice(PRESET_PREFIX.length);
  return soundPresetPath(presetId) ? { kind: 'preset', presetId } : null;
}

/** The form value of a sound choice (the inverse of `parseStickerSound`). */
export function stickerSoundField(sound: StickerSound): string {
  if (sound.kind === 'preset') return `${PRESET_PREFIX}${sound.presetId}`;
  return sound.kind === 'voice' ? `${VOICE_PREFIX}${sound.voiceId}` : sound.kind;
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

/** What a sound sticker is cut from: a video, or a GIF (José 26/11: «¿por qué no desde un GIF con audio?»). */
export function isStickerClipMime(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && (mime.startsWith('video/') || mime === 'image/gif');
}

/** A GIF has no sound of its own: «Sonido original» is offered only for a video. */
export function clipHasOwnSound(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && mime.startsWith('video/');
}

/** A sticker (or its message's media) that carries a sound. */
export function stickerHasSound(media: { audioUrl?: string | null } | null | undefined): boolean {
  return typeof media?.audioUrl === 'string' && media.audioUrl.length > 0;
}

/** After `playsDone` plays of the sound, whether it plays once more. */
export function shouldReplaySound(playsDone: number): boolean {
  return playsDone < STICKER_SOUND_PLAYS;
}

/** What a saved sticker can be exported as (José 27/11, design sa-05): the video with its sound, and the picture. */
export function stickerExportOf(sticker: { mime: string; animated?: boolean; audioUrl?: string | null }): { video: boolean; picture: boolean } {
  const picture = sticker.mime.startsWith('image/');
  // WhatsApp takes no sound from outside: its own «Crear sticker» makes one from a video, so a moving or sounding one goes as video.
  return { video: picture && (Boolean(sticker.animated) || stickerHasSound(sticker)), picture };
}

const presetOfUrl = (audioUrl: string | null | undefined) =>
  audioUrl ? STICKER_SOUND_PRESETS.find((one) => audioUrl.endsWith(`/sonidos/wink-${one.sound}.mp3`)) ?? null : null;

/** The preset behind a sound's address («bocina»), or null for one the person recorded or uploaded. */
export function soundPresetIdOf(audioUrl: string | null | undefined): string | null {
  return presetOfUrl(audioUrl)?.id ?? null;
}

/** «Risa» for one of ours, «Voz de Valeria» for a voice, «Sonido propio» for a recorded or uploaded one, or null. */
export function stickerSoundLabelOf(sticker: { audioUrl?: string | null; soundVoiceId?: string | null }): string | null {
  if (!stickerHasSound(sticker)) return null;
  const voice = sticker.soundVoiceId ? stickerVoiceOf(sticker.soundVoiceId) : null;
  return presetOfUrl(sticker.audioUrl)?.label ?? (voice ? `Voz de ${voice.label}` : 'Sonido propio');
}

export type StickerOptions = { sound: 'Agregar sonido' | 'Cambiar sonido'; canRemoveSound: boolean; soundLine: string; canExport: boolean; favorite: 'Agregar a Favoritos' | 'Quitar de Favoritos'; canRemove: boolean };

/**
 * The options of a saved sticker (José 27/11, designs sa-01…sa-03): its sound first («ya tengo un sticker en mis
 * favoritos, quiero agregarle audio»), export, favorites, and removing one of mine.
 */
export function stickerOptionsOf(sticker: { id: string; mime: string; animated?: boolean; audioUrl?: string | null; soundVoiceId?: string | null; favorite: boolean }): StickerOptions {
  const sound = stickerSoundLabelOf(sticker);
  const kind = sticker.animated ? 'Animado' : '';
  const soundLine = sound ? [kind, `con sonido · ${sound}`].filter(Boolean).join(' · ') : kind ? `${kind} · sin sonido` : 'Sin sonido';
  const exportable = stickerExportOf(sticker);
  return {
    sound: sound ? 'Cambiar sonido' : 'Agregar sonido',
    canRemoveSound: Boolean(sound),
    soundLine,
    canExport: exportable.video || exportable.picture,
    favorite: sticker.favorite ? 'Quitar de Favoritos' : 'Agregar a Favoritos',
    canRemove: !sticker.id.startsWith('pack:'),
  };
}
