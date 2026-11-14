import type { FormField, FormValues } from './appForms.js';

/**
 * Splitting a total among the ticked rows of a list (José 13/11: «debe permitir seleccionar varias
 * partidas y ofrecer repartir el monto, debe ser inteligente»). PURE: the APK and the web.
 * Amounts are worked in cents, so 100 among three is 33.33 + 33.33 + 33.34, never 99.99: each row is
 * rounded and the LAST one takes what is left (Portal's rule, agentes 13/11), so the cards agree to the cent.
 */

const CENTS = 100;
const PERCENT = 100;
const HALF_CENT = 0.005;
const toCents = (amount: number) => Math.round(amount * CENTS);
const fromCents = (cents: number) => cents / CENTS;

/** `x-split` on the list (agentes 13/11): the weight of each partida, and the field whose answer asks to split by them. */
export type SplitHint = { weights: Record<string, number>; modeField: string; weightedValue: string };
/** The list that splits a total: the rows keyed by a tick, beside it a number named like a number of the form. */
export type SplitPlan = { list: string; amount: string; total: string; hint?: SplitHint };

const HINT_WEIGHTS_MAX = 60;
const isWeight = (weight: unknown): weight is number => typeof weight === 'number' && Number.isFinite(weight) && weight >= 0;

/** What the app sent in `x-split`: weights that are numbers and not negative, and the two names that tie them to a mode. */
export function splitHintOf(raw: unknown): SplitHint | undefined {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const { modeField, weightedValue } = body;
  if (typeof modeField !== 'string' || !modeField || typeof weightedValue !== 'string' || !weightedValue) return undefined;
  const given = body.weights && typeof body.weights === 'object' ? Object.entries(body.weights) : [];
  const weights = Object.fromEntries(given.filter(([, weight]) => isWeight(weight)).slice(0, HINT_WEIGHTS_MAX)) as Record<string, number>;
  return Object.keys(weights).length ? { weights, modeField, weightedValue } : undefined;
}

/** The list field's part of it: nothing without a usable hint. */
export function splitFieldOf(raw: unknown): { split?: SplitHint } {
  const split = splitHintOf(raw);
  return split ? { split } : {};
}

export function splitOf(fields: readonly FormField[]): SplitPlan | null {
  for (const field of fields) {
    if (field.kind !== 'list' || !field.pickBy) continue;
    const amount = field.fields.find((child) => child.kind === 'number');
    const total = amount && fields.find((other) => other.kind === 'number' && other.name === amount.name);
    if (amount && total) return { list: field.name, amount: amount.name, total: total.name, ...(field.split ? { hint: field.split } : {}) };
  }
  return null;
}

/**
 * The total shared by weights, to the cent, by Portal's rule: each row rounded and the LAST row with weight takes what is
 * left, so the sum is exact. A row with no weight gets nothing; no weights at all (or none that count), equal shares.
 */
export function splitByWeights(total: number, weights: readonly number[]): number[] {
  const counted = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const shares = counted.some((weight) => weight > 0) ? counted : counted.map(() => 1);
  const weightSum = shares.reduce((sum, weight) => sum + weight, 0);
  const cents = Math.max(0, toCents(total));
  const last = shares.reduce((at, weight, index) => (weight > 0 ? index : at), -1);
  let left = cents;
  return shares.map((weight, index) => {
    // A few cents among many rows must not go negative: a row never takes more than is left.
    const part = index === last ? left : Math.min(left, weight > 0 ? Math.round((cents * weight) / weightSum) : 0);
    left -= part;
    return fromCents(part);
  });
}

/** The total in equal parts, to the cent; the last row takes the leftover cents. */
export const splitEvenly = (total: number, count: number): number[] => splitByWeights(total, Array.from({ length: Math.max(0, count) }, () => 1));

/** The rows the person typed (`typed`) stay; the others share what is left of the total (by `weights`, else equally), never below zero. */
export function rebalanceSplit(total: number, amounts: readonly number[], typed: readonly boolean[], weights?: readonly number[]): number[] {
  const free = amounts.map((_, index) => index).filter((index) => !typed[index]);
  if (free.length === 0) return [...amounts];
  const fixedCents = amounts.reduce((sum, amount, index) => (typed[index] ? sum + toCents(amount) : sum), 0);
  const shares = splitByWeights(fromCents(Math.max(0, toCents(total) - fixedCents)), free.map((index) => weights?.[index] ?? 1));
  const next = [...amounts];
  free.forEach((index, at) => {
    next[index] = shares[at]!;
  });
  return next;
}

/** How much of the total the rows take, and how much is missing (negative: over). */
export function splitStatus(total: number, amounts: readonly number[]): { assigned: number; missing: number } {
  const assigned = amounts.reduce((sum, amount) => sum + toCents(amount), 0);
  return { assigned: fromCents(assigned), missing: fromCents(toCents(total) - assigned) };
}

const amountOf = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : 0;
};

/** The rows with their amounts: the typed ones (by their tick) stay, the others share the rest (by the partidas' `weights` when given). No total yet, no change. */
export function splitRows(rows: readonly FormValues[], plan: SplitPlan, key: string, total: number, typed: ReadonlySet<string>, weights?: Readonly<Record<string, number>>): FormValues[] {
  if (!(total > 0)) return [...rows];
  const isTyped = rows.map((row) => typed.has(String(row[key])));
  const amounts = rebalanceSplit(total, rows.map((row) => amountOf(row[plan.amount])), isTyped, weights && rows.map((row) => weights[String(row[key])] ?? 0));
  return rows.map((row, index) => (isTyped[index] ? row : { ...row, [plan.amount]: amounts[index] }));
}

/** The amounts of the rows, as numbers (a typed «300» or «300,5» counts). */
export function rowAmounts(rows: readonly FormValues[], amount: string): number[] {
  return rows.map((row) => amountOf(row[amount]));
}

/** An amount typed by hand in a row: that row (by its tick) is kept from then on, and the rest adjusts. */
export function typedAfterEdit(typed: ReadonlySet<string>, plan: SplitPlan | undefined, cell: string, tick: unknown): ReadonlySet<string> {
  return plan && cell === plan.amount ? new Set(typed).add(String(tick)) : typed;
}

/** A row's share of the total in whole percent (design gst-02: «Materiales (60 %)»); none without a total. */
export function sharePercent(amount: number, total: number): number | null {
  if (!Number.isFinite(amount) || !(total > 0)) return null;
  return Math.round((amount / total) * PERCENT);
}

/** The rows already add up to the total, to the cent: the app's own rows are kept as they came. */
export const splitBalanced = (total: number, rows: readonly FormValues[], plan: SplitPlan): boolean => Math.abs(splitStatus(total, rowAmounts(rows, plan.amount)).missing) < HALF_CENT;

/** What a split line says (José 13/11): all assigned, what is missing, or what is over. */
export function splitLineOf(total: number, rows: readonly FormValues[], plan: SplitPlan, unit?: string): { text: string; tone: 'ok' | 'warn' | 'error' | 'neutral' } {
  const money = (amount: number) => `${unit ? `${unit} ` : ''}${amount.toFixed(2)}`;
  if (!(total > 0)) return { text: 'Escribe el monto y se reparte solo.', tone: 'neutral' };
  const status = splitStatus(total, rowAmounts(rows, plan.amount));
  if (Math.abs(status.missing) < HALF_CENT) return { text: `Asignado ${money(status.assigned)} de ${money(total)}`, tone: 'ok' };
  // José 13/11: a split must match the total to the cent; what is missing blocks, like what is over.
  if (status.missing > 0) return { text: `Faltan ${money(status.missing)} por asignar de ${money(total)}`, tone: 'error' };
  return { text: `Sobran ${money(-status.missing)}: baja alguna partida`, tone: 'error' };
}

/** The split a list draws: its plan, the total typed so far and its unit; none when the list splits nothing. */
export type ListSplit = { plan: SplitPlan; total: number; unit?: string; /** The answer of the field that picks the mode (`x-split`), and the weights only while that mode asks for them. */ mode?: string; weights?: Readonly<Record<string, number>> };
export function splitFor(fields: readonly FormField[], values: FormValues, list: string): ListSplit | undefined {
  const plan = splitOf(fields);
  if (!plan || plan.list !== list) return undefined;
  const total = fields.find((field) => field.name === plan.total);
  const mode = plan.hint ? String(values[plan.hint.modeField] ?? '') : undefined;
  const weights = plan.hint && mode === plan.hint.weightedValue ? plan.hint.weights : undefined;
  return { plan, total: amountOf(values[plan.total]), unit: total?.kind === 'number' ? total.unit : undefined, ...(mode === undefined ? {} : { mode }), ...(weights ? { weights } : {}) };
}

/**
 * The error that stops sending a split that does not match its total to the cent (José 13/11). A list
 * with no rows, or no total yet, splits nothing: the expense stays general. PURE.
 */
export function splitErrorOf(fields: readonly FormField[], values: FormValues): Record<string, string> {
  const plan = splitOf(fields);
  const rows = plan && Array.isArray(values[plan.list]) ? (values[plan.list] as FormValues[]) : [];
  if (!plan || rows.length === 0) return {};
  const total = amountOf(values[plan.total]);
  if (!(total > 0)) return {};
  const unit = fields.find((field) => field.name === plan.total);
  const money = (amount: number) => `${unit?.kind === 'number' && unit.unit ? `${unit.unit} ` : ''}${amount.toFixed(2)}`;
  const status = splitStatus(total, rowAmounts(rows, plan.amount));
  if (Math.abs(status.missing) < HALF_CENT) return {};
  const message = status.missing > 0
    ? `Repartiste ${money(status.assigned)} de ${money(total)}: faltan ${money(status.missing)} por asignar.`
    : `Sobran ${money(-status.missing)}: baja alguna partida.`;
  return { [plan.list]: message };
}
