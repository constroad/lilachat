import { useCallback, useEffect, useRef, useState } from 'react';
import { WORK_MAP_FAILED, type ChannelLinks, type WorkMap } from '@lilachat/shared';
import { api } from '../../../api';

type ServiceTarget = { kind: 'service'; clientId: string; serviceId: string };
export type WorkMapState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string; url?: string }
  | { kind: 'ready'; url: string; map: WorkMap | null };

/** The link of the service, then the map behind it; only the latest question answers. */
export function useWorkMap(jwt: string, links: ChannelLinks, target: ServiceTarget) {
  const [state, setState] = useState<WorkMapState>({ kind: 'loading' });
  const latestLinks = useRef(links);
  latestLinks.current = links;
  const turn = useRef(0);
  const { clientId, serviceId } = target;
  const load = useCallback(async () => {
    turn.current += 1;
    const asked = turn.current;
    const answer = (next: WorkMapState) => {
      if (asked === turn.current) setState(next);
    };
    setState({ kind: 'loading' });
    const link = await latestLinks.current.map({ kind: 'service', clientId, serviceId });
    if (!link.ok) return answer({ kind: 'failed', message: link.message });
    const reply = await api<{ map: WorkMap | null }>('/service-work-map', { jwt, body: { link: link.url, serviceId } });
    return answer(reply.ok ? { kind: 'ready', url: link.url, map: reply.data.map ?? null } : { kind: 'failed', message: reply.message ?? WORK_MAP_FAILED, url: link.url });
  }, [jwt, clientId, serviceId]);
  useEffect(() => {
    void load();
    return () => {
      turn.current += 1;
    };
  }, [load]);
  return { state, retry: load };
}
