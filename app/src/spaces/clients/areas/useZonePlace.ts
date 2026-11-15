import { useEffect, useState } from 'react';
import { nearestStreet, zonePlaceLine, type ChannelLinks, type GeoPoint } from '@lilachat/shared';
import { freshPoint } from '../../../chat/location/freshPoint';
import { readFieldConditions } from '../../../chat/commands/commandsApi';
import type { ObservationTarget } from '../observations/useObservations';
import { useWorkStreets } from '../reports/useWorkStreets';

export type ZonePlace = { point: GeoPoint | null; place: string | null; asking: boolean };

/**
 * Where the zone is, from the GPS (José 15/11: «la zona o tramo no lo toma de mi GPS»):
 * read once when the report opens, so it is ready before the first corner. The
 * work map's street with its station wins; else the street of the address.
 */
export function useZonePlace(to: ObservationTarget, links: ChannelLinks | undefined): ZonePlace {
  const streets = useWorkStreets(to.target.jwt, links, to.target.clientId, to.serviceId, true);
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [asking, setAsking] = useState(true);
  useEffect(() => {
    let open = true;
    void (async () => {
      const reading = await freshPoint().catch(() => null);
      if (!open) return;
      if (!reading) return setAsking(false);
      const here = { lat: reading.lat, lng: reading.lng, precision: reading.precision };
      setPoint(here);
      const conditions = await readFieldConditions(to.target.jwt, here);
      if (!open) return;
      setStreet(conditions?.street ?? null);
      setAsking(false);
    })();
    return () => {
      open = false;
    };
  }, [to.target.jwt]);
  const near = point && streets ? nearestStreet(streets, point) : null;
  return { point, place: zonePlaceLine(near, street), asking: asking || (Boolean(point) && streets === null) };
}
