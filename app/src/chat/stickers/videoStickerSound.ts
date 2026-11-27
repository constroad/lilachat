import { clipWindowOf, MAX_STICKER_AUDIO_BYTES, MAX_STICKER_VIDEO_BYTES, VIDEO_STICKER_MIN_MS, STICKER_SOUND_PRESETS, stickerHasSound, stickerSoundField, type StickerSound } from '@lilachat/shared';
import type { TrimWindow } from './videoStickerTrim';
import type { VideoStickerUpload } from './stickersApi';
import { clipMimeOf } from './stickerSource';
import { spokenBlocker, spokenFieldsOf, spokenSummary, type SpokenChoice } from './spokenVoice';

/**
 * The sound of a sticker made from a video (José 26/11, design ss-02): the
 * video's own, a voice recorded here, an audio of the phone, one of ours, or
 * none. Pure: the sheet draws the choice, the screen sends what these build.
 */
/** `ms`: how long it lasts, when it is known (a voice just recorded). */
export type AudioClip = { uri: string; name: string; mime: string; bytes: number; ms?: number };

export type SoundChoice =
  | { kind: 'original' }
  | { kind: 'voice'; clip: AudioClip | null }
  | { kind: 'upload'; clip: AudioClip | null }
  | { kind: 'preset'; presetId: string }
  | { kind: 'none' }
  | SpokenChoice;

export type PickedVideo = { uri: string; name: string; mime: string; bytes?: number };

/** What the server is told about the sound, or null while a voice or an audio is still missing. */
export function stickerSoundOf(choice: SoundChoice): StickerSound | null {
  if (choice.kind === 'voice' || choice.kind === 'upload') return choice.clip ? { kind: 'file' } : null;
  if (choice.kind === 'spoken') return spokenBlocker(choice) ? null : { kind: 'voice', voiceId: choice.voiceId };
  return choice;
}

/** The file that travels as the `audio` part, when the sound is one. */
export function audioClipOf(choice: SoundChoice): AudioClip | null {
  return choice.kind === 'voice' || choice.kind === 'upload' ? choice.clip : null;
}

const presetLabel = (presetId: string) => STICKER_SOUND_PRESETS.find((preset) => preset.id === presetId)?.label ?? 'Sonido de Lilachat';

/** The sound row of the create screen: what was chosen, in two lines. */
export function soundSummary(choice: SoundChoice): { title: string; detail: string } {
  switch (choice.kind) {
    case 'original':
      return { title: 'Sonido original', detail: 'Audio del video incluido en el sticker' };
    case 'voice':
      return { title: 'Tu voz', detail: choice.clip ? 'Grabada para este sticker' : 'Falta grabarla' };
    case 'upload':
      return { title: 'Audio del teléfono', detail: choice.clip ? choice.clip.name : 'Falta elegirlo' };
    case 'preset':
      return { title: presetLabel(choice.presetId), detail: 'Sonido de Lilachat' };
    case 'none':
      return { title: 'Sin sonido', detail: 'El sticker se mueve sin sonar' };
    case 'spoken':
      return spokenSummary(choice);
  }
}

const MEGABYTE = 1024 * 1024;

/** Why the sticker cannot be saved yet, in words for the person, or null when it can. */
export function videoStickerBlocker(input: { video: PickedVideo; trim: TrimWindow; choice: SoundChoice }): string | null {
  if ((input.video.bytes ?? 0) > MAX_STICKER_VIDEO_BYTES) return `Ese video pesa demasiado (máximo ${MAX_STICKER_VIDEO_BYTES / MEGABYTE} MB).`;
  if (!clipWindowOf(input.trim.startMs, input.trim.endMs)) return 'Elige un tramo de medio segundo a 6 segundos.';
  if (input.choice.kind === 'voice' && !input.choice.clip) return 'Graba tu voz o elige otro sonido.';
  if (input.choice.kind === 'upload' && !input.choice.clip) return 'Elige un audio del teléfono o elige otro sonido.';
  if (input.choice.kind === 'spoken') return spokenBlocker(input.choice);
  const clip = audioClipOf(input.choice);
  return clip && clip.bytes > MAX_STICKER_AUDIO_BYTES ? audioTooHeavy() : null;
}

const audioTooHeavy = () => `Ese audio pesa demasiado (máximo ${MAX_STICKER_AUDIO_BYTES / MEGABYTE} MB).`;

/** An audio picked from the phone: refused when it is not one or is too heavy. */
export function pickedAudioRefusal(asset: { mimeType?: string | null; size?: number | null }): string | null {
  if (!asset.mimeType?.startsWith('audio/')) return 'Elige un archivo de audio.';
  return (asset.size ?? 0) > MAX_STICKER_AUDIO_BYTES ? audioTooHeavy() : null;
}

/** The text fields of `POST /api/stickers/from-video`: the window and the sound. */
export function videoStickerFields(trim: TrimWindow, sound: StickerSound): [string, string][] {
  return [
    ['startMs', String(Math.round(trim.startMs))],
    ['endMs', String(Math.round(trim.endMs))],
    ['sound', stickerSoundField(sound)],
  ];
}

/** What to tell the person once it is saved: a video with no sound track gives a silent sticker. */
export function savedVideoStickerNotice(choice: SoundChoice, sticker: { audioUrl?: string | null }): string {
  if (choice.kind === 'original' && !stickerHasSound(sticker)) return 'El video no tenía sonido: el sticker quedó sin sonido.';
  return 'Sticker guardado en Mis stickers';
}

/** A video or a GIF from the gallery as the form sends it: the picker may not know its type or name. */
export function pickedVideoOf(asset: { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null }): PickedVideo {
  const mime = clipMimeOf(asset) ?? 'video/mp4';
  const fallbackName = mime === 'image/gif' ? 'sticker.gif' : 'sticker-video.mp4';
  return { uri: asset.uri, name: asset.fileName || fallbackName, mime, bytes: asset.fileSize ?? undefined };
}

/** The whole form of `POST /api/stickers/from-video`, or null while the sound is still missing. */
export function videoStickerUploadOf(input: { video: PickedVideo; trim: TrimWindow; choice: SoundChoice }): VideoStickerUpload | null {
  const sound = stickerSoundOf(input.choice);
  if (!sound) return null;
  return { video: input.video, audio: audioClipOf(input.choice), fields: [...videoStickerFields(input.trim, sound), ...spokenFieldsOf(input.choice)] };
}

/**
 * A gallery video that cannot become a sticker, in words for the person: too
 * heavy, or shorter than half a second. A length the picker does not know is
 * let through (the preview learns it).
 */
export function galleryVideoRefusal(asset: { fileSize?: number | null; duration?: number | null }): string | null {
  if ((asset.fileSize ?? 0) > MAX_STICKER_VIDEO_BYTES) return `Ese video pesa demasiado (máximo ${MAX_STICKER_VIDEO_BYTES / MEGABYTE} MB).`;
  if (typeof asset.duration === 'number' && asset.duration > 0 && asset.duration < VIDEO_STICKER_MIN_MS) return 'Ese video es muy corto: elige uno de medio segundo o más.';
  return null;
}
