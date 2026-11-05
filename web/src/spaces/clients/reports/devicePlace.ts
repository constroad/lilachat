import type { DevicePlace } from '@lilachat/shared';

/** How long the browser gets to find the position before the photo goes with the hour alone (ms). */
const FIX_TIMEOUT_MS = 8_000;

/** Where and when a report's photo is taken: the browser's position when it gives one, the hour always (Portal stamps it). */
export function devicePlaceNow(): Promise<DevicePlace> {
  const at = new Date().toISOString();
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({ at });
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, at }),
      () => resolve({ at }),
      { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}
