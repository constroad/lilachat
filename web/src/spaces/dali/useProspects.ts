import { useCallback, useEffect, useState } from 'react';
import { boardSinceOf, type ProspectView } from '@lilachat/shared';
import { useSocketTurn } from '../../socketTurn';
import { currentSocket } from '../../useSocket';
import { fetchProspects, type ProspectList } from './prospectsApi';
import { useProspectEcho } from './prospectEcho';

/** Several changes in a row (agentes' PUT right after Dali's message) read the list once. */
const RELOAD_WAIT_MS = 2000;
const PROSPECTS_CHANGED = 'workspace.prospects.changed';

export type Prospects = {
  /** `null` while the first load is on its way. */
  list: ProspectList | null;
  failed: boolean;
  reload: () => void;
  /** A seller's change answered with the prospect as it stands: the list shows it before reading again. */
  replace: (prospect: ProspectView) => void;
};

/**
 * The prospects of a Dali space, from the start of the oldest period a tab shows (this month, the last 7 days or the
 * week under review). Read again when the server says one changed (`workspace.prospects.changed`) and after a
 * reconnection, which may have missed it; never on a timer (polling is billable debt).
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
    const controller = new AbortController();
    setFailed(false);
    void fetchProspects(jwt, spaceId, boardSinceOf(new Date()), controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      if (answer.ok) setList(answer.data);
      else setFailed(true);
    });
    return () => controller.abort();
  }, [jwt, spaceId, round]);

  useProspectsPulse(spaceId, reload);

  const replace = useCallback((prospect: ProspectView) => {
    setList((current) => current && { ...current, prospects: current.prospects.map((one) => (one.id === prospect.id ? prospect : one)) });
  }, []);
  useProspectEcho(replace);

  return { list, failed, reload, replace };
}

/**
 * Calls `onPulse` when the server says a prospect of the space changed, and after a reconnection (which may have
 * missed it), once for several changes in a row.
 */
export function useProspectsPulse(spaceId: string, onPulse: () => void): void {
  const socketTurn = useSocketTurn();
  useEffect(() => {
    const socket = currentSocket();
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(onPulse, RELOAD_WAIT_MS);
    };
    const onChanged = (frame: { workspaceId?: string }) => frame.workspaceId === spaceId && later();
    socket.on(PROSPECTS_CHANGED, onChanged);
    socket.on('connect', later);
    return () => {
      clearTimeout(timer);
      socket.off(PROSPECTS_CHANGED, onChanged);
      socket.off('connect', later);
    };
  }, [spaceId, socketTurn, onPulse]);
}
