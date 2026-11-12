import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoPointOf, gpsGroupOf, gpsValuesOf, placeAutofill, readingOf, workFieldsOf, type FormField, type FormValues, type GeoPoint, type WorkMapStreet } from '@lilachat/shared';
import { useCurrentLocation } from '../location/useCurrentLocation';

export type ReadingState = 'idle' | 'asking' | 'denied' | 'ready';

type Params = { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; streets: readonly WorkMapStreet[] | null };

/**
 * The fields the engineer never types (CON-CAP point), the APK's twin of the web's hook: on opening the
 * reading goes into the `gps` numbers, and the nearest street of the work map and its station are
 * picked. A draft that already holds a reading keeps it until «Volver a tomar».
 */
export function useFieldAutofill({ fields, values, fill, streets }: Params) {
  const group = useMemo(() => gpsGroupOf(fields), [fields]);
  const work = useMemo(() => workFieldsOf(fields), [fields]);
  const wanted = Boolean(group || work.street || work.station);
  const held = group ? readingOf(group, values) : null;
  const [asked, setAsked] = useState(() => !held);
  const { current, retry } = useCurrentLocation(wanted && asked);
  const own: GeoPoint | null = current.state === 'ready' ? geoPointOf({ latitude: current.location.lat, longitude: current.location.lng, accuracy: current.location.accuracy ?? 0 }) : null;
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const written = useRef<FormValues>({});
  useEffect(() => {
    if (own && group && asked) fillRef.current(gpsValuesOf(group, own));
  }, [own?.lat, own?.lng, own?.precision]);
  const reading = held ?? own;
  const patch = reading && streets ? placeAutofill({ fields, values, streets, reading, written: written.current }) : {};
  const patchKey = JSON.stringify(patch);
  useEffect(() => {
    if (patchKey === '{}') return;
    written.current = { ...written.current, ...patch };
    fillRef.current(patch);
  }, [patchKey]);
  const take = useCallback(() => {
    if (asked) retry();
    else setAsked(true);
  }, [asked, retry]);
  return { group, reading, state: stateOf(asked, current.state, held !== null), take };
}

function stateOf(asked: boolean, location: 'locating' | 'denied' | 'error' | 'ready', held: boolean): ReadingState {
  if (!asked) return held ? 'ready' : 'idle';
  if (location === 'locating') return 'asking';
  return location === 'ready' ? 'ready' : 'denied';
}
