import { limaDayKey } from './birthdays.js';
/**
 * A client's service collection (José 30/10, design f-05): agentes sends
 * `billing` inside `client.service.requested`, only in the private view
 * (where amounts are shown). Shape closed with Portal (e7d3ffd7): all in
 * soles, days as «YYYY-MM-DD», `due_at` only on credit. Lilachat stores
 * nothing and counts the days itself, in Lima. PURE: server, app and web.
 */
export type BillingItem = { name: string; total?: number; invoiced: boolean };
export type BillingPayment = { date: string; amount: number; method?: string; reference?: string; voucherUrl?: string };
export type ServiceBilling = {
  /** What the service expects to collect (Portal's Finanzas tab). */
  total?: number;
  isCredit: boolean;
  dueAt?: string;
  collected: number;
  pending?: number;
  /** As Portal sends it: 0.04 or 4 both mean 4 %. Absent when 0. */
  detractionRate?: number;
  items: BillingItem[];
  payments: BillingPayment[];
};
export type DueTone = 'warn' | 'error';

const LIST_MAX = 100;
const DAY_MS = 86_400_000;
const PERCENT = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);
const positive = (value: unknown) => (amount(value) ? (value as number) : undefined);
const dayOnly = (value: unknown) => (typeof value === 'string' && DATE_ONLY.test(value) ? value : undefined);
const https = (value: unknown) => (typeof value === 'string' && value.startsWith('https://') ? value : undefined);
const defined = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, one]) => one !== undefined)) as T;

function listOf<T>(value: unknown, parse: (raw: Raw) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((one) => {
    const raw = record(one);
    const parsed = raw ? parse(raw) : null;
    return parsed ? [parsed] : [];
  }).slice(0, LIST_MAX);
}

const itemOf = (raw: Raw): BillingItem | null => {
  const name = text(raw.name);
  return name ? defined({ name, total: amount(raw.total), invoiced: raw.invoiced === true }) : null;
};

const paymentOf = (raw: Raw): BillingPayment | null => {
  const date = dayOnly(raw.date);
  const paid = positive(raw.amount);
  return date && paid ? defined({ date, amount: paid, method: text(raw.method), reference: text(raw.reference), voucherUrl: https(raw.voucher_url) }) : null;
};

/** agentes' `billing`, validated; `null` when it is not an object. A billing with no payment yet is still a billing. */
export function billingOf(value: unknown): ServiceBilling | null {
  const raw = record(value);
  if (!raw) return null;
  const isCredit = raw.is_credit === true;
  return defined({
    total: amount(raw.total),
    isCredit,
    dueAt: isCredit ? dayOnly(raw.due_at) : undefined,
    collected: amount(raw.collected) ?? 0,
    pending: amount(raw.pending),
    detractionRate: positive(raw.detraction_rate),
    items: listOf(raw.items, itemOf),
    payments: listOf(raw.payments, paymentOf),
  });
}

const cents = (value: number) => Math.round(value * PERCENT) / PERCENT;
const rateOf = (rate: number) => (rate > 1 ? rate / PERCENT : rate);

/** What the «Estado de cobranza» card shows: Portal's pending (or the total minus what was collected) and collected over total. */
export function billingSummary(billing: ServiceBilling): { pending?: number; progress?: number; detraction?: number; detractionPercent?: number; paidOff: boolean } {
  const { total, collected, detractionRate } = billing;
  if (total === undefined) return { paidOff: false };
  const pending = billing.pending ?? Math.max(0, cents(total - collected));
  const progress = total > 0 ? Math.min(PERCENT, Math.round((collected / total) * PERCENT)) : 0;
  const rate = detractionRate === undefined ? undefined : rateOf(detractionRate);
  return defined({ pending, progress, detraction: rate === undefined ? undefined : cents(total * rate), detractionPercent: rate === undefined ? undefined : cents(rate * PERCENT), paidOff: pending === 0 });
}

/** «en 16 días», «vence mañana», «vence hoy», «venció hace 10 días»: calendar days in Lima. */
export function dueStatus(dueDay: string, now: Date): { label: string; tone: DueTone } {
  const days = Math.round((Date.parse(dueDay) - Date.parse(limaDayKey(now))) / DAY_MS);
  if (days > 1) return { label: `en ${days} días`, tone: 'warn' };
  if (days === 1) return { label: 'vence mañana', tone: 'warn' };
  if (days === 0) return { label: 'vence hoy', tone: 'error' };
  return { label: days === -1 ? 'venció ayer' : `venció hace ${-days} días`, tone: 'error' };
}

let decimals: Intl.NumberFormat | null = null;

/** «S/ 48,380.00»; the formatter is built once (Hermes, OOM 30/10). */
export const moneyOf = (value: number): string => `S/ ${(decimals ??= new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).format(value)}`;
