import { useEffect, useRef, useState } from 'react';
import { placeKeyOf, type GeoPoint } from '@lilachat/shared';

export type PlaceLookup = (point: GeoPoint) => Promise<string | null>;

/** The address of a reading, once per block; `undefined` while asked, `null` without one. The server counts these calls. */
export function usePlaceName(point: GeoPoint | null, lookup?: PlaceLookup): string | null | undefined {
  const block = point ? placeKeyOf(point) : null;
  const [answer, setAnswer] = useState<{ block: string; place: string | null } | null>(null);
  const latest = useRef({ point, lookup });
  latest.current = { point, lookup };
  useEffect(() => {
    const here = latest.current.point;
    if (!block || !here) return undefined;
    let open = true;
    const asked = latest.current.lookup?.(here) ?? Promise.resolve(null);
    void asked.then((place) => open && setAnswer({ block, place }));
    return () => {
      open = false;
    };
  }, [block]);
  return answer?.block === block ? answer.place : undefined;
}
