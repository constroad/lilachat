import { clipHasOwnSound, isStickerClipMime, MAX_STICKER_AUDIO_BYTES, MAX_STICKER_VIDEO_BYTES, soundPresetIdOf, stickerHasSound, VIDEO_STICKER_MAX_MS, VIDEO_STICKER_MIN_MS, type StickerSound } from '@lilachat/shared';

/**
 * The decisions of «Crear sticker desde un video» (José 26/11, design ss-04):
 * which part of the video the sticker keeps and which files are accepted. A
 * GIF goes through the same modal, whole and without its own sound (design
 * sc-01a). The modal only draws them.
 */
export type TrimWindow = { startMs: number; endMs: number };

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The first window of a video: its first 6 seconds (or all of it); null when it cannot make a sticker. */
export function initialTrim(videoMs: number): TrimWindow | null {
  if (!Number.isFinite(videoMs) || videoMs < VIDEO_STICKER_MIN_MS) return null;
  return { startMs: 0, endMs: Math.min(videoMs, VIDEO_STICKER_MAX_MS) };
}

/** A point of the strip (0 = left, 1 = right) as a moment of the video. */
export function msAtStrip(ratio: number, videoMs: number): number {
  return Math.round(clamp(ratio, 0, 1) * videoMs);
}

export const trimLengthMs = (trim: TrimWindow) => trim.endMs - trim.startMs;

/** Dragging the whole window: same length, inside the video. */
export function moveTrim(trim: TrimWindow, toStartMs: number, videoMs: number): TrimWindow {
  const length = trimLengthMs(trim);
  const startMs = clamp(toStartMs, 0, Math.max(0, videoMs - length));
  return { startMs, endMs: startMs + length };
}

/** Dragging the left handle: the window stays between half a second and 6 s. */
export function resizeTrimStart(trim: TrimWindow, toMs: number, videoMs: number): TrimWindow {
  const earliest = Math.max(0, trim.endMs - VIDEO_STICKER_MAX_MS);
  const latest = Math.min(videoMs, trim.endMs - VIDEO_STICKER_MIN_MS);
  return { startMs: clamp(toMs, earliest, latest), endMs: trim.endMs };
}

/** Dragging the right handle: the same limits, and never past the end of the video. */
export function resizeTrimEnd(trim: TrimWindow, toMs: number, videoMs: number): TrimWindow {
  const earliest = trim.startMs + VIDEO_STICKER_MIN_MS;
  const latest = Math.min(videoMs, trim.startMs + VIDEO_STICKER_MAX_MS);
  return { startMs: trim.startMs, endMs: clamp(toMs, earliest, latest) };
}

/** «0:12», like the strip of the design. */
export function clipTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** «6.0»: how long the sticker lasts. */
export const clipSeconds = (ms: number) => (Math.round(ms / 100) / 10).toFixed(1);

/** The moments labeled along the strip, first and last included. */
export function stripTicks(videoMs: number, count: number): number[] {
  if (!(videoMs > 0) || count < 2) return [];
  return Array.from({ length: count }, (_, index) => Math.round((videoMs * index) / (count - 1)));
}

const CLIP_TYPES: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp', mkv: 'video/x-matroska', gif: 'image/gif' };
const AUDIO_TYPES: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const ACCEPTED_AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']);

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** The type the server reads, guessed from the name when the browser left it empty. */
function mediaTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = extensionOf(file.name);
  return CLIP_TYPES[extension] ?? AUDIO_TYPES[extension] ?? '';
}

/** The same file with a media type (some browsers leave .m4a or .mov without one). */
export function withMediaType(file: File): File {
  const type = mediaTypeOf(file);
  return type === file.type ? file : new File([file], file.name, { type });
}

/** Why this clip (a video or a GIF) cannot be used, or null when it can. */
export function clipFileProblem(file: File): string | null {
  if (!isStickerClipMime(mediaTypeOf(file))) return 'Elige un video o un GIF.';
  return file.size > MAX_STICKER_VIDEO_BYTES ? 'Ese archivo pesa demasiado (máximo 60 MB).' : null;
}

/** A GIF has no sound of its own and no trim (a `<video>` cannot play it). */
export const clipIsGif = (file: File) => !clipHasOwnSound(mediaTypeOf(file));

/** A GIF goes whole from its start; the server clamps the end to the GIF's length. */
export const GIF_TRIM: TrimWindow = { startMs: 0, endMs: VIDEO_STICKER_MAX_MS };

/** Which editor a file chosen under «Crear» opens: the clip one (video or GIF), the photo one, or none. */
export type StickerSource = 'clip' | 'photo';

export function stickerSourceOf(file: File): StickerSource | null {
  const type = mediaTypeOf(file);
  if (isStickerClipMime(type)) return 'clip';
  return type.startsWith('image/') ? 'photo' : null;
}

/** «Subir un audio»: MP3, M4A or WAV of up to 4 MB. */
export function audioFileProblem(file: File): string | null {
  if (!ACCEPTED_AUDIO_MIMES.has(mediaTypeOf(file))) return 'Elige un audio MP3, M4A o WAV.';
  return file.size > MAX_STICKER_AUDIO_BYTES ? 'Ese audio pesa demasiado (máximo 4 MB).' : null;
}

/** What the person picked under «Sonido del sticker»: voice and upload both travel as a file. */
export type SoundPick = { kind: 'original' } | { kind: 'none' } | { kind: 'preset'; presetId: string } | { kind: 'voice' } | { kind: 'upload' };
export type SoundRequest = { sound: StickerSound; audio: Blob | null };

/** What the sound choice means for this clip: without a sound of its own, «Sonido original» is «Sin sonido». */
export function soundPickForClip(pick: SoundPick, hasOwnSound: boolean): SoundPick {
  return !hasOwnSound && pick.kind === 'original' ? { kind: 'none' } : pick;
}

/** The sound part of the request, or what is still missing. */
export function soundRequestOf(pick: SoundPick, voice: Blob | null, upload: File | null): SoundRequest | { problem: string } {
  if (pick.kind === 'voice') return voice ? { sound: { kind: 'file' }, audio: voice } : { problem: 'Graba tu voz primero, o elige otro sonido.' };
  if (pick.kind === 'upload') return upload ? { sound: { kind: 'file' }, audio: upload } : { problem: 'Elige un audio, o elige otro sonido.' };
  return { sound: pick, audio: null };
}

/** A saved sticker starts on its own preset; with no sound, or one the person recorded, nothing is chosen yet (José 27/11). */
export function initialSavedSoundPick(sticker: { audioUrl?: string | null }): SoundPick | null {
  const presetId = soundPresetIdOf(sticker.audioUrl);
  return presetId ? { kind: 'preset', presetId } : null;
}

/** The new sound of a saved sticker: it has no video, so «original» never goes; nothing chosen asks for a choice. */
export function savedSoundRequestOf(pick: SoundPick | null, voice: Blob | null, upload: File | null): SoundRequest | { problem: string } {
  if (!pick || pick.kind === 'original') return { problem: 'Elige el sonido del sticker.' };
  return soundRequestOf(pick, voice, upload);
}

/** «Sonido original» of a silent video: the server saves it without sound, and the person is told. */
export function lostItsSound(sound: StickerSound, sticker: { audioUrl?: string | null }): boolean {
  return sound.kind === 'original' && !stickerHasSound(sticker);
}

/** Held this long, the mic button is «hold to talk»; a shorter tap starts it and the next tap stops it. */
export const HOLD_TO_RECORD_MS = 350;

export const releaseStopsRecording = (heldMs: number) => heldMs >= HOLD_TO_RECORD_MS;
