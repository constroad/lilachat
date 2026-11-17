import { useCallback, useEffect, useState } from 'react';
import { boardSinceOf, type ProspectView } from '@lilachat/shared';
import { alConectar, connectSocket, getSocket } from '../../chat/socketClient';
import { fetchProspects, type ProspectList } from './prospectsApi';
import { useProspectEcho } from './prospectEcho';

/** Several changes in a row (agentes' PUT right after Dali's message) read the list once. */
const RELOAD_WAIT_MS = 2000;
const PROSPECTS_CHANGED = 'workspace.prospects.changed';

export type Prospects = { list: ProspectList | null; failed: boolean; reload: () => void; replace: (prospect: ProspectView) => void };

/**
 * The prospects of a Dali space, as on the web: from the start of the oldest period a tab shows, read again when the
 * server says one changed and after a reconnection; never on a timer (polling is billable debt).
 */
export function useProspects(jwt: string, spaceId: string): Prospects {
  const [list, setList] = useState<ProspectList | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((value) => value + 1), []);
  useEffect(() => {
    setList(null);
  }, [spaceId]);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    void fetchProspects(jwt, spaceId, boardSinceOf(new Date())).then((answer) => {
      if (!alive) return;
      if (answer.ok) setList(answer.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, round]);
  useProspectsPulse(jwt, spaceId, reload);
  const replace = useCallback((prospect: ProspectView) => {
    setList((current) => current && { ...current, prospects: current.prospects.map((one) => (one.id === prospect.id ? prospect : one)) });
  }, []);
  useProspectEcho(replace);
  return { list, failed, reload, replace };
}

/**
 * Calls `onPulse` when a prospect of the space changed, and after a reconnection, once for several in a row. An empty
 * `spaceId` listens to nothing (a chat that is not a prospect's). The socket is asked for, not read: on the first
 * mount this effect runs before the shell's, which is the one that creates it.
 */
export function useProspectsPulse(jwt: string, spaceId: string, onPulse: () => void): void {
  useEffect(() => {
    if (!spaceId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(onPulse, RELOAD_WAIT_MS);
    };
    const onChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId === spaceId) later();
    };
    const socket = getSocket() ?? connectSocket(jwt);
    socket.on(PROSPECTS_CHANGED, onChanged);
    const offConnect = alConectar(later);
    return () => {
      clearTimeout(timer);
      socket.off(PROSPECTS_CHANGED, onChanged);
      offConnect();
    };
  }, [jwt, spaceId, onPulse]);
}
