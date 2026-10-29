import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ClientRecord, SpaceClient } from '@lilachat/shared';
import { api } from '../../api';

/**
 * The space's client channels (pending 21, §157): `GET
 * /api/workspaces/:id/clients`, only the ones whose private channel I am in.
 * Asked again when the space or its chat ids change (a new client channel
 * appears in the list), never on a timer. The conversation reads its client
 * from the same store to show the banner and «Servicios».
 */
let byChat = new Map<string, SpaceClient>();
const listeners = new Set<() => void>();

function publish(clients: readonly SpaceClient[]) {
  byChat = new Map(clients.map((client) => [client.chat_id, client]));
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useClientOfChat(chatId: string): SpaceClient | null {
  return useSyncExternalStore(subscribe, () => byChat.get(chatId) ?? null);
}

/** `null` while the first answer is on its way; a failure leaves the list without the section. */
export function useSpaceClients(jwt: string | undefined, spaceId: string, chatsKey: string): SpaceClient[] | null {
  const [clients, setClients] = useState<SpaceClient[] | null>(null);
  useEffect(() => {
    setClients(null);
  }, [spaceId]);
  useEffect(() => {
    if (!jwt) return;
    const controller = new AbortController();
    void api<{ clients: SpaceClient[] }>(`/workspaces/${spaceId}/clients`, { jwt, signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      const next = response.ok ? response.data.clients : [];
      setClients(next);
      publish(next);
    });
    return () => controller.abort();
  }, [jwt, spaceId, chatsKey]);
  return clients;
}

/** The records of a client's services (informes, quotes, payments), asked when «Servicios» opens; `null` while loading. */
export function useClientRecords(jwt: string | undefined, spaceId: string | undefined, clientId: string | undefined): ClientRecord[] | null {
  const [records, setRecords] = useState<ClientRecord[] | null>(null);
  useEffect(() => {
    setRecords(null);
    if (!jwt || !spaceId || !clientId) return;
    const controller = new AbortController();
    void api<{ records: ClientRecord[] }>(`/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/records`, { jwt, signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted) setRecords(response.ok ? response.data.records : []);
    });
    return () => controller.abort();
  }, [jwt, spaceId, clientId]);
  return records;
}
