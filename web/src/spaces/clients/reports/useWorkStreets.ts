import { useEffect, useState } from 'react';
import { loadWorkMap, type ChannelLinks, type WorkMap, type WorkMapStreet } from '@lilachat/shared';
import { api } from '../../../api';

/**
 * The work map's streets for a report form that picks one (CON-CAP), asked once and only when a form
 * wants them. A map that cannot be read leaves an empty list: the street stays optional.
 */
export function useWorkStreets(jwt: string, links: ChannelLinks | undefined, clientId: string, serviceId: string, wanted: boolean): readonly WorkMapStreet[] | null {
  const [streets, setStreets] = useState<readonly WorkMapStreet[] | null>(null);
  const asked = wanted && Boolean(links);
  useEffect(() => {
    if (!asked || !links || streets) return undefined;
    let alive = true;
    const read = (link: string) => api<{ map: WorkMap | null }>('/service-work-map', { jwt, body: { link, serviceId } });
    void loadWorkMap(() => links.map({ kind: 'service', clientId, serviceId }), read).then((state) => {
      if (alive) setStreets(state.kind === 'ready' ? (state.map?.streets ?? []) : []);
    });
    return () => {
      alive = false;
    };
  }, [asked, links, streets, jwt, clientId, serviceId]);
  return links ? streets : [];
}
