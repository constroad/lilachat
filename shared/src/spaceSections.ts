import { ENLACE_DE_DESCARGA } from './invitacion.js';
import { normalizeJoinCode } from './workspaces.js';

/**
 * The chats of a company space by sections, like Slack (designs `s-03` and
 * `e1-07`): channels, groups, direct messages and apps (`e-23`). Channels go by name
 * (#general first), the rest by their last activity. Every section shows,
 * even empty: channels keep their «Agregar canal». PURE.
 */
export type SpaceSectionKey = 'channels' | 'groups' | 'directs' | 'apps';
type SpaceChat = { kind: 'direct' | 'group' | 'notas'; name?: string; channel?: { visibility: string } | null; lastAt?: string; appId?: string };
export type SpaceSection<T> = { key: SpaceSectionKey; title: string; chats: T[] };

const byRecent = (a: SpaceChat, b: SpaceChat) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '');
const byChannelName = (a: SpaceChat, b: SpaceChat) => {
  if (a.name === 'general') return -1;
  if (b.name === 'general') return 1;
  return (a.name ?? '').localeCompare(b.name ?? '', 'es');
};

export function spaceSections<T extends SpaceChat>(chats: readonly T[]): SpaceSection<T>[] {
  return [
    { key: 'channels', title: 'Canales', chats: chats.filter((chat) => chat.channel).sort(byChannelName) },
    { key: 'groups', title: 'Grupos', chats: chats.filter((chat) => chat.kind === 'group' && !chat.channel).sort(byRecent) },
    { key: 'directs', title: 'Mensajes directos', chats: chats.filter((chat) => chat.kind === 'direct' && !chat.appId).sort(byRecent) },
    // The 1:1s with apps, like Slack's «Apps» (design e-23): the list adds the installed apps not talked to yet.
    { key: 'apps', title: 'Apps', chats: chats.filter((chat) => chat.kind === 'direct' && chat.appId).sort(byRecent) },
  ];
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

export function spaceInviteMessage(params: { spaceName: string; code: string }): string {
  return `Te invito al espacio de ${params.spaceName} en Lilachat. Entra con este enlace: ${spaceJoinLink(params.code)}\n\nSi todavía no tienes Lilachat, descárgala en ${ENLACE_DE_DESCARGA} y entra con tu número. ${joinStep(params.code)}`;
}

/**
 * The invitation by email, the first option for a company (José, 21/10): it
 * goes from the inviter's own mail app, with who invites, where to get
 * Lilachat on the phone or the computer, that one enters with the phone
 * number, and the code.
 */
export function spaceInviteEmail(params: { spaceName: string; code: string; inviterName?: string; /** Invited by email (22/10): verifying it in the profile lets them in. */ to?: string }): { subject: string; body: string } {
  const who = params.inviterName?.trim();
  const steps = params.to
    ? [`3. En «Completa tu perfil», verifica este correo (${params.to}) y entras solo al espacio.`, `   Si ya lo verificaste con otro correo: ${joinStep(params.code)}`]
    : [`3. ${joinStep(params.code)}`];
  return {
    subject: `Invitación al espacio de ${params.spaceName} en Lilachat`,
    body: [
      'Hola:',
      '',
      `${who ? `${who} te invita` : 'Te invitamos'} al espacio de ${params.spaceName} en Lilachat, donde coordinamos el trabajo del equipo.`,
      '',
      'Para unirte:',
      `1. Descarga Lilachat en tu celular: ${ENLACE_DE_DESCARGA}`,
      `   o úsalo en la computadora: ${LILACHAT_WEB_URL}`,
      '2. Entra con tu número de celular.',
      ...steps,
      '',
      'Tus chats personales no se comparten con la empresa.',
    ].join('\n'),
  };
}

/** The same invitation as a `mailto:` link: the mail app opens with the subject and the body, and the person picks the recipients. */
export function spaceInviteMailto(params: { spaceName: string; code: string; inviterName?: string; to?: string }): string {
  const email = spaceInviteEmail(params);
  return `mailto:${params.to ? encodeURIComponent(params.to) : ''}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
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
