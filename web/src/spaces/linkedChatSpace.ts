import { useEffect, useRef } from 'react';
import { api } from '../api';

/** `{ to }` = show that space (`null` = personal); `null` = stay where the list is. */
export type LinkedChatSwitch = { to: string | null } | null;

type SwitchInput = { chatSpaceIds: readonly string[]; currentSpaceId: string | null; mySpaceIds: readonly string[] };

/** Where a chat opened by its link belongs: its space if I am active there, personal if it has none. */
export function linkedChatSwitch({ chatSpaceIds, currentSpaceId, mySpaceIds }: SwitchInput): LinkedChatSwitch {
  if (chatSpaceIds.length === 0) return currentSpaceId === null ? null : { to: null };
  if (currentSpaceId && chatSpaceIds.includes(currentSpaceId)) return null;
  const mine = chatSpaceIds.find((spaceId) => mySpaceIds.includes(spaceId));
  return mine ? { to: mine } : null;
}

type LinkedChatParams = {
  jwt: string | undefined;
  /** The chat the page was opened with (`/c/<id>`, a notification); never one opened by a tap. */
  linkedChatId: string | null;
  selectedChatId: string | null;
  /** Already in a list on screen (personal or the current space). */
  found: boolean;
  currentSpaceId: string | null;
  /** My active spaces; `null` while they are not known. */
  mySpaceIds: readonly string[] | null;
  onSwitch: (spaceId: string | null) => void;
};

/**
 * E2E 12/11: the current space is remembered per browser, so a link of the Test space opened where
 * Inframaq was last shown painted Inframaq and no conversation. The page asks once where it lives.
 */
export function useLinkedChatSpace(params: LinkedChatParams): void {
  const { jwt, linkedChatId, selectedChatId, found, mySpaceIds } = params;
  const latest = useRef(params);
  latest.current = params;
  const asked = useRef(false);
  const waiting = !found && Boolean(jwt) && Boolean(linkedChatId) && selectedChatId === linkedChatId && mySpaceIds !== null;
  useEffect(() => {
    if (!waiting || asked.current || !jwt || !linkedChatId) return;
    asked.current = true;
    void api<{ spaceIds: string[] }>(`/chats/${linkedChatId}/spaces`, { jwt }).then((response) => {
      const now = latest.current;
      // Found meanwhile, or another chat opened: the answer no longer decides anything.
      if (!response.ok || now.found || now.selectedChatId !== linkedChatId) return;
      const next = linkedChatSwitch({ chatSpaceIds: response.data.spaceIds, currentSpaceId: now.currentSpaceId, mySpaceIds: now.mySpaceIds ?? [] });
      if (next) now.onSwitch(next.to);
    });
  }, [waiting, jwt, linkedChatId]);
}
