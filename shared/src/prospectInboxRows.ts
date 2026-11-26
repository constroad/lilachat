import { inboxOf, inboxSectionOf, type FollowUpItem, type InboxSection, type InboxView, type ProspectView } from './prospectBoard.js';

/**
 * The Dali inbox of the APK as ONE virtualized list (dl-01 v3): which view opens, the line of today's follow-ups,
 * who attends each row, and the rows themselves — each section under its kicker, «Solo consultas» and the team's own
 * chats folded at the foot. The web draws the same blocks with the same texts; a phone needs them flat for a list
 * that only draws what is on screen (a month can bring 150 prospects). PURE.
 */

export type ProspectInbox = ReturnType<typeof inboxOf>;
export type InboxFold = 'consults' | 'team';
/** Where a row sits: outside any fold, inside an open one, or the last one inside (it closes the card). */
export type FoldPlace = 'none' | 'inside' | 'last';

export type InboxRow<Chat> =
  | { kind: 'loading'; key: 'loading' }
  | { kind: 'failed'; key: 'failed' }
  | { kind: 'empty'; key: 'empty'; title: string; hint: string }
  | { kind: 'kicker'; key: string; section: InboxSection; label: string }
  | { kind: 'prospect'; key: string; prospect: ProspectView; place: FoldPlace }
  | { kind: 'fold'; key: string; fold: InboxFold; title: string; hint: string; open: boolean }
  | { kind: 'chat'; key: string; chat: Chat; place: FoldPlace };

export type InboxAttendant = { kind: 'seller'; name: string } | { kind: 'unassigned' } | { kind: 'dali' };

const CONSULTS_HINT = 'Dali las atiende solo y no ocupan al equipo';
const TEAM_HINT = 'Canales y mensajes directos del espacio';

/** The view on screen: the one the seller chose, else «Míos» when something is theirs, else «Todos» (dl-01). */
export function shownInboxOf(prospects: readonly ProspectView[], params: { me: string; chosen: InboxView | null; service?: string; unreadOf?: (chatId: string) => number }, now: Date): { view: InboxView; inbox: ProspectInbox } {
  const first = inboxOf(prospects, { me: params.me, view: params.chosen ?? 'mine', service: params.service, unreadOf: params.unreadOf }, now);
  if (params.chosen || first.counts.mine > 0) return { view: params.chosen ?? 'mine', inbox: first };
  return { view: 'all', inbox: inboxOf(prospects, { me: params.me, view: 'all', service: params.service, unreadOf: params.unreadOf }, now) };
}

/** Loading, failed or empty: what the inbox says instead of its sections. */
function stateRows(list: { prospects: readonly ProspectView[] } | null, failed: boolean, inbox: ProspectInbox): InboxRow<never>[] {
  if (!list) return [failed ? { kind: 'failed', key: 'failed' } : { kind: 'loading', key: 'loading' }];
  if (inbox.sections.length > 0 || inbox.consults.length > 0) return [];
  if (list.prospects.length > 0) return [{ kind: 'empty', key: 'empty', title: 'Nada en esta vista.', hint: 'Prueba con «Todos» o con otro servicio.' }];
  return [{ kind: 'empty', key: 'empty', title: 'Todavía no hay prospectos.', hint: 'Cuando alguien escriba por WhatsApp, Dali le contesta primero y aparece aquí.' }];
}

const prospectRow = (prospect: ProspectView, place: FoldPlace): InboxRow<never> => ({ kind: 'prospect', key: `prospect:${prospect.id}`, prospect, place });

function sectionRows(inbox: ProspectInbox): InboxRow<never>[] {
  return inbox.sections.flatMap((section) => [
    { kind: 'kicker' as const, key: `kicker:${section.key}`, section: section.key, label: `${section.label} · ${section.items.length}` },
    ...section.items.map((prospect) => prospectRow(prospect, 'none')),
  ]);
}

/** A fold and, while it is open, what it holds; nothing at all when it would hold nothing. */
function foldRows<Entry, Chat>(header: { fold: InboxFold; title: string; hint: string; open: boolean }, entries: readonly Entry[], rowOf: (entry: Entry, place: FoldPlace) => InboxRow<Chat>): InboxRow<Chat>[] {
  if (entries.length === 0) return [];
  const head: InboxRow<Chat> = { kind: 'fold', key: `fold:${header.fold}`, ...header };
  if (!header.open) return [head];
  return [head, ...entries.map((entry, index) => rowOf(entry, index === entries.length - 1 ? 'last' : 'inside'))];
}

function teamHintOf(chats: readonly { unread: number }[]): string {
  const unread = chats.filter((chat) => chat.unread > 0).length;
  return unread > 0 ? `${unread} con mensajes sin leer` : TEAM_HINT;
}

/** The whole inbox under its header, top to bottom, as the rows of one list. */
export function inboxRowsOf<Chat extends { id: string; unread: number }>(params: {
  list: { prospects: readonly ProspectView[] } | null;
  failed: boolean;
  inbox: ProspectInbox;
  teamChats: readonly Chat[];
  open: Readonly<Record<InboxFold, boolean>>;
}): InboxRow<Chat>[] {
  const { inbox, teamChats, open } = params;
  const consults = { fold: 'consults' as const, title: `Solo consultas · ${inbox.consults.length}`, hint: CONSULTS_HINT, open: open.consults };
  const team = { fold: 'team' as const, title: `Chats del equipo · ${teamChats.length}`, hint: teamHintOf(teamChats), open: open.team };
  return [
    ...stateRows(params.list, params.failed, inbox),
    ...sectionRows(inbox),
    ...foldRows(consults, inbox.consults, prospectRow),
    ...foldRows(team, teamChats, (chat, place): InboxRow<Chat> => ({ kind: 'chat', key: `chat:${chat.id}`, chat, place })),
  ];
}

/** «5 para hoy · 2 atrasados» (dl-01 → dl-05): an «atrasado» is a follow-up past its hour («vencido» is the funnel's). */
export function followUpsLineOf(followUps: { items: readonly FollowUpItem[]; overdue: number }): { today: string; late: string | null } {
  const late = followUps.overdue;
  return { today: `${followUps.items.length} para hoy`, late: late > 0 ? ` · ${late} ${late === 1 ? 'atrasado' : 'atrasados'}` : null };
}

/** Who attends a row: the seller who took it; «Sin asignar» when nobody took one that needs a person now; «Dali» while it converses alone. */
export function inboxAttendantOf(prospect: ProspectView, now: Date): InboxAttendant | null {
  if (prospect.assignee) return { kind: 'seller', name: prospect.assignee.name };
  if (inboxSectionOf(prospect, now) === 'now') return { kind: 'unassigned' };
  return prospect.attendedBy === 'dali' ? { kind: 'dali' } : null;
}
