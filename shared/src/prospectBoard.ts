import { compareNames } from './compareText.js';
import { shownProspectPhone, type ProspectAttendedBy, type ProspectSource } from './prospects.js';
import { PROSPECT_STAGES, type ProspectField, type ProspectFollowUpDraft, type ProspectIntent, type ProspectKind, type ProspectQuestion, type ProspectQuote, type ProspectService, type ProspectStage } from './prospectInsight.js';
import type { LossReason, NextActionKind, ProspectOutcome } from './prospectSeller.js';

/**
 * Dali's inbox and funnel (dl-01 and dl-08 of BOTS-API «Fase 2»): which prospects need a person now, what each
 * one is missing and what is overdue. The rules are constants of the code, never data of the base (Pipedrive's
 * «rotting»). The web and the APK draw what these return. PURE.
 */

/** A prospect as the space's members receive it. `quote.amount` only reaches a space admin. */
export type ProspectView = {
  id: string;
  chatId: string;
  name?: string;
  phone: string;
  lastActivityAt: string;
  attendedBy: ProspectAttendedBy;
  source?: ProspectSource;
  stage?: ProspectStage;
  service?: ProspectService;
  intent?: ProspectIntent;
  score?: number;
  scoreReasons?: string[];
  fields?: ProspectField[];
  missing?: string[];
  readyAt?: string;
  kind?: ProspectKind;
  summary?: string;
  followUpDraft?: ProspectFollowUpDraft;
  quote?: ProspectQuote;
  unanswered?: ProspectQuestion[];
  assignee?: { id: string; name: string };
  nextAction?: { kind: NextActionKind; at: string; assigneeId: string; note?: string };
  result?: { outcome: ProspectOutcome; reason?: LossReason; note?: string; at: string; by?: { id: string; name: string } };
  version: number;
  firstContactAt?: string;
  lastContactAt?: string;
  firstDaliReplyAt?: string;
  firstTeamReply?: { at: string; userId: string };
  lastTeamReplyAt?: string;
  createdAt: string;
  /** A direct 1:1, not a sales prospect (José 20/11): agentes sets it when it is not really a lead. Defaults to a prospect. */
  listing?: 'prospect' | 'chat';
};

/** A file the client sent in their channel (José 17/11: a KML, a photo or a PDF with metrados). `seq` opens it in the chat. */
export type ProspectDocument = { seq: number; kind: 'image' | 'video' | 'file'; name: string; mime: string; url: string; at: string };

export type ProspectLevel = 'hot' | 'warm' | 'cold';
export type Overdue = { kind: 'to_quote_late' | 'quote_unanswered' | 'hot_unanswered'; since: string };
export type InboxSection = 'now' | 'following' | 'dali';
export type InboxView = 'mine' | 'unassigned' | 'all';

export const HOT_SCORE = 70;
export const WARM_SCORE = 40;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Ready to quote and nobody quoted in a day. */
const TO_QUOTE_LATE_MS = DAY_MS;
/** The quote went out and the client did not write back in 3 days. */
const QUOTE_UNANSWERED_MS = 3 * DAY_MS;
/** A hot prospect wrote and no person answered in 15 min (HBR 2011: the first hour qualifies ~7 times more). */
const HOT_REPLY_MS = 15 * MINUTE_MS;
const LIMA_OFFSET_MS = -5 * HOUR_MS;

export const STAGE_LABEL: Record<ProspectStage, string> = {
  missing_info: 'Falta información',
  to_quote: 'Por cotizar',
  visit: 'Visita',
  quoted: 'Cotización enviada',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
};
export const LEVEL_LABEL: Record<ProspectLevel, string> = { hot: 'Caliente', warm: 'Tibio', cold: 'Frío' };
export const INTENT_LABEL: Record<ProspectIntent, string> = { purchase: 'Quiere comprar', quote: 'Pide cotización', information: 'Solo consulta', other: 'Otro' };
export const INBOX_SECTION_LABEL: Record<InboxSection, string> = { now: 'Atender ahora', following: 'En seguimiento', dali: 'Dali conversando' };
const INBOX_SECTIONS: readonly InboxSection[] = ['now', 'following', 'dali'];
const FOLLOWED_STAGES: readonly ProspectStage[] = ['visit', 'quoted', 'negotiation'];

const time = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);
const isOpen = (prospect: ProspectView): boolean => !prospect.result;
/** A direct 1:1 agentes marked `listing: 'chat'` is not a lead: the inbox, funnel, panel and review never count it. */
export const isSalesProspect = (prospect: Pick<ProspectView, 'listing'>): boolean => prospect.listing !== 'chat';
export const prospectNameOf = (prospect: Pick<ProspectView, 'name' | 'phone'>): string => prospect.name ?? shownProspectPhone(prospect.phone);

/** A chat of the space's Chats tab, from the app/web's own chat summary (only what this needs to sort it). */
export type DaliChatRef = { id: string; whatsapp?: true };
export type DaliChatSections<T extends DaliChatRef> = { directs: T[]; whatsappGroups: T[] };

/**
 * Dali's Chats tab (José 20/11, via agentes): direct 1:1s (the team's, and a direct prospect
 * `listing:'chat'`) apart from WhatsApp groups (fase 1) — a sales prospect is in neither.
 */
export function daliChatSections<T extends DaliChatRef>(chats: readonly T[], prospects: readonly Pick<ProspectView, 'chatId' | 'listing'>[]): DaliChatSections<T> {
  const prospectOfChat = new Map(prospects.map((prospect) => [prospect.chatId, prospect]));
  const directs: T[] = [];
  const whatsappGroups: T[] = [];
  for (const chat of chats) {
    if (chat.whatsapp) {
      whatsappGroups.push(chat);
      continue;
    }
    const prospect = prospectOfChat.get(chat.id);
    if (!prospect || !isSalesProspect(prospect)) directs.push(chat);
  }
  return { directs, whatsappGroups };
}

/** The Chats tab, unread first (José 23/11: scrolling to guess which one is unread); stable, so recency keeps ordering within each group. */
export function unreadFirst<T extends { unread: number }>(chats: readonly T[]): T[] {
  return [...chats].sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0));
}

export type DaliTabUnread = { inbox: number; chats: number };

/**
 * A small mark on the Bandeja/Chats tabs (José 20/11, via agentes: «ninguna marca, punto o contador,
 * cuando llegan mensajes nuevos»): a sales prospect's unread counts for Bandeja, everything else
 * `daliChatSections` would show in Chats (direct chats, WhatsApp groups) counts for Chats.
 */
export function daliTabUnread(chats: readonly (DaliChatRef & { unread: number })[], prospects: readonly Pick<ProspectView, 'chatId' | 'listing'>[]): DaliTabUnread {
  const prospectOfChat = new Map(prospects.map((prospect) => [prospect.chatId, prospect]));
  let inbox = 0;
  let chatsUnread = 0;
  for (const chat of chats) {
    const prospect = prospectOfChat.get(chat.id);
    if (!chat.whatsapp && prospect && isSalesProspect(prospect)) inbox += chat.unread;
    else chatsUnread += chat.unread;
  }
  return { inbox, chats: chatsUnread };
}

/** The stage on screen: the result a seller marked wins over agentes' stage; reopening brings agentes' back. */
export const shownStageOf = (prospect: Pick<ProspectView, 'stage' | 'result'>): ProspectStage => prospect.result?.outcome ?? prospect.stage ?? 'missing_info';

export function levelOf(score: number | undefined): ProspectLevel | null {
  if (score === undefined) return null;
  if (score >= HOT_SCORE) return 'hot';
  return score >= WARM_SCORE ? 'warm' : 'cold';
}

const PLATFORM_LABEL: Record<NonNullable<ProspectSource['platform']>, string> = { instagram: 'Instagram', facebook: 'Facebook' };

/** `key` stays «meta» for every paid ad (the panel buckets by it, José 20/11: platform doesn't split its costs);
 * the label names Instagram or Facebook once agentes sends it, else the generic «Meta». */
export const originOf = (prospect: Pick<ProspectView, 'source'>): { key: 'meta' | 'direct'; label: string } =>
  prospect.source?.kind === 'ctwa' ? { key: 'meta', label: prospect.source.platform ? PLATFORM_LABEL[prospect.source.platform] : 'Meta' } : { key: 'direct', label: 'Directo' };

function toQuoteLate(prospect: ProspectView, now: Date): Overdue | null {
  const late = shownStageOf(prospect) === 'to_quote' && now.getTime() - time(prospect.readyAt) > TO_QUOTE_LATE_MS;
  return late && prospect.readyAt ? { kind: 'to_quote_late', since: prospect.readyAt } : null;
}

/** Sent and quiet: the client has not written since the quote went out. */
function quoteQuiet(prospect: ProspectView): string | null {
  const sentAt = prospect.quote?.sentAt;
  if (shownStageOf(prospect) !== 'quoted' || !sentAt) return null;
  return time(prospect.lastContactAt) > time(sentAt) ? null : sentAt;
}

function quoteUnanswered(prospect: ProspectView, now: Date): Overdue | null {
  const sentAt = quoteQuiet(prospect);
  return sentAt && now.getTime() - time(sentAt) > QUOTE_UNANSWERED_MS ? { kind: 'quote_unanswered', since: sentAt } : null;
}

/** A person answered after the client's last message, or a quote went out after it: then it waits on the client. */
const teamAnswered = (prospect: ProspectView): boolean => {
  const answered = Math.max(time(prospect.lastTeamReplyAt) || 0, time(prospect.quote?.sentAt) || 0);
  return answered > 0 && answered >= time(prospect.lastContactAt);
};

function hotUnanswered(prospect: ProspectView, now: Date): Overdue | null {
  if (levelOf(prospect.score) !== 'hot' || !prospect.lastContactAt || teamAnswered(prospect)) return null;
  return now.getTime() - time(prospect.lastContactAt) > HOT_REPLY_MS ? { kind: 'hot_unanswered', since: prospect.lastContactAt } : null;
}

/** What is late on an open prospect, the most urgent first; a closed one is never late. */
export function overdueOf(prospect: ProspectView, now: Date): Overdue | null {
  if (!isOpen(prospect)) return null;
  return hotUnanswered(prospect, now) ?? toQuoteLate(prospect, now) ?? quoteUnanswered(prospect, now);
}

/** «Ningún prospecto sin próxima acción»: an open prospect with neither a next action nor a follow-up Dali drafted. */
export const lacksNextAction = (prospect: ProspectView): boolean => isOpen(prospect) && !prospect.nextAction && !prospect.followUpDraft;

/** A person attends it (Dali paused) and the client wrote after the team's last answer. */
const waitingOnTeam = (prospect: ProspectView): boolean => prospect.attendedBy === 'human' && Boolean(prospect.lastContactAt) && !teamAnswered(prospect);

export function inboxSectionOf(prospect: ProspectView, now: Date): InboxSection {
  const overdue = overdueOf(prospect, now);
  const stage = shownStageOf(prospect);
  if ((overdue && overdue.kind !== 'quote_unanswered') || waitingOnTeam(prospect)) return 'now';
  if (!prospect.assignee && (stage === 'to_quote' || levelOf(prospect.score) === 'hot')) return 'now';
  if (prospect.assignee || prospect.nextAction || FOLLOWED_STAGES.includes(stage) || overdue) return 'following';
  return 'dali';
}

/** «Solo consultas» (dl-01): a plain question Dali answers alone, nobody took and nothing is late on. */
const isOnlyConsult = (prospect: ProspectView, now: Date): boolean => prospect.intent === 'information' && !prospect.assignee && inboxSectionOf(prospect, now) === 'dali';

const byRecent = (a: ProspectView, b: ProspectView) => time(b.lastActivityAt) - time(a.lastActivityAt);
const byScore = (a: ProspectView, b: ProspectView) => (b.score ?? -1) - (a.score ?? -1) || byRecent(a, b);
const byNextAction = (a: ProspectView, b: ProspectView) => (time(a.nextAction?.at) || Infinity) - (time(b.nextAction?.at) || Infinity) || byRecent(a, b);
const SECTION_ORDER: Record<InboxSection, (a: ProspectView, b: ProspectView) => number> = { now: byScore, following: byNextAction, dali: byRecent };

const inView = (prospect: ProspectView, view: InboxView, me: string): boolean =>
  view === 'all' || (view === 'mine' ? prospect.assignee?.id === me : !prospect.assignee);

/** The services of the open prospects, the busiest first: the filter of the inbox and the funnel. */
function servicesOf(prospects: readonly ProspectView[]): { key: string; name: string; count: number }[] {
  const counted = new Map<string, { key: string; name: string; count: number }>();
  for (const { service } of prospects) {
    if (!service) continue;
    const entry = counted.get(service.key) ?? { ...service, count: 0 };
    counted.set(service.key, { ...entry, count: entry.count + 1 });
  }
  return [...counted.values()].sort((a, b) => b.count - a.count || compareNames(a.name, b.name));
}

/** The inbox (dl-01): open prospects only, by section, with the counts of the three views. */
export function inboxOf(prospects: readonly ProspectView[], params: { me: string; view: InboxView; service?: string }, now: Date) {
  const open = prospects.filter(isSalesProspect).filter(isOpen);
  const ofService = params.service ? open.filter((prospect) => prospect.service?.key === params.service) : open;
  const counts = { mine: ofService.filter((one) => inView(one, 'mine', params.me)).length, unassigned: ofService.filter((one) => !one.assignee).length, all: ofService.length };
  const shown = ofService.filter((prospect) => inView(prospect, params.view, params.me));
  const consults = shown.filter((one) => isOnlyConsult(one, now)).sort(byRecent);
  const working = shown.filter((one) => !isOnlyConsult(one, now));
  const sections = INBOX_SECTIONS.map((key) => ({ key, label: INBOX_SECTION_LABEL[key], items: working.filter((one) => inboxSectionOf(one, now) === key).sort(SECTION_ORDER[key]) }));
  return { counts, sections: sections.filter((section) => section.items.length > 0), consults, services: servicesOf(open) };
}

/** The last instant of today in Lima. */
function endOfLimaDay(now: Date): number {
  const limaClock = now.getTime() + LIMA_OFFSET_MS;
  return Math.floor(limaClock / DAY_MS) * DAY_MS + DAY_MS - LIMA_OFFSET_MS;
}

export type FollowUpItem = { prospect: ProspectView; kind: 'action' | 'draft'; at: string };

/** «Seguimientos de hoy» (dl-05): my next actions due by tonight and the follow-ups Dali drafted for today that are mine or nobody's. */
export function followUpsOf(prospects: readonly ProspectView[], me: string, now: Date): { items: FollowUpItem[]; overdue: number } {
  const until = endOfLimaDay(now);
  const items: FollowUpItem[] = [];
  for (const prospect of prospects.filter(isSalesProspect).filter(isOpen)) {
    const action = prospect.nextAction;
    if (action && action.assigneeId === me && time(action.at) <= until) items.push({ prospect, kind: 'action', at: action.at });
    const draft = prospect.followUpDraft;
    const draftAt = draft?.forAt ?? prospect.lastActivityAt;
    if (draft && (!prospect.assignee || prospect.assignee.id === me) && time(draftAt) <= until) items.push({ prospect, kind: 'draft', at: draftAt });
  }
  items.sort((a, b) => time(a.at) - time(b.at));
  return { items, overdue: items.filter((item) => time(item.at) < now.getTime()).length };
}

const lateEntry = (prospect: ProspectView, since: string) => ({ name: prospectNameOf(prospect), since });

/** The funnel (dl-08): open prospects and the ones closed since the period started, by stage, with its four figures. */
export function funnelOf(prospects: readonly ProspectView[], params: { since: string; service?: string }, now: Date) {
  const since = time(params.since);
  const sales = prospects.filter(isSalesProspect);
  const inPeriod = sales.filter((prospect) => isOpen(prospect) || time(prospect.result?.at) >= since);
  const shown = params.service ? inPeriod.filter((prospect) => prospect.service?.key === params.service) : inPeriod;
  const open = shown.filter(isOpen);
  const columns = PROSPECT_STAGES.map((stage) => ({ stage, label: STAGE_LABEL[stage], items: shown.filter((one) => shownStageOf(one) === stage).sort(byRecent) }));
  const toQuote = open.filter((one) => shownStageOf(one) === 'to_quote');
  const quiet = open.filter((one) => quoteQuiet(one) !== null);
  const figures = {
    missingInfo: open.filter((one) => shownStageOf(one) === 'missing_info').length,
    toQuote: { count: toQuote.length, late: toQuote.flatMap((one) => (toQuoteLate(one, now) ? [lateEntry(one, one.readyAt ?? '')] : [])) },
    quoteUnanswered: { count: quiet.length, late: quiet.flatMap((one) => { const late = quoteUnanswered(one, now); return late ? [lateEntry(one, late.since)] : []; }) },
    withoutNextAction: open.filter(lacksNextAction).map(prospectNameOf),
  };
  return { columns, figures, open: open.length, newSince: shown.filter((one) => time(one.createdAt) >= since).length };
}

/** What Dali still has to ask, with the label agentes sent, or the key made readable. */
export function missingLabelsOf(prospect: Pick<ProspectView, 'missing' | 'fields'>): string[] {
  const labels = new Map((prospect.fields ?? []).map((field) => [field.key, field.label]));
  return (prospect.missing ?? []).map((key) => labels.get(key) ?? key.replace(/_/g, ' '));
}
