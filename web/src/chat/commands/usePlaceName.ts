import { useEffect, useRef, useState } from 'react';
import { placeKeyOf, type GeoPoint } from '@lilachat/shared';

export type PlaceLookup = (point: GeoPoint) => Promise<string | null>;

/** The address of a reading, asked once per block. `undefined`: still asking; `null`: no address. */
export function usePlaceName(point: GeoPoint | null, lookup?: PlaceLookup): string | null | undefined {
  const key = point ? placeKeyOf(point) : null;
  const [known, setKnown] = useState<{ key: string; place: string | null } | null>(null);
  // The block decides, never a new function or a GPS that refines inside it: the server counts these calls.
  const reading = useRef({ point, lookup });
  reading.current = { point, lookup };
  useEffect(() => {
    const { point: now, lookup: ask } = reading.current;
    if (!key || !now) return undefined;
    let alive = true;
    void (ask ? ask(now) : Promise.resolve(null)).then((place) => {
      if (alive) setKnown({ key, place });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return known?.key === key ? known.place : undefined;
}
