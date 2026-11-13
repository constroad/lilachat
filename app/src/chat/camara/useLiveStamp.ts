import { useEffect, useState } from 'react';
import { timemarkOf, type GeoPoint, type Timemark } from '@lilachat/shared';
import { freshPoint } from '../location/freshPoint';
import { loadCredential } from '../../auth/credentialStore';
import { readFieldConditions } from '../commands/commandsApi';

/** The stamp's minute moves on screen; a tick more often than this would only cost renders. */
const TICK_MS = 10_000;

/**
 * What the camera's stamp says while it aims (José 12/11, Timemark): the hour now, the reading
 * and the street under it. The reading and the street are asked once when the camera opens;
 * the server burns its own hour and the same place into the photo.
 */
export function useLiveStamp(): { stamp: Timemark; point: GeoPoint | null } {
  const [now, setNow] = useState(() => new Date());
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let open = true;
    void (async () => {
      const reading = await freshPoint().catch(() => null);
      if (!open || !reading) return;
      setPoint({ lat: reading.lat, lng: reading.lng, precision: reading.precision });
      const credential = await loadCredential();
      const conditions = credential ? await readFieldConditions(credential.jwt, reading) : null;
      if (open && conditions?.street) setPlace(conditions.street);
    })();
    return () => {
      open = false;
    };
  }, []);
  return { stamp: timemarkOf({ at: now, point, place }), point };
}
