/**
 * The detail of a client's service (José, 30/10: there was no way to see a
 * service's reports, orders and dispatches): agentes answers
 * `client.service.requested` with what Portal keeps for it, in the same
 * request, and nothing is stored. Labels and tones are Portal's, so there is
 * no second table to keep in sync. PURE: server, app and web.
 */
export const DETAIL_TONES = ['ok', 'info', 'warn', 'error', 'neutral'] as const;
export type DetailTone = (typeof DETAIL_TONES)[number];
export type DetailStatus = { label: string; tone: DetailTone };
export type ServiceOrder = { id: string; date?: string; product?: string; quantity?: number; unit?: string; status: DetailStatus; url?: string };
export type ServiceDispatch = { id: string; orderId?: string; at?: string; plate?: string; driver?: string; quantity?: number; unit?: string; status: DetailStatus; guideUrl?: string; url?: string };
export type ServiceReport = { id: string; title: string; typeLabel?: string; date?: string; status: DetailStatus; pdfUrl?: string; url?: string };
export type ServiceQuote = { id: string; code?: string; date?: string; total?: number; status: DetailStatus; url?: string };
export type DetailTotals = { orders: number; dispatches: number; reports: number; quotes?: number };
export type ServiceDetail = {
  service: { id: string; name: string; stageLabel?: string; progress?: number; url?: string };
  orders: ServiceOrder[];
  dispatches: ServiceDispatch[];
  reports: ServiceReport[];
  /** Portal leaves them out where amounts are not shown (a group, like the client channel): no tab then. */
  quotes?: ServiceQuote[];
  totals: DetailTotals;
};
export type DetailTabKey = 'orders' | 'dispatches' | 'reports' | 'quotes';

const LIST_MAX = 100;
const TIME_ZONE = 'America/Lima';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const https = (value: unknown) => (typeof value === 'string' && value.startsWith('https://') ? value : undefined);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);
const dateOnly = (value: unknown) => (typeof value === 'string' && DATE_ONLY.test(value) ? value : undefined);
const instant = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined);
/** Drops the keys whose value did not validate, so the wire shape stays tight. */
const defined = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, one]) => one !== undefined)) as T;

const statusOf = (raw: Raw): DetailStatus => ({ label: text(raw.status_label) ?? '—', tone: DETAIL_TONES.includes(raw.tone as DetailTone) ? (raw.tone as DetailTone) : 'neutral' });

const orderOf = (raw: Raw): ServiceOrder => defined({ id: text(raw.id)!, date: dateOnly(raw.date), product: text(raw.product), quantity: count(raw.quantity), unit: text(raw.unit), status: statusOf(raw), url: https(raw.url) });
const dispatchOf = (raw: Raw): ServiceDispatch =>
  defined({ id: text(raw.id)!, orderId: text(raw.order_id), at: instant(raw.at), plate: text(raw.plate), driver: text(raw.driver), quantity: count(raw.quantity), unit: text(raw.unit), status: statusOf(raw), guideUrl: https(raw.guide_url), url: https(raw.url) });
const reportOf = (raw: Raw): ServiceReport => defined({ id: text(raw.id)!, title: text(raw.title) ?? 'Informe', typeLabel: text(raw.type_label), date: dateOnly(raw.date), status: statusOf(raw), pdfUrl: https(raw.pdf_url), url: https(raw.url) });
const quoteOf = (raw: Raw): ServiceQuote => defined({ id: text(raw.id)!, code: text(raw.code), date: dateOnly(raw.date), total: count(raw.total), status: statusOf(raw), url: https(raw.url) });

function listOf<T>(value: unknown, parse: (raw: Raw) => T): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((one) => {
    const raw = record(one);
    return raw && text(raw.id) ? [parse(raw)] : [];
  }).slice(0, LIST_MAX);
}

/** agentes' 200 body, validated (https links only, a known tone or neutral, 100 per list). `null` if it is not that shape. */
export function serviceDetailOf(body: unknown): ServiceDetail | null {
  const input = record(body);
  const service = record(input?.service);
  const orders = listOf(input?.orders, orderOf);
  const dispatches = listOf(input?.dispatches, dispatchOf);
  const reports = listOf(input?.reports, reportOf);
  if (!input || !service || !text(service.id) || !orders || !dispatches || !reports) return null;
  const quotes = input.quotes === undefined ? undefined : (listOf(input.quotes, quoteOf) ?? undefined);
  const totals = record(input.totals) ?? {};
  return {
    service: defined({ id: text(service.id)!, name: text(service.name) ?? 'Servicio', stageLabel: text(service.stage_label), progress: count(service.progress), url: https(service.url) }),
    orders,
    dispatches,
    reports,
    ...(quotes ? { quotes } : {}),
    totals: defined({ orders: count(totals.orders) ?? orders.length, dispatches: count(totals.dispatches) ?? dispatches.length, reports: count(totals.reports) ?? reports.length, quotes: quotes ? (count(totals.quotes) ?? quotes.length) : undefined }),
  };
}

/** «12 oct» from «2026-10-12», read as a calendar day: no time zone can move it to the 11th. */
export function dayOf(date: string): string {
  const [, , month, day] = DATE_ONLY.exec(date) ?? [];
  return month && day ? `${Number(day)} ${MONTHS[Number(month) - 1]}` : date;
}

let clock: Intl.DateTimeFormat | null = null;
let limaDay: Intl.DateTimeFormat | null = null;

/** «12 oct, 9:05 a. m.» in Lima; the formatters are built once (Hermes, OOM 30/10). */
export function dayAndTimeOf(iso: string): string {
  const at = new Date(iso);
  const day = (limaDay ??= new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })).format(at);
  const time = (clock ??= new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })).format(at);
  // ICU puts narrow no-break spaces in «a. m.»; plain spaces read the same everywhere.
  return `${dayOf(day)}, ${time.replace(/[\u00a0\u202f]/g, ' ')}`;
}

const amount = (quantity?: number, unit?: string) => (quantity === undefined ? undefined : `${quantity}${unit ? ` ${unit}` : ''}`);
const joined = (parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

/** «Asfalto MAC 2 · 24 m³ · 12 oct»; a pedido has no number of its own in Portal. */
export const orderLine = (order: ServiceOrder): string => joined([order.product ?? 'Pedido', amount(order.quantity, order.unit), order.date ? dayOf(order.date) : 'sin fecha']);

/** «ABC-123 · 12 m³ · 12 oct, 9:05 a. m.»: the departure, or the planned hour if it has not left. */
export const dispatchLine = (dispatch: ServiceDispatch): string => joined([dispatch.plate ?? 'Despacho', amount(dispatch.quantity, dispatch.unit), dispatch.at ? dayAndTimeOf(dispatch.at) : undefined]);

/** «Mostrando 100 de 148» when Portal has more than it sent; the rest is in Portal. */
export const moreInPortal = (shown: number, total: number): string | null => (total > shown ? `Mostrando ${shown} de ${total}` : null);

const TAB_NAMES: Record<DetailTabKey, string> = { orders: 'Pedidos', dispatches: 'Despachos', reports: 'Informes', quotes: 'Cotizaciones' };

/** The detail's tabs with Portal's real counts; «Cotizaciones» only when they came. */
export function detailTabs(detail: ServiceDetail): { key: DetailTabKey; label: string }[] {
  const keys: DetailTabKey[] = ['orders', 'dispatches', 'reports', ...(detail.quotes ? (['quotes'] as const) : [])];
  return keys.map((key) => ({ key, label: `${TAB_NAMES[key]} · ${detail.totals[key] ?? 0}` }));
}
