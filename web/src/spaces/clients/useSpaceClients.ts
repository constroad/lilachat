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
/** The space the store holds: a channel of it needs no second question. */
let storedSpace: string | null = null;
const listeners = new Set<() => void>();

function publish(clients: readonly SpaceClient[], spaceId: string) {
  byChat = new Map(clients.map((client) => [client.chat_id, client]));
  storedSpace = spaceId;
  listeners.forEach((listener) => listener());
}

const clientsOf = (jwt: string, spaceId: string, signal: AbortSignal) => api<{ clients: SpaceClient[] }>(`/workspaces/${spaceId}/clients`, { jwt, signal });
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useClientOfChat(chatId: string): SpaceClient | null {
  return useSyncExternalStore(subscribe, () => byChat.get(chatId) ?? null);
}

/**
 * A channel open with no space list on screen (the phone after a reload, E2E 12/11): only the list
 * asked for the clients, so the channel lost «Cuenta» and «Servicios». It asks its space once.
 */
export function useClientsOfChannelSpace(jwt: string | undefined, spaceId: string | undefined, channel: boolean): void {
  useEffect(() => {
    if (!channel || !jwt || !spaceId || storedSpace === spaceId) return undefined;
    const controller = new AbortController();
    void clientsOf(jwt, spaceId, controller.signal).then((response) => {
      if (!controller.signal.aborted && response.ok) publish(response.data.clients, spaceId);
    });
    return () => controller.abort();
  }, [jwt, spaceId, channel]);
}

/** `null` while the first answer is on its way; a failure leaves the list without the section. */
export function useSpaceClients(jwt: string | undefined, spaceId: string, chatsKey: string): SpaceClient[] | null {
  const [clients, setClients] = useState<SpaceClient[] | null>(null);
  useEffect(() => {
    setClients(null);
  }, [spaceId]);
  useEffect(() => {
    // Without a session nobody will answer, and the list waits for this.
    if (!jwt) return setClients([]);
    const controller = new AbortController();
    void clientsOf(jwt, spaceId, controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      const next = response.ok ? response.data.clients : [];
      setClients(next);
      publish(next, spaceId);
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
