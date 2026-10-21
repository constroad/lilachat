import { describe, expect, it } from 'vitest';
import { playbackAudioMode, recordingAudioMode } from './audioMode';

/** José, 20/10: «un audio se corta cuando la pantalla se bloquea». */
describe('audio modes for voice notes', () => {
  it('playback keeps going with the screen locked and pauses other apps', () => {
    expect(playbackAudioMode()).toEqual({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  });

  it('recording keeps going with the screen locked, and turning it off leaves playback in the background too', () => {
    expect(recordingAudioMode(true)).toEqual({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: true, allowsBackgroundRecording: true });
    expect(recordingAudioMode(false)).toEqual({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: true, allowsBackgroundRecording: false });
  });
});
