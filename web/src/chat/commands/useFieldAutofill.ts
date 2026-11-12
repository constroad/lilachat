import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoPointOf, gpsGroupOf, gpsValuesOf, placeAutofill, readingOf, workFieldsOf, type FormField, type FormValues, type GeoPoint, type WorkMapStreet } from '@lilachat/shared';

const READING_TIMEOUT_MS = 15_000;
export type ReadingState = 'idle' | 'asking' | 'denied' | 'ready';

type Params = { fields: readonly FormField[]; values: FormValues; fill: (next: FormValues) => void; streets: readonly WorkMapStreet[] | null };

/**
 * The fields the engineer never types (CON-CAP point): on opening, the device's reading goes into the
 * `gps` numbers, and the nearest street of the work map and the station on it are picked. A form with
 * a street and no `gps` numbers (the general section) reads too, only to suggest the street.
 */
export function useFieldAutofill({ fields, values, fill, streets }: Params) {
  const group = useMemo(() => gpsGroupOf(fields), [fields]);
  const work = useMemo(() => workFieldsOf(fields), [fields]);
  const wanted = Boolean(group || work.street || work.station);
  const held = group ? readingOf(group, values) : null;
  const [own, setOwn] = useState<GeoPoint | null>(null);
  const [state, setState] = useState<ReadingState>(held ? 'ready' : 'idle');
  const written = useRef<FormValues>({});
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const take = useCallback(() => {
    if (!navigator.geolocation) return setState('denied');
    setState('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const reading = geoPointOf(position.coords);
        setOwn(reading);
        setState('ready');
        if (group) fillRef.current(gpsValuesOf(group, reading));
      },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: READING_TIMEOUT_MS, maximumAge: 0 }
    );
  }, [group]);
  useEffect(() => {
    // Asked once on opening, unless the form already holds a reading (a draft taken up again).
    if (wanted && !held) take();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reading = held ?? own;
  const patch = reading && streets ? placeAutofill({ fields, values, streets, reading, written: written.current }) : {};
  const patchKey = JSON.stringify(patch);
  useEffect(() => {
    if (patchKey === '{}') return;
    written.current = { ...written.current, ...patch };
    fillRef.current(patch);
    // The patch is read by its content: a new object with the same fields is the same patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchKey]);
  return { group, reading, state, take };
}
