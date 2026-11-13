import { useEffect, useRef, useState } from 'react';
import { geoPointOf, timemarkOf, type GeoPoint, type Timemark } from '@lilachat/shared';
import { readFieldConditions } from '../commands/commandsApi';
import { reportSessionJwt } from '../../spaces/clients/reports/reportQueueStore';
import { recorderTypeOf } from './shotStamp';

const TICK_MS = 1000;
const GPS_TIMEOUT_MS = 15_000;
const PHOTO_QUALITY = 0.92;
const IDEAL_WIDTH = 1920;
const IDEAL_HEIGHT = 1080;

export type CameraMode = 'picture' | 'video';
export type StreamState = 'asking' | 'live' | 'denied';

/** The back camera live, with the microphone only to record a video; it stops when the camera closes. */
export function useCameraStream(mode: CameraMode, facing: 'environment' | 'user') {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<StreamState>('asking');
  useEffect(() => {
    let opened: MediaStream | null = null;
    let alive = true;
    const constraints = { video: { facingMode: facing, width: { ideal: IDEAL_WIDTH }, height: { ideal: IDEAL_HEIGHT } }, audio: mode === 'video' };
    navigator.mediaDevices.getUserMedia(constraints).then((media) => {
      if (!alive) return media.getTracks().forEach((track) => track.stop());
      opened = media;
      if (video.current) video.current.srcObject = media;
      setStream(media);
      setState('live');
    }).catch(() => alive && setState('denied'));
    return () => {
      alive = false;
      opened?.getTracks().forEach((track) => track.stop());
    };
  }, [mode, facing]);
  return { video, stream, state };
}

/** The stamp the camera shows while it is open: the hour every second, the GPS once, its street when the server knows it. */
export function useWebLiveStamp(): { stamp: Timemark; point: GeoPoint | null } {
  const [now, setNow] = useState(() => new Date());
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    navigator.geolocation?.getCurrentPosition((position) => {
      if (!alive) return;
      const reading = geoPointOf(position.coords);
      setPoint(reading);
      const jwt = reportSessionJwt();
      if (jwt) void readFieldConditions(jwt, reading).then((conditions) => alive && conditions?.street && setPlace(conditions.street));
    }, () => undefined, { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 });
    return () => {
      alive = false;
    };
  }, []);
  return { stamp: timemarkOf({ at: now, point, place }), point };
}

/** The frame as it is, at the camera's full size: the server shrinks it once while it burns the stamp. */
export async function frameOf(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
}

/** Records the open stream and stops by itself at its ceiling. */
export function useWebRecorder(stream: MediaStream | null, maxSeconds: number) {
  const recorder = useRef<MediaRecorder | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - startedAt >= maxSeconds * TICK_MS) recorder.current?.stop();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt, maxSeconds]);
  const start = (): Promise<Blob | null> => {
    const type = recorderTypeOf((one) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(one));
    if (!stream || !type || recorder.current) return Promise.resolve(null);
    const chunks: Blob[] = [];
    const created = new MediaRecorder(stream, { mimeType: type });
    recorder.current = created;
    created.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const done = new Promise<Blob | null>((resolve) => {
      created.onstop = () => {
        recorder.current = null;
        setStartedAt(null);
        resolve(chunks.length ? new Blob(chunks, { type }) : null);
      };
    });
    created.start(TICK_MS);
    setStartedAt(Date.now());
    setNow(Date.now());
    return done;
  };
  const stop = () => recorder.current?.stop();
  return { recording: startedAt !== null, elapsedMs: startedAt === null ? 0 : now - startedAt, start, stop };
}
