import { useEffect, useState, type RefObject } from 'react';
import { Camera, type CameraView } from 'expo-camera';
import { reportarError } from '../../ui/reportarError';
import { MAX_VIDEO_SECONDS } from './videoClock';

const TICK_MS = 1000;
export type RecordedVideo = { uri: string; startedAt: string };

/**
 * The camera's recording (José 12/11, design cam-05): starts, counts the time and stops by itself
 * at its ceiling (three minutes in the chat, less where a ticket says so). With «Sonido» on it asks for the microphone first; refused, it records mute.
 */
export function useVideoRecording(camera: RefObject<CameraView | null>, sound: boolean, maxSeconds = MAX_VIDEO_SECONDS) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  const start = async (): Promise<RecordedVideo | null> => {
    if (!camera.current || startedAt !== null) return null;
    if (sound) await Camera.requestMicrophonePermissionsAsync().catch(() => null);
    const began = Date.now();
    setStartedAt(began);
    setNow(began);
    try {
      const video = await camera.current.recordAsync({ maxDuration: maxSeconds });
      return video?.uri ? { uri: video.uri, startedAt: new Date(began).toISOString() } : null;
    } catch (error) {
      reportarError('useVideoRecording.start', error);
      return null;
    } finally {
      setStartedAt(null);
    }
  };
  const stop = () => camera.current?.stopRecording();
  return { recording: startedAt !== null, elapsedMs: startedAt === null ? 0 : now - startedAt, start, stop };
}
