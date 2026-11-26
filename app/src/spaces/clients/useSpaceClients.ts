import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clientsOfEntry, type ClientRecord, type SpaceClient } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { clientsCache, dataOf, spaceDiskKey, useCached } from '../spaceCache';

/**
 * The space's client channels (pending 21, §157): `GET
 * /api/workspaces/:id/clients`, only the ones whose private channel I am in.
 * Asked again when the space or its chat ids change, never on a timer. What
 * it answered is kept like the chats, so the list paints right the first time.
 * The chat screen reads its client from the same store (banner and «Servicios»).
 */
let byChat = new Map<string, SpaceClient>();
const listeners = new Set<() => void>();

/** Per space: opening one space no longer hides another's channels, and a space's new list replaces only its own. */
let bySpace = new Map<string, readonly SpaceClient[]>();
function publish(spaceId: string, clients: readonly SpaceClient[]) {
  bySpace = new Map(bySpace).set(spaceId, clients);
  byChat = new Map([...bySpace.values()].flat().map((client) => [client.chat_id, client]));
  listeners.forEach((listener) => listener());
}

/**
 * A chat opened before its space's list (a push, a card, a cold start without
 * signal) still finds its client: the spaces' saved lists are read once from
 * disk (José 26/11). Nothing is read again if the list already published.
 */
let readFromDisk = false;
async function hydrateClientsFromDisk(): Promise<void> {
  if (readFromDisk) return;
  readFromDisk = true;
  const prefix = spaceDiskKey('');
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((key) => key.startsWith(prefix) && key.endsWith(CLIENTS_SUFFIX));
  const pairs = keys.length ? await AsyncStorage.multiGet(keys).catch(() => []) : [];
  for (const [key, raw] of pairs) {
    const spaceId = key.slice(prefix.length, -CLIENTS_SUFFIX.length);
    // A list the server already sent in this process wins over the disk.
    if (!bySpace.has(spaceId)) publish(spaceId, savedClientsOf(raw));
  }
}
const CLIENTS_SUFFIX = ':clients';

function savedClientsOf(raw: string | null): SpaceClient[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { value?: unknown };
    return Array.isArray(parsed.value) ? (parsed.value as SpaceClient[]) : [];
  } catch {
    return [];
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  void hydrateClientsFromDisk();
  return () => {
    listeners.delete(listener);
  };
};

/** Logout: whoever signs in next does not inherit the channels. */
export function forgetClientsOfChats(): void {
  byChat = new Map();
  bySpace = new Map();
  readFromDisk = false;
  listeners.forEach((listener) => listener());
}

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
    if (clients) publish(spaceId, clients);
  }, [spaceId, clients]);
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
