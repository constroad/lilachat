import { useEffect, useRef, useState } from 'react';
import { pauseWalk, resumeWalk, startWalk, stopWalk, undoWalkStep, WALK_IDLE, walkFix, type GpsFix, type WalkState } from '@lilachat/shared';

/** A first fix outdoors takes a few seconds; past this the person uses ±10 m. */
const GPS_ONCE_TIMEOUT_MS = 15_000;

/** «Caminar con GPS» (o-13) in the browser: the position is watched only between «Empezar» and «Terminar». */
export function useGpsWalk() {
  const [walk, setWalk] = useState<WalkState>(WALK_IDLE);
  const [denied, setDenied] = useState(false);
  const watch = useRef<number | null>(null);
  const clear = () => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  };
  useEffect(() => clear, []);
  const start = () => {
    if (!navigator.geolocation) return setDenied(true);
    setDenied(false);
    setWalk(startWalk);
    watch.current = navigator.geolocation.watchPosition(
      (position) => setWalk((before) => walkFix(before, { lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy })),
      (failure) => {
        console.warn('gps walk: position refused', failure.code);
        if (failure.code === failure.PERMISSION_DENIED) setDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  };
  const stop = () => { clear(); setWalk(stopWalk); };
  const reset = () => { clear(); setWalk(WALK_IDLE); };
  /** «Pausa» keeps watching, so «mi posición» still moves; only the line stops (o-13). */
  const pause = () => setWalk(pauseWalk);
  const resume = () => setWalk(resumeWalk);
  const undo = () => setWalk(undoWalkStep);
  return { walk, denied, start, stop, reset, pause, resume, undo };
}

/** One position for «Mi GPS» (o-06); null when the browser has none or the person refused it. */
export const readGpsOnce = (): Promise<GpsFix | null> => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy }),
    (failure) => { console.warn('gps once: position refused', failure.code); resolve(null); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_ONCE_TIMEOUT_MS },
  );
});
