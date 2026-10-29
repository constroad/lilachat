import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaDevices, type MediaStream, type RTCPeerConnection } from 'react-native-webrtc';
import type { MediaTrackConstraints } from 'react-native-webrtc/lib/typescript/Constraints';
import { nativeCallAudioConstraints, NOISE_SUPPRESSION_DEFAULT, readNoisePreference, writeNoisePreference } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';

const STORAGE_KEY = 'lilachat.llamada.cancelacionDeRuido';

/** react-native-webrtc types only the video keys; the audio ones go through as libwebrtc constraints all the same. */
const audioFor = (noiseSuppression: boolean) => nativeCallAudioConstraints(noiseSuppression) as unknown as MediaTrackConstraints;

/**
 * «Cancelación de ruido» of a call (design c-03): on by default and remembered.
 * Switching it during a call opens the microphone again with the new filters
 * and swaps the track the other side hears, keeping the mute as it was.
 */
export function useNoiseSuppression() {
  const [on, setOn] = useState(NOISE_SUPPRESSION_DEFAULT);
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => setOn(readNoisePreference(stored))).catch(() => undefined);
  }, []);
  const constraints = useCallback(() => audioFor(onRef.current), []);
  const set = useCallback(async (next: boolean, call: { pc: RTCPeerConnection | null; stream: MediaStream | null; muted: boolean }) => {
    setOn(next);
    void AsyncStorage.setItem(STORAGE_KEY, writeNoisePreference(next)).catch(() => undefined);
    if (call.pc && call.stream) await swapMicrophone({ pc: call.pc, stream: call.stream, noiseSuppression: next, muted: call.muted }).catch((error) => reportarError('call.ruido', error));
  }, []);
  return { on, constraints, set };
}

async function swapMicrophone(params: { pc: RTCPeerConnection; stream: MediaStream; noiseSuppression: boolean; muted: boolean }): Promise<void> {
  const fresh = await mediaDevices.getUserMedia({ audio: audioFor(params.noiseSuppression), video: false });
  const track = fresh.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !params.muted;
  const sender = params.pc.getSenders().find((one) => one.track?.kind === 'audio');
  await sender?.replaceTrack(track);
  params.stream.getAudioTracks().forEach((old) => {
    params.stream.removeTrack(old);
    old.stop();
  });
  params.stream.addTrack(track);
}
