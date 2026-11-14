import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { listChats, type ChatSummary } from '../../api/client';
import { getCurrentSpaceId, useCurrentSpaceId } from '../../spaces/currentSpace';
import { fetchSpaceChats, spaceChatsCache, useCached } from '../../spaces/spaceCache';
import { chatsEnMemoria, guardarChats, leerChatsGuardados, suscribirChatsEnMemoria } from '../chatsGuardados';
import { reportarError } from '../../ui/reportarError';
import { knownChatsView, mergeKnownChats, type KnownChatsView } from './knownChatsView';

/**
 * The chats this phone knows: the open space's channels and groups first, then
 * the personal list, without repeating (José, 02/11: sharing from another app
 * only listed personal chats while he was working in a space).
 */

/** Outside React: what is in memory now (to open the chat a share went to). */
export function knownChats(): ChatSummary[] {
  const spaceId = getCurrentSpaceId();
  const inSpace = spaceId ? (spaceChatsCache.get(`${spaceId}:chats`).value?.chats ?? []) : [];
  return mergeKnownChats(inSpace, chatsEnMemoria() ?? []);
}

/**
 * The personal list when nothing in this process read it yet: the phone's
 * copy, and the server's when there is none. José 14/11: a share that opens
 * the app (Samsung had killed it) came before the chat list read its copy.
 */
async function loadOwnChats(jwt: string): Promise<void> {
  const known = chatsEnMemoria() ?? (await leerChatsGuardados());
  if (known && known.length > 0) return;
  const fresh = await listChats(jwt);
  if (fresh.ok) await guardarChats(fresh.data.chats);
}

/** The personal list as it arrives, and whether the attempt to get it ended. */
function useOwnChats(jwt: string, active: boolean): { ownChats: ChatSummary[] | null; settled: boolean } {
  const ownChats = useSyncExternalStore(suscribirChatsEnMemoria, chatsEnMemoria);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setSettled(false);
    void loadOwnChats(jwt)
      .catch((error: unknown) => reportarError('compartir-chats', error))
      .finally(() => {
        if (current) setSettled(true);
      });
    return () => {
      current = false;
    };
  }, [jwt, active]);
  return { ownChats, settled };
}

/**
 * In a screen: it also loads the open space's list and the personal one, from
 * disk and then the server, because a share can open the app before either
 * list was ever drawn. `loading` while they come (José 14/11).
 */
export function useKnownChats(jwt: string, active: boolean): KnownChatsView {
  const spaceId = useCurrentSpaceId();
  const spaceKey = spaceId ? `${spaceId}:chats` : null;
  const page = useCached(spaceChatsCache, spaceKey, () => fetchSpaceChats(jwt, spaceId ?? '')(), active);
  const { ownChats, settled } = useOwnChats(jwt, active);
  return useMemo(
    () => knownChatsView({ active, ownChats, ownChatsSettled: settled, spaceKey, spacePage: { value: page.value, error: page.error, loading: page.loading } }),
    [active, ownChats, settled, spaceKey, page.value, page.error, page.loading]
  );
}
