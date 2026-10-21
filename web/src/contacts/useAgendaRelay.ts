import { useEffect, useSyncExternalStore, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { BaseLocal } from '../local/baseLocal';
import { getAgendaNames, loadAgendaNames, mergeAgendaNames, requestAgendaNames, setAgendaAsker, subscribeAgendaNames } from './phoneAgenda';

/**
 * Contacts on the web (José, 20/10, option «b»): on every connection the web
 * asks the phone for the names of the numbers it shows, and new numbers are
 * asked as they appear. With the phone offline nothing comes back and the
 * saved names stay.
 */
export function useAgendaRelay(params: {
  base: BaseLocal | null;
  socket: MutableRefObject<Socket | null>;
  connected: boolean;
  phones: readonly (string | undefined)[];
}): ReadonlyMap<string, string> {
  const { base, socket, connected, phones } = params;

  useEffect(() => {
    if (base) void loadAgendaNames(base);
  }, [base]);

  useEffect(() => {
    const current = socket.current;
    if (!base || !connected || !current) return;
    const onNames = (payload: { nombres?: Record<string, string> } | undefined) => {
      if (payload?.nombres) mergeAgendaNames(base, payload.nombres);
    };
    current.on('agenda.nombres', onNames);
    setAgendaAsker((list) => current.emit('agenda.pedir', { phones: list }));
    return () => {
      current.off('agenda.nombres', onNames);
      setAgendaAsker(null);
    };
  }, [base, connected, socket]);

  const phonesKey = phones.filter(Boolean).join(',');
  useEffect(() => {
    if (base) requestAgendaNames(phonesKey.split(','));
  }, [phonesKey, base]);

  return useSyncExternalStore(subscribeAgendaNames, getAgendaNames, getAgendaNames);
}
