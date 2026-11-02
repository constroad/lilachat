import type { ChatSummary } from '../../api/client';
import { getCurrentSpaceId } from '../../spaces/currentSpace';
import { spaceChatsCache } from '../../spaces/spaceCache';
import { chatsEnMemoria } from '../chatsGuardados';

/**
 * The chats this phone already has in memory: the open space's channels and
 * groups first, then the personal list (José, 02/11: sharing from another app
 * only listed personal chats while he was working in a space).
 */
export function knownChats(): ChatSummary[] {
  const spaceId = getCurrentSpaceId();
  const inSpace = spaceId ? (spaceChatsCache.get(`${spaceId}:chats`).value?.chats ?? []) : [];
  const listed = new Set(inSpace.map((chat) => chat.id));
  return [...inSpace, ...(chatsEnMemoria() ?? []).filter((chat) => !listed.has(chat.id))];
}
