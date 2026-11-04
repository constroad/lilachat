import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clientsOfEntry, type ClientRecord, type SpaceClient } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { clientsCache, dataOf, useCached } from '../spaceCache';

/**
 * The space's client channels (pending 21, §157): `GET
 * /api/workspaces/:id/clients`, only the ones whose private channel I am in.
 * Asked again when the space or its chat ids change, never on a timer. What
 * it answered is kept like the chats, so the list paints right the first time.
 * The chat screen reads its client from the same store (banner and «Servicios»).
 */
let byChat = new Map<string, SpaceClient>();
const listeners = new Set<() => void>();

function publish(clients: readonly SpaceClient[]) {
  byChat = new Map(clients.map((client) => [client.chat_id, client]));
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useClientOfChat(chatId: string): SpaceClient | null {
  return useSyncExternalStore(subscribe, () => byChat.get(chatId) ?? null);
}

const fetchClients = (jwt: string, spaceId: string) => async () =>
  dataOf(await jsonCall<{ clients: SpaceClient[] }>(`${BASE_URL}/api/workspaces/${spaceId}/clients`, jwt), 'No se pudieron cargar los clientes.').clients;

/** `null` while the first answer is on its way; a failure with nothing saved leaves the list without the section. */
export function useSpaceClients(jwt: string, spaceId: string, chatsKey: string): SpaceClient[] | null {
  const entry = useCached(clientsCache, `${spaceId}:clients`, fetchClients(jwt, spaceId));
  const { refresh } = entry;
  const clients = clientsOfEntry(entry);
  const askedFor = useRef(chatsKey);
  useEffect(() => {
    if (askedFor.current === chatsKey) return;
    askedFor.current = chatsKey;
    refresh();
  }, [chatsKey, refresh]);
  useEffect(() => {
    if (clients) publish(clients);
  }, [clients]);
  return clients;
}

/** The records of a client's services (informes, quotes, payments), asked when «Servicios» opens; `null` while loading. */
export function useClientRecords(jwt: string, spaceId: string | undefined, clientId: string | undefined, enabled: boolean): ClientRecord[] | null {
  const [records, setRecords] = useState<ClientRecord[] | null>(null);
  useEffect(() => {
    setRecords(null);
    if (!enabled || !spaceId || !clientId) return;
    let alive = true;
    void jsonCall<{ records: ClientRecord[] }>(`${BASE_URL}/api/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/records`, jwt).then((response) => {
      if (alive) setRecords(response.ok ? response.data.records : []);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, clientId, enabled]);
  return records;
}
