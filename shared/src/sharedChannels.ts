import { canManageMembers, type WorkspaceRole } from './workspaces.js';
import { groupContactsByLetter, type Contact, type ContactGroup } from './contacts.js';

/**
 * Channels shared between company spaces (José 11/11, like Slack Connect): a
 * channel of one space is seen from other spaces without switching. The
 * messages stay the owner space's; the receiving spaces list it under a
 * section named after the owner, and anyone in the channel adds people from
 * any of those spaces. PURE.
 */
export type ShareStatus = 'pending' | 'active' | 'removed';
/** Where a shared channel comes from, on the chat summary a receiving space lists. */
export type SharedFrom = { workspaceId: string; name: string; logoUrl?: string };
/** One space a channel is shared with, as the share dialog shows it. */
export type ChannelShare = { workspaceId: string; name: string; logoUrl?: string; status: Exclude<ShareStatus, 'removed'>; members?: number };
/** A channel offered to a space, waiting for one of its admins. */
export type ShareInvite = { chatId: string; channelName: string; from: SharedFrom; invitedBy?: string };

/** Why this person cannot share this channel with that space, or null when they can. */
export function shareRefusal(params: { role: WorkspaceRole; isChannel: boolean; isGeneral: boolean; isClientChannel: boolean; sameSpace: boolean; memberOfTarget: boolean }): string | null {
  if (!canManageMembers(params.role)) return 'Solo un admin del espacio puede compartir sus canales.';
  if (!params.isChannel) return 'Solo se comparten canales.';
  if (params.isGeneral) return '#general es de todo el espacio: no se comparte.';
  if (params.isClientChannel) return 'Los canales de cliente vienen de Portal: no se comparten.';
  if (params.sameSpace) return 'Elige otro espacio: el canal ya es de este.';
  if (!params.memberOfTarget) return 'Solo puedes compartirlo con espacios de los que eres miembro.';
  return null;
}

/** Someone who also runs the receiving space shares at once; otherwise one of its admins accepts. */
export function shareStatusFor(roleInTarget: WorkspaceRole | null): Exclude<ShareStatus, 'removed'> {
  return roleInTarget && canManageMembers(roleInTarget) ? 'active' : 'pending';
}

/** The spaces whose members may be in the channel: the owner and every active share, once each. */
export function spacesWithAccess(ownerWorkspaceId: string, shares: readonly { workspaceId: string; status: ShareStatus }[]): string[] {
  return [...new Set([ownerWorkspaceId, ...shares.filter((share) => share.status === 'active').map((share) => share.workspaceId)])];
}

/** The pill beside someone from another space: that space's name, never the one being looked from. */
export function memberSpacePill(member: { spaceId?: string; spaceName?: string }, viewingSpaceId: string | null): string | null {
  if (!member.spaceId || !member.spaceName || member.spaceId === viewingSpaceId) return null;
  return member.spaceName;
}

/** Someone who can be added to a shared channel, with their space (`GET …/channels/:id/people`). */
export type ChannelPerson = { userId: string; name?: string; phone: string; space: { id: string; name: string }; inChannel: boolean };

/** The add picker of a shared channel: everyone from the spaces with access, those from another space with its pill. */
export function channelPeopleAsContacts(people: readonly ChannelPerson[], viewingSpaceId: string | null): ContactGroup[] {
  const contacts = people.map((person): Contact => {
    const pill = memberSpacePill({ spaceId: person.space.id, spaceName: person.space.name }, viewingSpaceId);
    return { id: person.userId, name: person.name ?? null, phone: person.phone, directChatId: null, ...(pill ? { space: pill } : {}) };
  });
  return groupContactsByLetter(contacts);
}

/** What the invitations card shows (design `sc-04`): the invitations waiting and the one being answered. */
export type ShareInvitesState = { invites: ShareInvite[]; busy: string | null };
type ShareInvitesSource = {
  role: WorkspaceRole;
  list: () => Promise<{ ok: true; data: { invites: ShareInvite[] } } | { ok: false }>;
  answer: (chatId: string, accept: boolean) => Promise<unknown>;
};

/**
 * The invitations card without React, so web and phone share it: only an admin
 * asks for them, and answering one reloads what is left. Each platform
 * subscribes with `useSyncExternalStore`.
 */
export function shareInvitesStore(source: ShareInvitesSource) {
  let state: ShareInvitesState = { invites: [], busy: null };
  const listeners = new Set<() => void>();
  const update = (next: Partial<ShareInvitesState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const load = async () => {
    if (!canManageMembers(source.role)) return update({ invites: [] });
    const response = await source.list();
    update({ invites: response.ok ? response.data.invites : [] });
  };
  return {
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    load,
    answer: async (chatId: string, accept: boolean) => {
      update({ busy: chatId });
      await source.answer(chatId, accept);
      await load();
      update({ busy: null });
    },
  };
}

