import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { devicePlaceOf, timemarkOf, type GeoPoint, type Timemark } from '@lilachat/shared';
import { freshPoint } from '../location/freshPoint';
import { loadCredential } from '../../auth/credentialStore';
import { readFieldConditions } from '../commands/commandsApi';

/** The stamp's minute moves on screen; a tick more often than this would only cost renders. */
const TICK_MS = 10_000;

/** The phone's geocoder may hang without network; the server's lookup answers instead. */
const DEVICE_PLACE_TIMEOUT_MS = 4_000;

/** The phone geocoder's address (José 18/11: street, lot and postal code, like Timemark), or null. */
async function devicePlaceAt(point: GeoPoint): Promise<string | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DEVICE_PLACE_TIMEOUT_MS));
  const lookup = Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng })
    .then((found) => (found[0] ? devicePlaceOf(found[0]) : null))
    .catch(() => null);
  return Promise.race([lookup, timeout]);
}

/** The street the server's lookup gives, for a phone whose geocoder knows nothing there. */
async function serverPlaceAt(reading: GeoPoint): Promise<string | null> {
  const credential = await loadCredential();
  const conditions = credential ? await readFieldConditions(credential.jwt, reading) : null;
  return conditions?.street ?? null;
}

/**
 * What the camera's stamp says while it aims (José 12/11, Timemark): the hour now, the reading
 * and the street under it. The reading and the street are asked once when the camera opens.
 * The phone's own geocoder goes first and its address travels with the photo (José 18/11); the
 * server burns its own hour and that same place.
 */
export function useLiveStamp(): { stamp: Timemark; point: GeoPoint | null; devicePlace: string | null } {
  const [now, setNow] = useState(() => new Date());
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [devicePlace, setDevicePlace] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let open = true;
    void (async () => {
      const reading = await freshPoint().catch(() => null);
      if (!open || !reading) return;
      const read = { lat: reading.lat, lng: reading.lng, precision: reading.precision };
      setPoint(read);
      const fromPhone = await devicePlaceAt(read);
      if (open && fromPhone) setDevicePlace(fromPhone);
      const shown = fromPhone ?? (await serverPlaceAt(reading).catch(() => null));
      if (open && shown) setPlace(shown);
    })();
    return () => {
      open = false;
    };
  }, []);
  return { stamp: timemarkOf({ at: now, point, place }), point, devicePlace };
}
