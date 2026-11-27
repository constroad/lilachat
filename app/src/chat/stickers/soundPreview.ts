import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { reportarError } from '../../ui/reportarError';
import { playWinkSound, stopWinkSounds } from '../winkSounds';
import { STICKER_SOUND_PRESETS } from '@lilachat/shared';

/**
 * Listening to a sound before it goes into a sticker (design ss-02): a voice
 * just recorded, an audio of the phone, or one of ours. One at a time, and its
 * player is released when it ends (players kept alive made the app slow, 21/10).
 */
let previewing: AudioPlayer | null = null;

export function stopSoundPreview(): void {
  stopWinkSounds();
  const player = previewing;
  previewing = null;
  if (!player) return;
  try {
    player.pause();
    player.release();
  } catch (error) {
    reportarError('stopSoundPreview', error);
  }
}

/** A local file, played once. Never throws. */
export function previewClip(uri: string): void {
  stopSoundPreview();
  try {
    const player = createAudioPlayer({ uri });
    previewing = player;
    const finishing = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      finishing.remove();
      if (previewing === player) stopSoundPreview();
    });
    player.play();
  } catch (error) {
    reportarError('previewClip', error);
  }
}

/** One of «Sonidos de Lilachat»: the wink sound already in the app. */
export function previewPreset(presetId: string): void {
  stopSoundPreview();
  const preset = STICKER_SOUND_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset) playWinkSound(preset.sound);
}
