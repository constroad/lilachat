import { useEffect, useState } from 'react';
import type { Contact } from '@lilachat/shared';
import { api } from '../api';
import { requestFullAgenda } from './fullAgenda';

export type PhoneContactsState = 'loading' | 'ready' | 'no-phone';

/**
 * The phone's contacts who are on Lilachat, for «Nuevo chat» (pending 20):
 * the address book comes from the phone (nothing stored on the server), the
 * match says who has an account, and the agenda's name wins.
 */
export function usePhoneContacts(jwt: string): { contacts: Contact[]; state: PhoneContactsState } {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<PhoneContactsState>('loading');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const agenda = await requestFullAgenda();
      if (!alive) return;
      if (!agenda) return setState('no-phone');
      if (agenda.length === 0) return setState('ready');
      const names = new Map(agenda.map((contact) => [contact.phone, contact.name]));
      const matched = await api<{ contacts: Contact[] }>('/contacts/match', { jwt, body: { phones: [...names.keys()] } });
      if (!alive) return;
      if (matched.ok) setContacts(matched.data.contacts.map((contact) => ({ ...contact, name: names.get(contact.phone) ?? contact.name })));
      setState('ready');
    })();
    return () => {
      alive = false;
    };
  }, [jwt]);

  return { contacts, state };
}
