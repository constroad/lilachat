import type { FormField, FormValues } from './appForms.js';

/**
 * Splitting a total among the ticked rows of a list (José 13/11: «debe permitir seleccionar varias
 * partidas y ofrecer repartir el monto, debe ser inteligente»). PURE: the APK and the web.
 * Amounts are worked in cents, so 100 among three is 33.34 + 33.33 + 33.33, never 99.99.
 */

const CENTS = 100;
const HALF_CENT = 0.005;
const toCents = (amount: number) => Math.round(amount * CENTS);
const fromCents = (cents: number) => cents / CENTS;

/** The list that splits a total: the rows keyed by a tick, beside it a number named like a number of the form. */
export type SplitPlan = { list: string; amount: string; total: string };

export function splitOf(fields: readonly FormField[]): SplitPlan | null {
  for (const field of fields) {
    if (field.kind !== 'list' || !field.pickBy) continue;
    const amount = field.fields.find((child) => child.kind === 'number');
    const total = amount && fields.find((other) => other.kind === 'number' && other.name === amount.name);
    if (amount && total) return { list: field.name, amount: amount.name, total: total.name };
  }
  return null;
}

/** The total in equal parts, to the cent; the leftover cents go to the first rows. */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.max(0, toCents(total));
  const base = Math.floor(cents / count);
  const leftover = cents - base * count;
  return Array.from({ length: count }, (_, index) => fromCents(base + (index < leftover ? 1 : 0)));
}

/** The rows the person typed (`typed`) stay; the others share what is left of the total, never below zero. */
export function rebalanceSplit(total: number, amounts: readonly number[], typed: readonly boolean[]): number[] {
  const free = amounts.map((_, index) => index).filter((index) => !typed[index]);
  if (free.length === 0) return [...amounts];
  const fixedCents = amounts.reduce((sum, amount, index) => (typed[index] ? sum + toCents(amount) : sum), 0);
  const shares = splitEvenly(fromCents(Math.max(0, toCents(total) - fixedCents)), free.length);
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

/** The rows with their amounts: the typed ones (by their tick) stay, the others share the rest. No total yet, no change. */
export function splitRows(rows: readonly FormValues[], plan: SplitPlan, key: string, total: number, typed: ReadonlySet<string>): FormValues[] {
  if (!(total > 0)) return [...rows];
  const isTyped = rows.map((row) => typed.has(String(row[key])));
  const amounts = rebalanceSplit(total, rows.map((row) => amountOf(row[plan.amount])), isTyped);
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

/** What a split line says (José 13/11): all assigned, what is missing, or what is over. */
export function splitLineOf(total: number, rows: readonly FormValues[], plan: SplitPlan, unit?: string): { text: string; tone: 'ok' | 'warn' | 'error' | 'neutral' } {
  const money = (amount: number) => `${unit ? `${unit} ` : ''}${amount.toFixed(2)}`;
  if (!(total > 0)) return { text: 'Escribe el monto y se reparte solo.', tone: 'neutral' };
  const status = splitStatus(total, rowAmounts(rows, plan.amount));
  if (Math.abs(status.missing) < HALF_CENT) return { text: `Asignado ${money(status.assigned)} de ${money(total)}`, tone: 'ok' };
  // José 12/11: what no partida takes stays as a general expense of the service; it can be sent.
  if (status.missing > 0) return { text: `Sin asignar ${money(status.missing)} de ${money(total)}: queda como gasto general`, tone: 'warn' };
  return { text: `Sobran ${money(-status.missing)}: baja alguna partida`, tone: 'error' };
}

/** The split a list draws: its plan, the total typed so far and its unit; none when the list splits nothing. */
export type ListSplit = { plan: SplitPlan; total: number; unit?: string };
export function splitFor(fields: readonly FormField[], values: FormValues, list: string): ListSplit | undefined {
  const plan = splitOf(fields);
  if (!plan || plan.list !== list) return undefined;
  const total = fields.find((field) => field.name === plan.total);
  return { plan, total: amountOf(values[plan.total]), unit: total?.kind === 'number' ? total.unit : undefined };
}
