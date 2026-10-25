import type { DirectoryApp } from './bots.js';
import { memberBadge, type MemberPill } from './flatLayout.js';

/**
 * «Enviar mensaje» on a person's card. PURE.
 *
 * José, 25/10/2026: from a person's name or photo in a chat, a group or the member
 * list, a card that opens the 1:1 (or creates it, in the same space) in every mode.
 * A bot that does not take direct messages is never offered.
 *
 * - A person: the plain 1:1, or the one of the space the chat belongs to (the 1:1 in a
 *   space is not the personal one with the same person).
 * - An app: only through its own 1:1 (`/apps/:appId/chat`), which exists while it is
 *   installed in the space. Without that installation there is nothing to open.
 */
export type DirectMessageAction =
  | { kind: 'none' }
  | { kind: 'person'; userId: string; spaceId?: string }
  | { kind: 'app'; appId: string; spaceId: string };

export function directMessageAction(params: {
  person: { userId: string; isApp: boolean };
  myUserId: string;
  /** The space of the chat the person was tapped in; none in a personal chat. */
  spaceId?: string;
  /** The space's installed apps by their bot user (`installedAppsByBot`). */
  installedApps?: ReadonlyMap<string, string>;
}): DirectMessageAction {
  const { person, myUserId, spaceId } = params;
  if (!person.userId || person.userId === myUserId) return { kind: 'none' };
  if (person.isApp) {
    const appId = spaceId ? params.installedApps?.get(person.userId) : undefined;
    return appId && spaceId ? { kind: 'app', appId, spaceId } : { kind: 'none' };
  }
  return spaceId ? { kind: 'person', userId: person.userId, spaceId } : { kind: 'person', userId: person.userId };
}

/** The installed apps of a space's directory, by the bot user that speaks for each. */
export function installedAppsByBot(apps: readonly DirectoryApp[]): Map<string, string> {
  return new Map(apps.flatMap((app) => (app.installation ? [[app.installation.botUserId, app.appId] as const] : [])));
}

/** What the card shows of a person. */
export type CardPerson = { userId: string; name: string; phone: string | null; avatarUrl: string | null; isApp: boolean; badge: string | null };

/**
 * The card's person from a member of the chat (the detail's member): the name the
 * chat shows (the agenda wins), the photo, the phone (not an app's, not mine) and the
 * pill that goes next to the name.
 */
export function personOfMember(params: {
  member: { id: string; name?: string | null; phone?: string | null; avatarUrl?: string | null; app?: boolean };
  /** The name the chat draws for them (`nombresPorMiembro`: the agenda first). */
  displayName?: string;
  pill?: MemberPill;
  isMe: boolean;
}): CardPerson {
  const { member } = params;
  const isApp = member.app === true || params.pill?.role === 'app';
  return {
    userId: member.id,
    name: params.displayName?.trim() || member.name?.trim() || member.phone?.trim() || 'Alguien',
    phone: isApp || params.isMe ? null : (member.phone ?? null),
    avatarUrl: member.avatarUrl ?? null,
    isApp,
    badge: memberBadge({ title: params.pill?.title, role: params.pill?.role, isMe: params.isMe }),
  };
}
