import type { AudioMode } from 'expo-audio';

/**
 * expo-audio pauses every player and recorder when the activity goes to the
 * background, and locking the screen counts (José, 20/10: «un audio se corta
 * cuando la pantalla se bloquea»). These modes ask it not to, as WhatsApp does.
 * The mode is global, so both paths set the background flags.
 */
export const playbackAudioMode = (): Partial<AudioMode> => ({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });

export const recordingAudioMode = (recording: boolean): Partial<AudioMode> => ({
  allowsRecording: recording,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  allowsBackgroundRecording: recording,
});
