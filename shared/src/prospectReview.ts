import { compareNames } from './compareText.js';
import { HOT_SCORE, lacksNextAction, overdueOf, prospectNameOf, shownStageOf, type ProspectView } from './prospectBoard.js';
import { periodStartOf } from './prospectPlan.js';
import { LOSS_REASON_LABEL, LOSS_REASONS, type LossReason } from './prospectSeller.js';

/**
 * The weekly review (dl-10, «Revisión»): the last whole week in Lima, Monday to Sunday. What was won and lost (with an
 * ACTION per reason), who got a late answer, quotes nobody follows, what Dali could not answer, and the conversations
 * worth reading in the meeting. Computed by Lilachat from the prospects; Dali's own card in #general goes beside it.
 * The «causes» and the WhatsApp sync line Stitch drew have no source and are not computed. PURE.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const LIMA_OFFSET_MS = -5 * HOUR_MS;
const WEEK_DAYS = 7;
/** 1970-01-01 was a Thursday: day numbers shifted by 3 start the week on Monday. */
const MONDAY_SHIFT = 3;
const LATE_ANSWER_MS = 15 * MINUTE_MS;
/** A prospect Dali was asking that stopped writing: worth reading after 3 days. */
const DROPPED_MS = 3 * DAY_MS;
const TO_REVIEW_MAX = 5;
const QUESTIONS_MAX = 10;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** What the team changes for each reason it lost (the design's «Acción»). */
export const LOSS_ACTION: Record<LossReason, string> = {
  price: 'Cotizar el mismo día',
  timing: 'Agendar el seguimiento para la fecha que dijo',
  zone: 'Decir la zona en el anuncio',
  competitor: 'Responder en la primera hora',
  no_answer: 'Llamar el día 4 de la secuencia',
  not_a_buyer: 'Filtrar las consultas desde el anuncio',
  other: 'Revisarlo en la reunión',
};

export type ReviewTag = 'late' | 'following' | 'dropped';
export const REVIEW_TAG_LABEL: Record<ReviewTag, string> = { late: 'Vencido', following: 'Seguimiento', dropped: 'Dejó de escribir' };

const time = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);
const dayNumber = (at: number): number => Math.floor((at + LIMA_OFFSET_MS) / DAY_MS);

/** The last whole week (Monday to Sunday, Lima) before today, and how it is said: «9 al 15 de noviembre». */
export function reviewWeekOf(now: Date): { from: string; to: string; label: string } {
  const today = dayNumber(now.getTime());
  const monday = today - ((today + MONDAY_SHIFT) % WEEK_DAYS) - WEEK_DAYS;
  const from = monday * DAY_MS - LIMA_OFFSET_MS;
  const to = from + WEEK_DAYS * DAY_MS;
  const [start, end] = [new Date(from + LIMA_OFFSET_MS), new Date(to - DAY_MS + LIMA_OFFSET_MS)];
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const label = `${start.getUTCDate()}${sameMonth ? '' : ` de ${MONTHS[start.getUTCMonth()]}`} al ${end.getUTCDate()} de ${MONTHS[end.getUTCMonth()]}`;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), label };
}

/** How far back the space's board asks: the month, the last 7 days or the review week, whichever starts first. */
export function boardSinceOf(now: Date): string {
  const starts = [periodStartOf('month', now), periodStartOf('week', now), reviewWeekOf(now).from];
  return starts.reduce((first, one) => (one < first ? one : first));
}

/** A hot prospect a person answered after 15 min (or never), counted from when it was ready or first wrote. */
function answeredLate(prospect: ProspectView, now: Date): boolean {
  if ((prospect.score ?? 0) < HOT_SCORE) return false;
  const start = time(prospect.readyAt ?? prospect.firstContactAt);
  if (!Number.isFinite(start)) return false;
  const answer = time(prospect.firstTeamReply?.at);
  return (Number.isFinite(answer) ? answer : now.getTime()) - start > LATE_ANSWER_MS;
}

function lossReasonsOf(lost: readonly ProspectView[]) {
  const rows = LOSS_REASONS.map((key) => ({ key, label: LOSS_REASON_LABEL[key], action: LOSS_ACTION[key], count: lost.filter((one) => one.result?.reason === key).length }));
  return rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
}

/** The questions Dali could not answer in the week, the same question once with how many asked it. */
function questionsOf(prospects: readonly ProspectView[], inWeek: (iso: string) => boolean) {
  const counted = new Map<string, { question: string; count: number }>();
  for (const one of prospects.flatMap((prospect) => prospect.unanswered ?? []).filter((one) => inWeek(one.at))) {
    const key = one.question.toLowerCase().replace(/[¿?¡!.,\s]+/g, ' ').trim();
    const entry = counted.get(key) ?? { question: one.question, count: 0 };
    counted.set(key, { ...entry, count: entry.count + 1 });
  }
  return [...counted.values()].sort((a, b) => b.count - a.count || compareNames(a.question, b.question)).slice(0, QUESTIONS_MAX);
}

/** Why a conversation is worth reading in the meeting, if it is. */
function reviewTagOf(prospect: ProspectView, now: Date): ReviewTag | null {
  const overdue = overdueOf(prospect, now);
  if (overdue?.kind === 'to_quote_late' || overdue?.kind === 'hot_unanswered') return 'late';
  if (overdue?.kind === 'quote_unanswered') return 'following';
  const quiet = now.getTime() - time(prospect.lastContactAt) > DROPPED_MS;
  return !prospect.result && shownStageOf(prospect) === 'missing_info' && quiet ? 'dropped' : null;
}

function wonOf(won: readonly ProspectView[]) {
  const amounts = new Map<string, number>();
  for (const one of won) if (one.quote?.amount !== undefined) amounts.set(one.quote.currency ?? 'PEN', (amounts.get(one.quote.currency ?? 'PEN') ?? 0) + one.quote.amount);
  const by = [...new Set(won.flatMap((one) => (one.result?.by?.name ? [one.result.by.name] : [])))];
  return { count: won.length, amounts: [...amounts].map(([currency, amount]) => ({ currency, amount })), by };
}

/** The review of the last whole week. */
export function weekReviewOf(prospects: readonly ProspectView[], now: Date) {
  const week = reviewWeekOf(now);
  const inWeek = (iso: string | undefined) => time(iso) >= time(week.from) && time(iso) < time(week.to);
  const closedIn = (outcome: 'won' | 'lost') => prospects.filter((one) => one.result?.outcome === outcome && inWeek(one.result.at));
  const lost = closedIn('lost');
  const late = prospects.filter((one) => inWeek(one.readyAt ?? one.firstContactAt ?? one.createdAt) && answeredLate(one, now));
  const quiet = prospects.filter((one) => !one.result && shownStageOf(one) === 'quoted' && lacksNextAction(one));
  const toReview = prospects.flatMap((one) => { const tag = reviewTagOf(one, now); return tag ? [{ prospect: one, name: prospectNameOf(one), tag }] : []; });
  return {
    week,
    won: wonOf(closedIn('won')),
    lost: { count: lost.length, reasons: lossReasonsOf(lost) },
    late: { count: late.length },
    quotesWithoutFollowUp: { count: quiet.length, late: quiet.filter((one) => overdueOf(one, now)?.kind === 'quote_unanswered').length },
    questions: questionsOf(prospects, inWeek),
    toReview: toReview.slice(0, TO_REVIEW_MAX),
  };
}
