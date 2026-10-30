import { limaDayKey } from './birthdays.js';
import { quoteOf, statusOf, type DetailStatus, type ServiceQuote } from './serviceDetail.js';
/**
 * A client's account (José 30/10: where are the client's quotes; design
 * f-08): agentes answers `client.account.requested` (cf37b98, Portal
 * 0227a1f0) with ALL the client's quotes and its orders on credit. A list
 * that does not come is one that person may not see. PURE: server, app, web.
 */
export type AccountQuote = ServiceQuote & { serviceId?: string };
export type CreditOrder = { id: string; serviceId?: string; date?: string; product?: string; quantity?: number; unit?: string; total?: number; dueAt?: string; collected?: number; pending?: number; status: DetailStatus };
export type ClientAccount = { client: { id: string; name: string }; quotes?: AccountQuote[]; creditOrders?: CreditOrder[]; pending?: number; totals: { quotes?: number; creditOrders?: number } };

const LIST_MAX = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);
const day = (value: unknown) => (typeof value === 'string' && DATE_ONLY.test(value) ? value : undefined);
const defined = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, one]) => one !== undefined)) as T;

function listOf<T>(value: unknown, parse: (raw: Raw) => T): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((one) => {
    const raw = record(one);
    return raw && text(raw.id) ? [parse(raw)] : [];
  }).slice(0, LIST_MAX);
}

const accountQuoteOf = (raw: Raw): AccountQuote => defined({ ...quoteOf(raw), serviceId: text(raw.service_id) });
const creditOrderOf = (raw: Raw): CreditOrder =>
  defined({ id: text(raw.id)!, serviceId: text(raw.service_id), date: day(raw.date), product: text(raw.product), quantity: count(raw.quantity), unit: text(raw.unit), total: count(raw.total), dueAt: day(raw.due_at), collected: count(raw.collected), pending: count(raw.pending), status: statusOf(raw) });

/** agentes' 200 body, validated; `null` without a client. */
export function clientAccountOf(body: unknown): ClientAccount | null {
  const input = record(body);
  const client = record(input?.client);
  if (!input || !client || !text(client.id)) return null;
  const totals = record(input.totals) ?? {};
  return defined({
    client: { id: text(client.id)!, name: text(client.name) ?? 'Cliente' },
    quotes: listOf(input.quotes, accountQuoteOf),
    creditOrders: listOf(input.credit_orders, creditOrderOf),
    pending: count(input.pending),
    totals: defined({ quotes: count(totals.quotes), creditOrders: count(totals.credit_orders) }),
  });
}

const LAST_DUE = '9999-12-31';
const dueRank = (order: CreditOrder) => order.dueAt ?? LAST_DUE;
/** Plain string order: `localeCompare` in Hermes ran the Slack mode out of memory (c0a6ecc). */
const byDue = (a: CreditOrder, b: CreditOrder) => (dueRank(a) < dueRank(b) ? -1 : dueRank(a) > dueRank(b) ? 1 : 0);

/** Overdue first (the oldest due first), then the next to fall due, then those with no due day. */
export const creditOrdersByUrgency = (orders: readonly CreditOrder[], now: Date): CreditOrder[] => {
  const today = limaDayKey(now);
  const overdue = (order: CreditOrder) => (order.dueAt !== undefined && order.dueAt < today ? 0 : 1);
  return [...orders].sort((a, b) => overdue(a) - overdue(b) || byDue(a, b));
};

/** «Total por cobrar» is Portal's (all credit orders, not just the 100 listed); «vencido» adds those past due today in Lima. */
export function accountSummary(account: ClientAccount, now: Date): { pending?: number; overdue: number; onCredit: number } {
  const today = limaDayKey(now);
  const orders = account.creditOrders ?? [];
  const overdue = orders.reduce((sum, order) => sum + (order.dueAt !== undefined && order.dueAt < today ? (order.pending ?? 0) : 0), 0);
  return defined({ pending: account.pending, overdue, onCredit: account.totals.creditOrders ?? orders.length });
}
