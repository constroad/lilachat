import { limaDayKey } from './birthdays.js';
import { moneyOf } from './serviceBilling.js';
import { amount, dayWithYearOf, quoteOf, statusOf, type DetailStatus, type ServiceQuote } from './serviceDetail.js';
/**
 * A client's account (José 30/10: where are the client's quotes; design
 * f-08): agentes answers `client.account.requested` (cf37b98, Portal
 * 0227a1f0) with ALL the client's quotes and its orders on credit. A list
 * that does not come is one that person may not see. PURE: server, app, web.
 */
export type AccountQuote = ServiceQuote & { serviceId?: string };
export type CreditOrder = { id: string; serviceId?: string; date?: string; product?: string; quantity?: number; unit?: string; total?: number; dueAt?: string; collected?: number; pending?: number; status: DetailStatus };
/** A service that owes (José, 05/11); `dueAt` only on credit. */
export type AccountService = { id: string; name?: string; total?: number; collected?: number; pending?: number; isCredit: boolean; dueAt?: string };
export type ClientAccount = { client: { id: string; name: string }; quotes?: AccountQuote[]; creditOrders?: CreditOrder[]; services?: AccountService[]; pending?: number; totals: { quotes?: number; creditOrders?: number; services?: number } };

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
const accountServiceOf = (raw: Raw): AccountService => {
  const isCredit = raw.is_credit === true;
  return defined({ id: text(raw.id)!, name: text(raw.name), total: count(raw.total), collected: count(raw.collected), pending: count(raw.pending), isCredit, dueAt: isCredit ? day(raw.due_at) : undefined });
};

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
    services: listOf(input.services, accountServiceOf),
    pending: count(input.pending),
    totals: defined({ quotes: count(totals.quotes), creditOrders: count(totals.credit_orders), services: count(totals.services) }),
  });
}

const LAST_DUE = '9999-12-31';
type WithDue = { dueAt?: string };
const dueRank = (debt: WithDue) => debt.dueAt ?? LAST_DUE;
/** Plain string order: `localeCompare` in Hermes ran the Slack mode out of memory (c0a6ecc). */
const byDue = (a: WithDue, b: WithDue) => (dueRank(a) < dueRank(b) ? -1 : dueRank(a) > dueRank(b) ? 1 : 0);
const isOverdue = (debt: WithDue, today: string) => debt.dueAt !== undefined && debt.dueAt < today;

/** Overdue first (the oldest due first), then the next to fall due, then those with no due day. */
export const byUrgency = <T extends WithDue>(debts: readonly T[], now: Date): T[] => {
  const today = limaDayKey(now);
  const overdue = (debt: T) => (isOverdue(debt, today) ? 0 : 1);
  return [...debts].sort((a, b) => overdue(a) - overdue(b) || byDue(a, b));
};

/** A row of «Cobranza por servicio»: without a debt, only its name. */
export type CollectionRow = Omit<AccountService, 'name'> & { name: string };
type ChannelService = { id: string; name: string };

/**
 * José 05/11: Cobranza lives in «Cuenta», by service. What owes goes first by
 * urgency; the channel's other services follow, so a paid one still opens.
 */
export function collectionByService(debts: readonly AccountService[] | undefined, services: readonly ChannelService[], now: Date): CollectionRow[] {
  const names = new Map(services.map((service) => [service.id, service.name]));
  const owing = byUrgency(debts ?? [], now).map((debt) => ({ ...debt, name: debt.name ?? names.get(debt.id) ?? 'Servicio' }));
  const shown = new Set(owing.map((row) => row.id));
  return [...owing, ...services.filter((service) => !shown.has(service.id)).map((service) => ({ id: service.id, name: service.name, isCredit: false }))];
}

/** «Total por cobrar» is Portal's (all the debts, not just the 100 listed); «vencido» adds those past due today in Lima. */
export function accountSummary(account: ClientAccount, now: Date): { pending?: number; overdue: number; onCredit: number } {
  const today = limaDayKey(now);
  const orders = account.creditOrders ?? [];
  const services = account.services ?? [];
  const overdue = [...orders, ...services].reduce((sum, debt) => sum + (isOverdue(debt, today) ? (debt.pending ?? 0) : 0), 0);
  const servicesOnCredit = services.filter((service) => service.isCredit).length;
  return defined({ pending: account.pending, overdue, onCredit: (account.totals.creditOrders ?? orders.length) + servicesOnCredit });
}

const joined = (parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
const moneyWith = (label: string, value?: number) => (value === undefined ? undefined : `${label} ${moneyOf(value)}`);

export const creditOrderLine = (order: CreditOrder, now: Date): string =>
  joined([amount(order.quantity, order.unit), order.date && dayWithYearOf(order.date, now), moneyWith('Total', order.total)]);

export const accountQuoteLine = (quote: AccountQuote, now: Date): string =>
  joined([quote.total === undefined ? undefined : moneyOf(quote.total), quote.date && dayWithYearOf(quote.date, now), quote.serviceId ? undefined : 'sin servicio']);

export const accountServiceLine = (service: AccountService): string => joined([moneyWith('Total', service.total), moneyWith('Cobrado', service.collected)]);
