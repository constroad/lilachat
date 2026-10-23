import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { SharedLocation } from '@lilachat/shared';

/** How long the phone gets to find a fresh fix before the last known one is used (ms). */
const FIX_TIMEOUT_MS = 12_000;

export type CurrentLocation = { state: 'locating' } | { state: 'denied' } | { state: 'error' } | { state: 'ready'; location: SharedLocation };

const toShared = (position: Location.LocationObject): SharedLocation => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  ...(position.coords.accuracy !== null ? { accuracy: position.coords.accuracy } : {}),
});

async function freshFix(): Promise<Location.LocationObject | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
  const fix = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
  return Promise.race([fix, timeout]);
}

/**
 * Where the phone is, asked only while the share sheet is open (pending 11):
 * the «while in use» permission, a fresh fix and, if it takes too long, the
 * last known one. Nothing runs in the background.
 */
export function useCurrentLocation(active: boolean): { current: CurrentLocation; retry: () => void } {
  const [current, setCurrent] = useState<CurrentLocation>({ state: 'locating' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setCurrent({ state: 'locating' });
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (!alive) return;
      if (permission?.status !== 'granted') return setCurrent({ state: 'denied' });
      const position = (await freshFix()) ?? (await Location.getLastKnownPositionAsync().catch(() => null));
      if (alive) setCurrent(position ? { state: 'ready', location: toShared(position) } : { state: 'error' });
    })();
    return () => {
      alive = false;
    };
  }, [active, attempt]);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { current, retry };
}
