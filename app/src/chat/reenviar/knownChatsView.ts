import type { ChatSummary } from '../../api/client';

/**
 * What «Reenviar a» / «Compartir en» lists, and whether it is still arriving.
 * PURE. José 14/11: the personal list was read once when the screen opened; on
 * a cold start from Android's share sheet it was not in memory yet, so only
 * «Tú» showed and the rest never came.
 */
export type KnownChatsInput = {
  active: boolean;
  /** The personal list in memory; `null` until this process read or fetched it. */
  ownChats: readonly ChatSummary[] | null;
  /** The attempt to read it (disk, then server) ended, with or without a list. */
  ownChatsSettled: boolean;
  /** The open space's list key; `null` in the personal account. */
  spaceKey: string | null;
  spacePage: { value?: { chats: readonly ChatSummary[] }; error?: string; loading: boolean };
};

export type KnownChatsView = { chats: ChatSummary[]; loading: boolean };

/** The open space's channels and groups first, then the personal list, without repeating (José, 02/11). */
export function mergeKnownChats(inSpace: readonly ChatSummary[], own: readonly ChatSummary[]): ChatSummary[] {
  const listed = new Set(inSpace.map((chat) => chat.id));
  return [...inSpace, ...own.filter((chat) => !listed.has(chat.id))];
}

export function knownChatsView(input: KnownChatsInput): KnownChatsView {
  if (!input.active) return { chats: [], loading: false };
  const ownListPending = input.ownChats === null && !input.ownChatsSettled;
  const spaceListPending = input.spaceKey !== null && !input.spacePage.value && !input.spacePage.error;
  return {
    chats: mergeKnownChats(input.spacePage.value?.chats ?? [], input.ownChats ?? []),
    loading: ownListPending || spaceListPending,
  };
}
