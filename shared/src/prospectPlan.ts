import { HOT_SCORE, shownStageOf, type Overdue, type ProspectView } from './prospectBoard.js';
import type { NextActionKind } from './prospectSeller.js';

/**
 * Planning a Dali prospect's next step (dl-09 «Próxima acción», dl-01 rows): when (in Lima time), what Dali suggests
 * and where the follow-up sequence goes. The sequence is the one of the design (day 0 quote, day 2 WhatsApp, day 4 call,
 * day 7 last message, day 10 closed as «No respondió»); every message still needs a seller's approval. PURE.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const LIMA_OFFSET_MS = -5 * HOUR_MS;
const WORK_START_HOUR = 9;
/** «Hoy» is offered until this hour: later, the next action is tomorrow. */
const LAST_TODAY_HOUR = 19;
/** «Hoy» leaves at least an hour to get to it: 10:12 offers 12:00. */
const TODAY_MARGIN_HOURS = 2;
const FAR_IN_DAYS = 3;
const WEEK_DAYS = 7;

export type WhenOption = { key: 'today' | 'tomorrow' | 'later'; label: string; at: string };
export type FollowUpStep = { day: number; label: string; state: 'done' | 'current' | 'next' };
export type Suggestion = { kind: NextActionKind; at: string; reason: string };

export const FOLLOW_UP_STEPS: readonly { day: number; label: string }[] = [
  { day: 0, label: 'Cotización' },
  { day: 2, label: 'WhatsApp' },
  { day: 4, label: 'Llamada' },
  { day: 7, label: 'Último mensaje' },
  { day: 10, label: 'Se cierra como «No respondió»' },
];

const limaClock = (at: number): Date => new Date(at + LIMA_OFFSET_MS);
const limaDayNumber = (at: number): number => Math.floor((at + LIMA_OFFSET_MS) / DAY_MS);
/** The instant of `hour`:00 in Lima, `daysAhead` days after today. */
function limaAt(now: Date, daysAhead: number, hour: number): string {
  return new Date((limaDayNumber(now.getTime()) + daysAhead) * DAY_MS + hour * HOUR_MS - LIMA_OFFSET_MS).toISOString();
}
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** «Cuándo»: today at a round hour with margin (until 19:00), tomorrow at 9:00 and in 3 days at 9:00. */
export function whenOptions(now: Date): WhenOption[] {
  const hour = limaClock(now.getTime()).getUTCHours() + TODAY_MARGIN_HOURS;
  const today: WhenOption[] = hour <= LAST_TODAY_HOUR ? [{ key: 'today', label: `Hoy ${hour}:00`, at: limaAt(now, 0, hour) }] : [];
  return [...today, { key: 'tomorrow', label: `Mañana ${WORK_START_HOUR}:00`, at: limaAt(now, 1, WORK_START_HOUR) }, { key: 'later', label: `En ${FAR_IN_DAYS} días`, at: limaAt(now, FAR_IN_DAYS, WORK_START_HOUR) }];
}

const daysSince = (iso: string, now: Date): number => Math.max(0, limaDayNumber(now.getTime()) - limaDayNumber(Date.parse(iso)));

/** Where the follow-up of a sent quote goes; nothing without a quote or once there is a result. */
export function followUpSequenceOf(prospect: Pick<ProspectView, 'quote' | 'result'>, now: Date): FollowUpStep[] | null {
  const sentAt = prospect.quote?.sentAt;
  if (!sentAt || prospect.result) return null;
  const days = daysSince(sentAt, now);
  const current = FOLLOW_UP_STEPS.reduce((reached, step, index) => (step.day <= days ? index : reached), 0);
  return FOLLOW_UP_STEPS.map((step, index) => ({ ...step, state: index < current ? 'done' : index === current ? 'current' : 'next' }));
}

const kindOfStep = (step: { label: string }): NextActionKind => (step.label === 'Llamada' ? 'call' : 'whatsapp');

/** After a quote: today's step of the sequence when it is due, else the next one; never in the past. */
function quotedSuggestion(sentAt: string, now: Date): Suggestion {
  const days = daysSince(sentAt, now);
  const quiet = `La cotización lleva ${plural(days, 'día', 'días')} sin respuesta.`;
  if (days >= WEEK_DAYS) return { kind: 'call', at: limaAt(now, 1, WORK_START_HOUR), reason: `${quiet} Si no contesta, ciérralo como «No respondió».` };
  const due = days > 0 ? FOLLOW_UP_STEPS.find((one) => one.day === days) : undefined;
  if (due) return { kind: kindOfStep(due), at: whenOptions(now)[0]!.at, reason: quiet };
  const step = FOLLOW_UP_STEPS.find((one) => one.day > days)!;
  return { kind: kindOfStep(step), at: limaAt(now, step.day - days, WORK_START_HOUR), reason: days === 0 ? 'La cotización salió hoy: el siguiente paso es en dos días.' : quiet };
}

/** «Dali sugiere» (dl-09): a next action with its reason, from rules; nothing while Dali still asks or once closed. */
export function suggestNextAction(prospect: ProspectView, now: Date): Suggestion | null {
  if (prospect.result) return null;
  const stage = shownStageOf(prospect);
  const soon = whenOptions(now)[0]!.at;
  if (stage === 'to_quote') {
    const hours = prospect.readyAt ? Math.floor((now.getTime() - Date.parse(prospect.readyAt)) / HOUR_MS) : 0;
    return { kind: 'quote', at: soon, reason: hours > 0 ? `Está listo para cotizar hace ${plural(hours, 'hora', 'horas')}.` : 'Ya tiene lo necesario para cotizar.' };
  }
  if (stage === 'visit') return { kind: 'visit', at: limaAt(now, 1, WORK_START_HOUR), reason: 'Pidió una visita técnica: confirma el día.' };
  if (stage === 'quoted' && prospect.quote?.sentAt) return quotedSuggestion(prospect.quote.sentAt, now);
  if (stage === 'negotiation') return { kind: 'call', at: soon, reason: 'Está negociando: confirma lo que falta para cerrar.' };
  return (prospect.score ?? 0) >= HOT_SCORE ? { kind: 'call', at: soon, reason: 'Es caliente: una llamada hoy lo califica más rápido.' } : null;
}

export type BoardPeriod = 'today' | 'week' | 'month';
export const PERIOD_LABEL: Record<BoardPeriod, string> = { today: 'Hoy', week: '7 días', month: 'Este mes' };

/** Where a panel period starts in Lima: today, the last 7 days (today included) or this month. */
export function periodStartOf(period: BoardPeriod, now: Date): string {
  const today = limaDayNumber(now.getTime());
  if (period !== 'month') return new Date((today - (period === 'week' ? WEEK_DAYS - 1 : 0)) * DAY_MS - LIMA_OFFSET_MS).toISOString();
  const clock = limaClock(now.getTime());
  return new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), 1) - LIMA_OFFSET_MS).toISOString();
}

/** «148 este mes» over the phone inbox (dl-01 v3): the prospects born this month in Lima, whatever became of them. */
export function arrivedThisMonth(prospects: readonly ProspectView[], now: Date): number {
  const since = Date.parse(periodStartOf('month', now));
  return prospects.filter((prospect) => Date.parse(prospect.createdAt) >= since).length;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** A row's time (dl-01): «hace 6 min», «10:15» today, «Ayer», «hace 3 días» or «18/11». */
export function prospectTimeOf(iso: string, now: Date): string {
  const at = Date.parse(iso);
  const elapsed = now.getTime() - at;
  if (elapsed < MINUTE_MS) return 'ahora';
  if (elapsed < HOUR_MS) return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  const days = limaDayNumber(now.getTime()) - limaDayNumber(at);
  const clock = limaClock(at);
  if (days <= 0) return `${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
  if (days === 1) return 'Ayer';
  if (days < WEEK_DAYS) return `hace ${days} días`;
  return `${pad(clock.getUTCDate())}/${pad(clock.getUTCMonth() + 1)}`;
}

/** Up to an hour in minutes, up to two days in hours, then in days: «30 min», «27 horas», «5 días». */
function agoOf(elapsed: number): string {
  if (elapsed < HOUR_MS) return `${Math.max(1, Math.floor(elapsed / MINUTE_MS))} min`;
  if (elapsed < 2 * DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), 'hora', 'horas');
  return plural(Math.floor(elapsed / DAY_MS), 'día', 'días');
}

/** What is late, said the way a row says it. */
export function overdueLabelOf(overdue: Overdue, now: Date): string {
  const ago = agoOf(now.getTime() - Date.parse(overdue.since));
  if (overdue.kind === 'to_quote_late') return `Listo hace ${ago} · sin cotización`;
  if (overdue.kind === 'quote_unanswered') return `Cotización sin respuesta hace ${ago}`;
  return `Escribió hace ${ago} y nadie le respondió`;
}

/** «Hoy 16:00», «Mañana 09:00», «jue 19, 10:00»: when a next action is due. */
export function nextActionWhenOf(iso: string, now: Date): string {
  const at = Date.parse(iso);
  const days = limaDayNumber(at) - limaDayNumber(now.getTime());
  const clock = limaClock(at);
  const time = `${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Mañana ${time}`;
  if (days === -1) return `Ayer ${time}`;
  const weekday = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][clock.getUTCDay()];
  return `${weekday} ${clock.getUTCDate()}, ${time}`;
}
