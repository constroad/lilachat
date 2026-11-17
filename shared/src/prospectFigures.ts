import type { panelOf } from './prospectPanel.js';
import { periodStartOf, type BoardPeriod } from './prospectPlan.js';
import type { weekReviewOf } from './prospectReview.js';
import { moneyOf } from './serviceBilling.js';

/**
 * What Dali's sales panel (dl-04) and weekly review (dl-10) say with their numbers, the same on the web and the APK:
 * shares, response times, money, the tables cut to the columns a phone fits (dl-04 v5) and the bars. Money only
 * reaches a space admin: `panelAmountOf` and the review's pill check it. PURE.
 */

type Panel = ReturnType<typeof panelOf>;
type WeekReview = ReturnType<typeof weekReviewOf>;
type TableKey = 'origin' | 'ad' | 'sellers';
type Amount = { currency: string; amount: number };

export type DaliFigureTone = 'neutral' | 'primary' | 'ok' | 'error';
export type PanelCount = { key: string; label: string; value: number; percent?: string; tone: DaliFigureTone };
export type PanelTable = { head: string[]; rows: { key: string; cells: string[] }[] };
export type PanelBar = { key: string; label: string; value: number; share: number };
export type ReviewFigure = { key: string; label: string; value: number; pill?: string; note?: string; tone: DaliFigureTone };
export type ReviewLoss = { key: string; label: string; count: number; action: string; share: number };

const PERCENT = 100;
const NO_VALUE = '—';
const MINUTE_S = 60;
const HOUR_MIN = 60;
/** Up to two hours a response time is said in minutes; then in hours. */
const LONG_MINUTES = 2 * HOUR_MIN;
const DEFAULT_CURRENCY = 'PEN';
const HOUR_MS = 3_600_000;
const LIMA_OFFSET_MS = -5 * HOUR_MS;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** A phone keeps the columns that fit in 390 dp (dl-04 v5: prospects and conversion); the rest is for a wide screen. */
export const PANEL_PHONE_COLUMNS: Record<TableKey, readonly number[]> = { origin: [0, 1, 4, 5], ad: [0, 1, 3], sellers: [0, 1, 3, 5] };
const HEADS: Record<TableKey, readonly string[]> = {
  origin: ['Origen', 'Prosp.', 'Calif.', 'Cotiz.', 'Ganados', 'Conv.'],
  ad: ['Anuncio', 'Prosp.', 'Calif.', 'Ganados', 'Solo consulta'],
  sellers: ['Vendedor', 'Asignados', 'Respondió', 'A tiempo', 'Cotizó', 'Ganó'],
};

/** «28 %» of the whole; a dash when there is nothing to divide. */
export const figurePercentOf = (part: number, whole: number): string => (whole ? `${Math.round((part / whole) * PERCENT)} %` : NO_VALUE);

const minutesText = (minutes: number): string => (minutes < LONG_MINUTES ? `${minutes} min` : `${Math.round(minutes / HOUR_MIN)} h`);
const secondsText = (seconds: number): string => (seconds < MINUTE_S ? `${seconds} s` : minutesText(Math.round(seconds / MINUTE_S)));

/** «8 s» for Dali and «14 min» for the team: the way a person says a response time; a dash when nobody answered. */
export function responseTimesOf(first: Panel['firstResponse']): { dali: string; team: string } {
  return { dali: first.daliSeconds === null ? NO_VALUE : secondsText(first.daliSeconds), team: first.sellerMinutes === null ? NO_VALUE : minutesText(first.sellerMinutes) };
}

/** «S/ 96,000.00», each other currency on its own («S/ 1,000.00 + USD 250.00»); empty when nothing was won with an amount. */
export const wonAmountsText = (amounts: readonly Amount[]): string =>
  amounts.map((one) => (one.currency === DEFAULT_CURRENCY ? moneyOf(one.amount) : `${one.currency} ${one.amount.toFixed(2)}`)).join(' + ');

/** The amount won is an admin's (nobody else receives amounts): `null` hides the figure. */
export const panelAmountOf = (totals: Panel['totals'], admin: boolean): string | null => (admin ? wonAmountsText(totals.amountWon) || moneyOf(0) : null);

/** The four counts of the cohort, each step with its share of the prospects; the won in green once there are any. */
export function panelCountsOf(totals: Panel['totals']): PanelCount[] {
  const share = (value: number) => figurePercentOf(value, totals.prospects);
  return [
    { key: 'prospectos', label: 'Prospectos', value: totals.prospects, tone: 'neutral' },
    { key: 'calificados', label: 'Calificados', value: totals.qualified, percent: share(totals.qualified), tone: 'neutral' },
    { key: 'cotizados', label: 'Cotizados', value: totals.quoted, percent: share(totals.quoted), tone: 'neutral' },
    { key: 'ganados', label: 'Ganados', value: totals.won, percent: share(totals.won), tone: totals.won ? 'ok' : 'neutral' },
  ];
}

function tableOf(key: TableKey, rows: { key: string; cells: (string | number)[] }[], phone: boolean): PanelTable {
  const kept = (cells: readonly string[]): string[] => (phone ? PANEL_PHONE_COLUMNS[key].map((index) => cells[index] ?? '') : [...cells]);
  return { head: kept(HEADS[key]), rows: rows.map((row) => ({ key: row.key, cells: kept(row.cells.map(String)) })) };
}

/** «Por origen», «Por anuncio» and «Vendedores», cut to the columns that fit on a phone. */
export function panelTablesOf(panel: Panel, phone: boolean): Record<TableKey, PanelTable> {
  const origin = panel.byOrigin.map((row) => ({ key: row.key, cells: [row.label, row.prospects, row.qualified, row.quoted, row.won, figurePercentOf(row.won, row.prospects)] }));
  const ad = panel.byAd.map((row) => ({ key: row.title, cells: [row.title, row.prospects, row.qualified, row.won, row.onlyAsked] }));
  const sellers = panel.sellers.map((row) => ({ key: row.id, cells: [row.name, row.assigned, row.answered, row.onTime, row.quoted, row.won] }));
  return { origin: tableOf('origin', origin, phone), ad: tableOf('ad', ad, phone), sellers: tableOf('sellers', sellers, phone) };
}

/** The scale of a list of bars that are all zero: they draw empty, never divided by zero. */
const EMPTY_SCALE = 1;
const barsOf = (rows: readonly Omit<PanelBar, 'share'>[], max: number): PanelBar[] => rows.map((row) => ({ ...row, share: max ? Math.round((row.value / max) * PERCENT) : 0 }));
const highestOf = (rows: readonly { value: number }[]): number => Math.max(EMPTY_SCALE, ...rows.map((row) => row.value));

/** The funnel against the prospects; the intents and the reasons of the losses against their biggest one. */
export function panelBarsOf(panel: Panel): { funnel: PanelBar[]; intents: PanelBar[]; lossReasons: PanelBar[] } {
  const { totals } = panel;
  const funnel = [
    { key: 'prospects', label: 'Prospectos', value: totals.prospects },
    { key: 'qualified', label: 'Calificados', value: totals.qualified },
    { key: 'quoted', label: 'Cotizados', value: totals.quoted },
    { key: 'won', label: 'Ganados', value: totals.won },
  ];
  const intents = panel.intents.map((row) => ({ key: row.key, label: row.label, value: row.count }));
  const losses = panel.lossReasons.map((row) => ({ key: row.key, label: row.label, value: row.count }));
  return { funnel: barsOf(funnel, totals.prospects), intents: barsOf(intents, highestOf(intents)), lossReasons: barsOf(losses, highestOf(losses)) };
}

const limaDayOf = (at: number): Date => new Date(at + LIMA_OFFSET_MS);
const dayText = (day: Date): string => `${day.getUTCDate()} de ${MONTHS[day.getUTCMonth()]}`;

/** The days a period covers in Lima, under the panel's choice (dl-04 v5): «1 al 17 de noviembre», «17 de noviembre». */
export function panelRangeOf(period: BoardPeriod, now: Date): string {
  const start = limaDayOf(Date.parse(periodStartOf(period, now)));
  const end = limaDayOf(now.getTime());
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth && start.getUTCDate() === end.getUTCDate()) return dayText(end);
  return `${sameMonth ? start.getUTCDate() : dayText(start)} al ${dayText(end)}`;
}

/** The review's five figures (dl-10 v3): the amount won beside the count only for an admin; a tone only when there is something. */
export function reviewFiguresOf(review: WeekReview, admin: boolean): ReviewFigure[] {
  const won = admin ? wonAmountsText(review.won.amounts) : '';
  const asked = review.questions.reduce((total, one) => total + one.count, 0);
  const lateQuotes = review.quotesWithoutFollowUp.late;
  return [
    { key: 'ganados', label: 'Ganados', value: review.won.count, pill: won || undefined, note: review.won.by.length ? `Cerró ${review.won.by.join(', ')}` : undefined, tone: 'neutral' },
    { key: 'perdidos', label: 'Se perdieron', value: review.lost.count, tone: 'neutral' },
    { key: 'tarde', label: 'Respondimos tarde', value: review.late.count, note: 'A un caliente, después de 15 min', tone: review.late.count ? 'error' : 'neutral' },
    { key: 'sin-seguimiento', label: 'Cotizaciones sin seguimiento', value: review.quotesWithoutFollowUp.count, note: lateQuotes ? `${lateQuotes} sin respuesta hace más de 3 días` : undefined, tone: 'neutral' },
    { key: 'no-supo', label: 'Dali no supo responder', value: asked, tone: asked ? 'primary' : 'neutral' },
  ];
}

/** Each reason the week lost, with its share of the lost and the ACTION the team takes for it. */
export function reviewLossesOf(review: WeekReview): ReviewLoss[] {
  const lost = review.lost.count;
  return review.lost.reasons.map((reason) => ({ key: reason.key, label: reason.label, count: reason.count, action: reason.action, share: lost ? Math.round((reason.count / lost) * PERCENT) : 0 }));
}
