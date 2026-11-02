import { useMemo } from 'react';
import type { ChatSummary } from '../../api/client';
import { getCurrentSpaceId, useCurrentSpaceId } from '../../spaces/currentSpace';
import { fetchSpaceChats, spaceChatsCache, useCached } from '../../spaces/spaceCache';
import { chatsEnMemoria } from '../chatsGuardados';

/**
 * The chats this phone knows: the open space's channels and groups first, then
 * the personal list, without repeating (José, 02/11: sharing from another app
 * only listed personal chats while he was working in a space).
 */
function mergeKnownChats(inSpace: readonly ChatSummary[], personal: readonly ChatSummary[]): ChatSummary[] {
  const listed = new Set(inSpace.map((chat) => chat.id));
  return [...inSpace, ...personal.filter((chat) => !listed.has(chat.id))];
}

/** Outside React: what is in memory now (to open the chat a share went to). */
export function knownChats(): ChatSummary[] {
  const spaceId = getCurrentSpaceId();
  const inSpace = spaceId ? (spaceChatsCache.get(`${spaceId}:chats`).value?.chats ?? []) : [];
  return mergeKnownChats(inSpace, chatsEnMemoria() ?? []);
}

/**
 * In a screen: it also loads the open space's list, from disk and then the
 * server, because a share can open the app before that list was ever drawn.
 */
export function useKnownChats(jwt: string, active: boolean): ChatSummary[] {
  const spaceId = useCurrentSpaceId();
  const page = useCached(spaceChatsCache, spaceId ? `${spaceId}:chats` : null, () => fetchSpaceChats(jwt, spaceId ?? '')(), active);
  return useMemo(() => (active ? mergeKnownChats(page.value?.chats ?? [], chatsEnMemoria() ?? []) : []), [active, page.value]);
}
