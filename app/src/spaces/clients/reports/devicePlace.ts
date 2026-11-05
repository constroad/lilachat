import type { DevicePlace } from '@lilachat/shared';
import { freshPoint } from '../../../chat/location/freshPoint';

/** Where and when a report's photo is taken: a fresh fix when the phone gives one, the hour always (Portal stamps it). */
export async function devicePlaceNow(): Promise<DevicePlace> {
  const point = await freshPoint();
  const at = new Date().toISOString();
  return point ? { lat: point.lat, lng: point.lng, at } : { at };
}
