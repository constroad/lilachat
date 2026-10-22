import { useEffect, useSyncExternalStore, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { AgendaContact } from '@lilachat/shared';
import type { BaseLocal } from '../local/baseLocal';
import { receiveFullAgenda, setFullAgendaAsker } from './fullAgenda';
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
    // The whole address book for «Nuevo chat» (pending 20): its names also fill the saved ones.
    const onContacts = (payload: { contactos?: AgendaContact[] } | undefined) => {
      const contacts = payload?.contactos ?? [];
      mergeAgendaNames(base, Object.fromEntries(contacts.map((contact) => [contact.phone, contact.name])));
      receiveFullAgenda(contacts);
    };
    current.on('agenda.nombres', onNames);
    current.on('agenda.contactos', onContacts);
    setAgendaAsker((list) => current.emit('agenda.pedir', { phones: list }));
    setFullAgendaAsker(() => current.emit('agenda.pedirTodo'));
    return () => {
      current.off('agenda.nombres', onNames);
      current.off('agenda.contactos', onContacts);
      setAgendaAsker(null);
      setFullAgendaAsker(null);
    };
  }, [base, connected, socket]);

  const phonesKey = phones.filter(Boolean).join(',');
  useEffect(() => {
    if (base) requestAgendaNames(phonesKey.split(','));
  }, [phonesKey, base]);

  return useSyncExternalStore(subscribeAgendaNames, getAgendaNames, getAgendaNames);
}
