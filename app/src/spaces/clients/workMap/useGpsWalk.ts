import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { startWalk, stopWalk, WALK_IDLE, walkFix, type GpsFix, type WalkState } from '@lilachat/shared';

/** Metres the phone moves before it reports again: the engine still keeps one point every 5 m. */
const REPORT_EVERY_M = 2;

/**
 * «Caminar con GPS» (o-13) on the phone: the «while in use» permission is asked at «Empezar», and the
 * position is watched only until «Terminar». Nothing runs in the background.
 */
export function useGpsWalk() {
  const [walk, setWalk] = useState<WalkState>(WALK_IDLE);
  const [denied, setDenied] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const clear = () => {
    watch.current?.remove();
    watch.current = null;
  };
  useEffect(() => clear, []);
  const start = async () => {
    const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (permission?.status !== 'granted') return setDenied(true);
    setDenied(false);
    setWalk(startWalk);
    clear();
    watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: REPORT_EVERY_M }, (position) =>
      setWalk((before) => walkFix(before, { lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy ?? Number.POSITIVE_INFINITY })));
  };
  const stop = () => { clear(); setWalk(stopWalk); };
  const reset = () => { clear(); setWalk(WALK_IDLE); };
  return { walk, denied, start, stop, reset };
}

/** One position for «Mi GPS» (o-06); null when the person refused it or the phone has none. */
export async function readGpsOnce(): Promise<GpsFix | null> {
  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (permission?.status !== 'granted') return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }).catch(() => null);
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy ?? Number.POSITIVE_INFINITY } : null;
}
