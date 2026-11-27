import { useSyncExternalStore } from 'react';
import { STICKER_SOUND_PRESETS } from '@lilachat/shared';
import { reportarError } from '../../ui/reportarError';
import { playWinkSound, stopWinkSounds } from '../winkSounds';
import { createExpoLoopPlayer } from './expoLoopPlayer';
import { createStickerSoundController } from './stickerSoundController';

/**
 * Listening to a sound before it goes into a sticker (design ss-02): a voice
 * just recorded, an audio of the phone, or one of ours. One at a time, played
 * once, and its player is released when it ends (players kept alive made the
 * app slow, 21/10). The buttons read `useClipPreviewPlaying` to show it is
 * sounding (José 27/11: «ni siquiera puedo saber si está haciendo play»).
 */
const clips = createStickerSoundController(createExpoLoopPlayer, reportarError, { replay: () => false });

export function stopSoundPreview(): void {
  stopWinkSounds();
  clips.stop();
}

/** A local file, played once from its start. Never throws. */
export function previewClip(uri: string): void {
  stopWinkSounds();
  clips.play(uri, uri);
}

/** The listen button's tap: plays the file, or stops it when it is already sounding. */
export function toggleClipPreview(uri: string): void {
  stopWinkSounds();
  clips.toggle(uri, uri);
}

/** Whether this file is sounding right now; false for null. */
export function useClipPreviewPlaying(uri: string | null): boolean {
  return useSyncExternalStore(clips.subscribe, () => uri !== null && clips.playingId() === uri);
}

/** One of «Sonidos de Lilachat»: the wink sound already in the app. */
export function previewPreset(presetId: string): void {
  stopSoundPreview();
  const preset = STICKER_SOUND_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset) playWinkSound(preset.sound);
}
