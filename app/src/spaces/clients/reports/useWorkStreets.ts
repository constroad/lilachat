import { useEffect, useState } from 'react';
import { loadWorkMap, type ChannelLinks, type WorkMap, type WorkMapStreet } from '@lilachat/shared';
import { BASE_URL } from '../../../api/client';
import { jsonCall } from '../../../api/jsonCall';

/**
 * The work map's streets for a report form that picks one (CON-CAP), asked once and only when a form
 * wants them; the web's twin. A map that cannot be read leaves an empty list: the street stays optional.
 */
export function useWorkStreets(jwt: string, links: ChannelLinks | undefined, clientId: string, serviceId: string, wanted: boolean): readonly WorkMapStreet[] | null {
  const [streets, setStreets] = useState<readonly WorkMapStreet[] | null>(null);
  const asked = wanted && Boolean(links);
  useEffect(() => {
    if (!asked || !links || streets) return undefined;
    let alive = true;
    const read = (link: string) => jsonCall<{ map: WorkMap | null }>(`${BASE_URL}/api/service-work-map`, jwt, { method: 'POST', body: JSON.stringify({ link, serviceId }) });
    void loadWorkMap(() => links.map({ kind: 'service', clientId, serviceId }), read).then((state) => {
      if (alive) setStreets(state.kind === 'ready' ? (state.map?.streets ?? []) : []);
    });
    return () => {
      alive = false;
    };
  }, [asked, links, streets, jwt, clientId, serviceId]);
  return links ? streets : [];
}
