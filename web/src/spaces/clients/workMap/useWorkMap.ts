import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWorkMap, type ChannelLinks, type WorkMap, type WorkMapState } from '@lilachat/shared';
import { api } from '../../../api';

type ServiceTarget = { kind: 'service'; clientId: string; serviceId: string };

/** The map of a service; only the latest question answers. */
export function useWorkMap(jwt: string, links: ChannelLinks, target: ServiceTarget) {
  const [state, setState] = useState<WorkMapState>({ kind: 'loading' });
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const { clientId, serviceId } = target;
  const load = useCallback(async () => {
    turn.current += 1;
    const asked = turn.current;
    setState({ kind: 'loading' });
    const read = (link: string) => api<{ map: WorkMap | null }>('/service-work-map', { jwt, body: { link, serviceId } });
    const next = await loadWorkMap(() => latestLinks.current.map({ kind: 'service', clientId, serviceId }), read);
    if (asked === turn.current) setState(next);
  }, [jwt, clientId, serviceId]);
  useEffect(() => {
    void load();
    return () => {
      turn.current += 1;
    };
  }, [load]);
  return { state, retry: load };
}
