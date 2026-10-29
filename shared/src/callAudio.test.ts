import { describe, expect, it } from 'vitest';
import { callAudioConstraints, nativeCallAudioConstraints, readNoisePreference, writeNoisePreference } from './callAudio.js';

describe('the microphone of a call (c-03: Cancelación de ruido)', () => {
  it('keeps the echo cancellation always and moves noise and gain with the switch', () => {
    expect(callAudioConstraints(true)).toEqual({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    expect(callAudioConstraints(false)).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: false });
  });

  it('on the phone it uses the names libwebrtc reads, with the echo cancellation always on', () => {
    expect(nativeCallAudioConstraints(false)).toEqual({ googEchoCancellation: true, googNoiseSuppression: false, googAutoGainControl: false, googHighpassFilter: false });
    expect(nativeCallAudioConstraints(true).googNoiseSuppression).toBe(true);
  });

  it('starts on, and only an explicit «off» turns it off', () => {
    expect(readNoisePreference(null)).toBe(true);
    expect(readNoisePreference('basura')).toBe(true);
    expect(readNoisePreference(writeNoisePreference(false))).toBe(false);
    expect(readNoisePreference(writeNoisePreference(true))).toBe(true);
  });
});
