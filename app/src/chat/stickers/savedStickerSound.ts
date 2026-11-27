import { soundPresetIdOf, stickerSoundField } from '@lilachat/shared';
import { audioClipOf, stickerSoundOf, type SoundChoice } from './videoStickerSound';
import type { SavedSoundUpload } from './stickersApi';

/**
 * The sound of a sticker already in «Mis stickers» on the APK (José 27/11: «quiero agregarle audio sin volver a buscar
 * el GIF», designs sa-01/sa-02). Pure: the sheet draws, the panel sends what these build.
 */

/** It opens on its own preset; without one (none, or a voice or audio of the person) nothing is chosen yet. */
export function initialSavedChoice(sticker: { audioUrl?: string | null }): SoundChoice | null {
  const presetId = soundPresetIdOf(sticker.audioUrl);
  return presetId ? { kind: 'preset', presetId } : null;
}

const sameChoice = (a: SoundChoice | null, b: SoundChoice | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** «Listo» saves only what changed, and only a complete choice («original» never: a saved sticker has no video). */
export function savedSoundUploadOf(initial: SoundChoice | null, choice: SoundChoice | null): SavedSoundUpload | null {
  if (!choice || choice.kind === 'original' || sameChoice(initial, choice)) return null;
  const sound = stickerSoundOf(choice);
  return sound ? { audio: audioClipOf(choice), fields: [['sound', stickerSoundField(sound)]] } : null;
}
