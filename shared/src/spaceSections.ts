import { ENLACE_DE_DESCARGA } from './invitacion.js';
import { normalizeJoinCode } from './workspaces.js';
import { compareNames, compareOrdinal } from './compareText.js';

/**
 * The chats of a company space by sections, like Slack (designs `s-03` and
 * `e1-07`): channels, groups, direct messages and apps (`e-23`). Channels go by name
 * (#general first), the rest by their last activity. Every section shows,
 * even empty (channels keep their «Agregar canal»), except groups: a space
 * creates channels, not groups (pending 109, José 28/10), so it only lists
 * the ones made before. PURE.
 */
export type SpaceSectionKey = 'channels' | 'groups' | 'directs' | 'apps' | `shared:${string}`;
type SpaceChat = { kind: 'direct' | 'group' | 'notas'; name?: string; channel?: { visibility: string } | null; lastAt?: string; appId?: string; sharedFrom?: { workspaceId: string; name: string; logoUrl?: string } | null };
/** `space`: the owner of the channels of a `shared:<id>` section, for its name and logo (José 11/11). */
export type SpaceSection<T> = { key: SpaceSectionKey; title: string; chats: T[]; space?: { id: string; name: string; logoUrl?: string } };

const byRecent = (a: SpaceChat, b: SpaceChat) => compareOrdinal(b.lastAt ?? '', a.lastAt ?? '');
const byChannelName = (a: SpaceChat, b: SpaceChat) => {
  if (a.name === 'general') return -1;
  if (b.name === 'general') return 1;
  return compareNames(a.name ?? '', b.name ?? '');
};

export function spaceSections<T extends SpaceChat>(chats: readonly T[]): SpaceSection<T>[] {
  const groups = chats.filter((chat) => chat.kind === 'group' && !chat.channel).sort(byRecent);
  return [
    { key: 'channels', title: 'Canales', chats: chats.filter((chat) => chat.channel && !chat.sharedFrom).sort(byChannelName) },
    ...sharedSections(chats),
    ...(groups.length ? [{ key: 'groups' as const, title: 'Grupos', chats: groups }] : []),
    { key: 'directs', title: 'Mensajes directos', chats: chats.filter((chat) => chat.kind === 'direct' && !chat.appId).sort(byRecent) },
    // The 1:1s with apps, like Slack's «Apps» (design e-23): the list adds the installed apps not talked to yet.
    { key: 'apps', title: 'Apps', chats: chats.filter((chat) => chat.kind === 'direct' && chat.appId).sort(byRecent) },
  ];
}

/** Channels of other spaces (José 11/11, like Slack Connect): one section per owner space, named after it, by space name and then channel name. */
function sharedSections<T extends SpaceChat>(chats: readonly T[]): SpaceSection<T>[] {
  const bySpace = new Map<string, { space: NonNullable<SpaceChat['sharedFrom']>; chats: T[] }>();
  for (const chat of chats) {
    if (!chat.sharedFrom) continue;
    const entry = bySpace.get(chat.sharedFrom.workspaceId) ?? { space: chat.sharedFrom, chats: [] };
    entry.chats.push(chat);
    bySpace.set(chat.sharedFrom.workspaceId, entry);
  }
  return [...bySpace.values()]
    .sort((a, b) => compareNames(a.space.name, b.space.name))
    .map(({ space, chats: inSpace }) => ({
      key: `shared:${space.workspaceId}` as const,
      title: space.name,
      chats: inSpace.sort(byChannelName),
      space: { id: space.workspaceId, name: space.name, ...(space.logoUrl ? { logoUrl: space.logoUrl } : {}) },
    }));
}

/** The square logo of a space without its own picture: the initials of its first two words, or its first two letters. */
export function spaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : words[0]!.slice(0, 2);
  return letters.toUpperCase();
}

/** Lilachat on a computer: the invitation offers it next to the phone app. */
export const LILACHAT_WEB_URL = 'https://lilachat.constroad.com';
const joinStep = (code: string) => `Toca el nombre de arriba en Chats › «Unirme con un código» y escribe: ${code}`;

/** The invitation to a space sent by WhatsApp (design `e1-05-invitar`): which space, where to get the app, how to get in, and the code. */
const JOIN_LINK = /^https:\/\/lilachat\.constroad\.com\/unirse\/([^/?#]+)/i;

/**
 * The invitation's own link (pending 47, José 22/10: like WhatsApp or
 * YouTube, it should open the app when it is installed). Android opens the app
 * on it (App Links, `assetlinks.json`); without the app, the web joins too.
 */
export const spaceJoinLink = (code: string): string => `${LILACHAT_WEB_URL}/unirse/${encodeURIComponent(code)}`;

/** The code of a join link, or `null` for any other address. A regex, not `URL`: React Native's is incomplete. */
export function joinCodeFromLink(url: string | null | undefined): string | null {
  const match = JOIN_LINK.exec(url ?? '');
  return match ? normalizeJoinCode(decodeURIComponent(match[1]!)) : null;
}

/** Where to get Lilachat, by device (José 12/11: the APK is Android only; an iPhone installs the web from Safari). */
const deviceSteps = (): string[] => [
  `En Android: ${ENLACE_DE_DESCARGA}`,
  `En iPhone: abre ${LILACHAT_WEB_URL} en Safari y toca Compartir › «Agregar a inicio».`,
];

export function spaceInviteMessage(params: { spaceName: string; code: string }): string {
  return [
    `Te invito al espacio de ${params.spaceName} en Lilachat. Entra con este enlace: ${spaceJoinLink(params.code)}`,
    '',
    'Si todavía no tienes Lilachat:',
    ...deviceSteps(),
    `Entra con tu número. ${joinStep(params.code)}`,
  ].join('\n');
}

/** What the server answers to an email invitation (José 12/11: Lilachat sends the email through constroad-auth). */
export type SpaceEmailInvite = { id: string; email: string; status: 'active' | 'invited'; emailSent?: boolean; emailError?: string };

/** Under «Invitar por correo»: nobody writes the email, Lilachat sends it. */
export const EMAIL_INVITE_HINT = 'Lilachat le envía un correo con el enlace: entra con ese correo y toca «Unirme».';

/** The pill next to an invited email: in the space, the email on its way, or the email still to send. */
export function emailInviteBadge(invite: Pick<SpaceEmailInvite, 'status' | 'emailSent'>): { label: string; tone: 'ok' | 'info' | 'warn' } {
  if (invite.status === 'active') return { label: 'AGREGADO', tone: 'ok' };
  return invite.emailSent ? { label: 'CORREO ENVIADO', tone: 'info' } : { label: 'SIN ENVIAR', tone: 'warn' };
}

export type ChannelFilter = 'all' | 'public' | 'private';
const folded = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Exploring channels (design `e2-15`): the tab's channels matching the search (name or description), and each tab's count. */
export function filterChannels<T extends { name: string; descripcion?: string; visibility: 'public' | 'private' }>(channels: readonly T[], params: { query: string; visibility: ChannelFilter }): { channels: T[]; counts: Record<ChannelFilter, number> } {
  const query = folded(params.query.trim());
  const matching = query ? channels.filter((channel) => folded(`${channel.name} ${channel.descripcion ?? ''}`).includes(query)) : [...channels];
  return {
    channels: params.visibility === 'all' ? matching : matching.filter((channel) => channel.visibility === params.visibility),
    counts: { all: matching.length, public: matching.filter((one) => one.visibility === 'public').length, private: matching.filter((one) => one.visibility === 'private').length },
  };
}

/** What a company does, offered when creating a space and shown under its name. */
export const SPACE_RUBROS = ['Construcción', 'Transporte', 'Maquinaria', 'Planta y producción', 'Comercio', 'Servicios', 'Otro'] as const;

/** «1 miembro», «48 miembros». */
export const membersLabel = (members: number) => `${members} ${members === 1 ? 'miembro' : 'miembros'}`;

/** The line under a space's name: «Construcción · 48 miembros» (switcher, preview), or members first (the space's header). */
export function spaceSubtitle(space: { rubro?: string; members: number }, options: { membersFirst?: boolean } = {}): string {
  const parts = [space.rubro, membersLabel(space.members)].filter(Boolean);
  return (options.membersFirst ? parts.reverse() : parts).join(' · ');
}

/** The spaces in the web's rail: active or waiting for approval, never one without access. Empty = no rail. */
export function railSpaces<T extends { status: string }>(spaces: readonly T[] | null): T[] {
  return (spaces ?? []).filter((space) => space.status === 'active' || space.status === 'pending');
}

/**
 * The badge of the space I am in, live from its list (pending 108, José 28/10:
 * reading a chat there cleared its row but the rail kept the space's count
 * until the next reload). Other spaces keep the server's count. Same array
 * when nothing changes.
 */
export function withLiveUnread<S extends { id: string; unreadChats?: number }>(spaces: S[] | null, currentId: string | null, chats: readonly { unread: number }[] | null): S[] | null {
  if (!spaces || !currentId || !chats) return spaces;
  const live = chats.filter((chat) => chat.unread > 0).length;
  const index = spaces.findIndex((space) => space.id === currentId);
  if (index === -1 || spaces[index]!.unreadChats === live) return spaces;
  return spaces.map((space, position) => (position === index ? { ...space, unreadChats: live } : space));
}

/** The chats of a space without the archived ones, or only those when «Archivados» is open; and how many are archived. */
export function splitArchived<T extends { archived?: boolean }>(chats: readonly T[], openArchived: boolean): { shown: T[]; archived: number } {
  const archived = chats.filter((chat) => chat.archived === true);
  return { shown: openArchived ? archived : chats.filter((chat) => chat.archived !== true), archived: archived.length };
}

/**
 * Chats with something new OUTSIDE what I am looking at (José, 22/10): in
 * personal, every space I am active in; inside a space, personal plus the
 * other spaces. The header shows it so a message elsewhere is not missed.
 */
export function unreadElsewhere(params: { spaces: readonly { id: string; status: string; unreadChats?: number }[] | null; currentId: string | null; personalUnread: number }): number {
  const spaces = (params.spaces ?? []).filter((space) => space.status === 'active' && space.id !== params.currentId);
  const inSpaces = spaces.reduce((total, space) => total + (space.unreadChats ?? 0), 0);
  return inSpaces + (params.currentId ? params.personalUnread : 0);
}

export type SpaceSettingsRow = { key: 'settings' | 'members' | 'channels' | 'apps' | 'invite' | 'media'; title: string; detail: string };

/**
 * The space's part of the «Ajustes» tab (José, 24/10: the space's settings belong in the
 * bottom tab; design e-34): what each one can do
 * there. Settings only for owners and admins; inviting only with a code.
 */
export function spaceSettingsRows(space: { role: string; members: number; pendingRequests?: number; joinCode?: string }, apps: readonly string[]): SpaceSettingsRow[] {
  const admin = space.role === 'owner' || space.role === 'admin';
  const requests = space.pendingRequests ? ` · ${space.pendingRequests} ${space.pendingRequests === 1 ? 'solicitud' : 'solicitudes'}` : '';
  return [
    ...(admin ? [{ key: 'settings' as const, title: 'Ajustes del espacio', detail: 'Nombre, logo, rubro y código de ingreso' }] : []),
    { key: 'members', title: admin ? 'Miembros y roles' : 'Miembros', detail: `${membersLabel(space.members)}${admin ? requests : ''}` },
    { key: 'channels', title: 'Canales', detail: 'Explorar y unirte' },
    { key: 'apps', title: 'Apps', detail: apps.length ? apps.join(', ') : 'Ninguna instalada todavía' },
    ...(space.joinCode ? [{ key: 'invite' as const, title: 'Invitar al espacio', detail: `Código ${space.joinCode}` }] : []),
    { key: 'media', title: 'Medios del espacio', detail: 'Fotos, videos y documentos de sus canales' },
  ];
}

/** The badge next to the space's name: only for who runs it. */
export const spaceRoleBadge = (role: string): string | null => (role === 'owner' ? 'Dueño' : role === 'admin' ? 'Admin' : null);
