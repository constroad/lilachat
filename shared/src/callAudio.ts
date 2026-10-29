/**
 * The microphone of a call (design c-03, pending 3 of 29/10): «Cancelación de
 * ruido» on lowers the noise of the site and the traffic. Echo cancellation
 * stays on always (without it the other side hears itself); noise suppression
 * and automatic gain go together with the switch. PURE.
 */
export const NOISE_SUPPRESSION_DEFAULT = true;

export type CallAudioConstraints = { echoCancellation: true; noiseSuppression: boolean; autoGainControl: boolean };

export function callAudioConstraints(noiseSuppression: boolean): CallAudioConstraints {
  return { echoCancellation: true, noiseSuppression, autoGainControl: noiseSuppression };
}

/**
 * The same switch for the phone: react-native-webrtc passes each audio key as a
 * mandatory constraint to libwebrtc, which only reads its legacy names
 * (`googNoiseSuppression`…); the standard ones are ignored there.
 */
export type NativeCallAudioConstraints = { googEchoCancellation: true; googNoiseSuppression: boolean; googAutoGainControl: boolean; googHighpassFilter: boolean };

export function nativeCallAudioConstraints(noiseSuppression: boolean): NativeCallAudioConstraints {
  return { googEchoCancellation: true, googNoiseSuppression: noiseSuppression, googAutoGainControl: noiseSuppression, googHighpassFilter: noiseSuppression };
}

/** The stored preference: anything but an explicit «off» keeps it on. */
export const readNoisePreference = (stored: string | null | undefined): boolean => (stored === 'off' ? false : NOISE_SUPPRESSION_DEFAULT);
export const writeNoisePreference = (on: boolean): string => (on ? 'on' : 'off');
