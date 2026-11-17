import { lacksNextAction, missingLabelsOf, overdueOf, type funnelOf, type ProspectView } from './prospectBoard.js';
import type { ProspectStage } from './prospectInsight.js';
import { nextActionWhenOf, overdueLabelOf } from './prospectPlan.js';
import { NEXT_ACTION_LABEL } from './prospectSeller.js';
import { moneyOf } from './serviceBilling.js';

/**
 * What the funnel (dl-08, v5 on a phone) says about its figures, its period and each card: the four figures that
 * need someone with who is late and since when, «N nuevos … · N abiertos», the stage the phone board opens on, and
 * the lines of a card. The amount of a quote only for a space admin. The web and the APK draw the same. PURE.
 */

type Funnel = ReturnType<typeof funnelOf>;
type Late = readonly { name: string; since: string }[];
export type FunnelPeriod = 'week' | 'month';
export type FunnelFigure = { key: 'missing_info' | 'to_quote' | 'quote_unanswered' | 'without_next_action'; value: number; title: string; alert: string; hint: string; danger: boolean };
export type FunnelCardView = {
  missing: string | null;
  overdue: string | null;
  quote: { code: string; amount: string | null } | null;
  needsNextAction: boolean;
  /** Dali converses alone: nobody took it yet. */
  daliAlone: boolean;
  foot: { assignee: string | null; text: string } | null;
};

const HOUR_MS = 3_600_000;
const HOURS_A_DAY = 24;
/** Under two days, «27 h»; from there, «4 días». */
const HOURS_SAID_AS_HOURS = 2 * HOURS_A_DAY;
/** The names a figure lists before it gets too long for its tile. */
const NAMES_SHOWN = 3;

/** «27 h» under two days, then «4 días»: how the funnel says since when something is late. */
export function funnelAgoOf(since: string, now: Date): string {
  const hours = Math.max(1, Math.round((now.getTime() - Date.parse(since)) / HOUR_MS));
  return hours < HOURS_SAID_AS_HOURS ? `${hours} h` : `${Math.floor(hours / HOURS_A_DAY)} días`;
}

/** «1 vencido hace 27 h (Víctor Soto)»: how many, since when the first one, and who. */
function lateLineOf(late: Late, words: { one: string; many: string }, now: Date): string {
  const first = late[0];
  if (!first) return '';
  return `${late.length} ${late.length === 1 ? words.one : words.many} hace ${funnelAgoOf(first.since, now)} (${late.map((entry) => entry.name).join(', ')})`;
}

/** The four figures that need someone (dl-08), in the design's order. */
export function funnelFiguresOf(figures: Funnel['figures'], now: Date): FunnelFigure[] {
  const without = figures.withoutNextAction;
  return [
    { key: 'missing_info', value: figures.missingInfo, title: 'Falta información', alert: '', hint: 'Dali las está preguntando', danger: false },
    { key: 'to_quote', value: figures.toQuote.count, title: 'Por cotizar', alert: lateLineOf(figures.toQuote.late, { one: 'vencido', many: 'vencidos' }, now), hint: '', danger: false },
    { key: 'quote_unanswered', value: figures.quoteUnanswered.count, title: 'Cotización sin respuesta', alert: lateLineOf(figures.quoteUnanswered.late, { one: 'vencida', many: 'vencidas' }, now), hint: '', danger: false },
    { key: 'without_next_action', value: without.length, title: 'Sin próxima acción', alert: '', hint: without.slice(0, NAMES_SHOWN).join(', '), danger: without.length > 0 },
  ];
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** «10 nuevos en los últimos 7 días · 7 abiertos». */
export function funnelSubtitleOf(funnel: Pick<Funnel, 'newSince' | 'open'>, period: FunnelPeriod): string {
  const when = period === 'week' ? 'en los últimos 7 días' : 'este mes';
  return `${plural(funnel.newSince, 'nuevo', 'nuevos')} ${when} · ${plural(funnel.open, 'abierto', 'abiertos')}`;
}

/** Nothing open and nobody closed in the period: the board has nothing to show. */
export const funnelIsEmpty = (funnel: Pick<Funnel, 'open' | 'columns'>): boolean => funnel.open === 0 && funnel.columns.every((column) => column.items.length === 0);

/** The phone board opens on the first stage that holds someone. */
export const firstBusyStageOf = (columns: Funnel['columns']): ProspectStage => columns.find((column) => column.items.length > 0)?.stage ?? 'missing_info';

function footOf(prospect: ProspectView, now: Date): FunnelCardView['foot'] {
  const next = prospect.nextAction;
  const assignee = prospect.assignee?.name ?? null;
  if (next) return { assignee, text: `Próx: ${nextActionWhenOf(next.at, now)} · ${NEXT_ACTION_LABEL[next.kind]}` };
  return assignee ? { assignee, text: assignee } : null;
}

/** The lines of a funnel card: what is missing, what is late, the quote, the call for a next action and the foot. */
export function funnelCardOf(prospect: ProspectView, now: Date, admin: boolean): FunnelCardView {
  const missing = prospect.result ? [] : missingLabelsOf(prospect);
  const overdue = overdueOf(prospect, now);
  const amount = admin && prospect.quote?.amount !== undefined ? moneyOf(prospect.quote.amount) : null;
  return {
    missing: missing.length > 0 ? `Falta: ${missing.join(' · ')}` : null,
    overdue: overdue ? overdueLabelOf(overdue, now) : null,
    quote: prospect.quote ? { code: prospect.quote.code, amount } : null,
    needsNextAction: lacksNextAction(prospect),
    daliAlone: prospect.attendedBy === 'dali' && !prospect.assignee,
    foot: footOf(prospect, now),
  };
}
