import { useEffect, useRef, useState } from 'react';
import { startWalk, stopWalk, WALK_IDLE, walkFix, type WalkState } from '@lilachat/shared';

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
  return { walk, denied, start, stop, reset };
}
