import { useCallback, useEffect, useRef, useState } from 'react';
import { afterQuietReload, loadWorkMap, type ChannelLinks, type WorkMap, type WorkMapState } from '@lilachat/shared';
import { api } from '../../../api';

type ServiceTarget = { kind: 'service'; clientId: string; serviceId: string };

/** The map of a service; only the latest question answers. */
export function useWorkMap(jwt: string, links: ChannelLinks, target: ServiceTarget) {
  const [state, setState] = useState<WorkMapState>({ kind: 'loading' });
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const { clientId, serviceId } = target;
  /** `quiet` after an edit: the map on screen stays while Portal answers (an open street does not close). */
  const load = useCallback(async (quiet = false) => {
    turn.current += 1;
    const asked = turn.current;
    if (!quiet) setState({ kind: 'loading' });
    const read = (link: string) => api<{ map: WorkMap | null }>('/service-work-map', { jwt, body: { link, serviceId } });
    const next = await loadWorkMap(() => latestLinks.current.map({ kind: 'service', clientId, serviceId }), read);
    if (asked === turn.current) setState((previous) => (quiet ? afterQuietReload(previous, next) : next));
  }, [jwt, clientId, serviceId]);
  useEffect(() => {
    void load();
    return () => {
      turn.current += 1;
    };
  }, [load]);
  return { state, retry: load, refresh: () => load(true) };
}
