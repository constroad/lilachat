import { billingOf, moneyOf, type ServiceBilling } from './serviceBilling.js';
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
export type OrderGuide = { name: string; url: string };
export type OrderPayment = { date: string; amount: number };
/** Amounts, credit and payments only come under the collection rule (Portal 611e61d7). */
export type ServiceOrder = {
  id: string;
  date?: string;
  product?: string;
  quantity?: number;
  unit?: string;
  status: DetailStatus;
  url?: string;
  site?: string;
  invoice?: string;
  invoiceUrl?: string;
  guides?: OrderGuide[];
  unitPrice?: number;
  total?: number;
  isCredit?: boolean;
  dueAt?: string;
  payments?: OrderPayment[];
};
/** A dispatch's photo or video (Portal's DISPATCH_PICTURES, José 30/10 night). */
export type DispatchPicture = { url: string; thumbUrl?: string; mime: string; name?: string };
/** The truck's cubicaje as the client reads it: «Volquete cubica X m³», its shape and measures. */
export type DispatchCubicage = { m3?: number; shape?: string; dimensions: { label: string; value: string }[] };
export type ServiceDispatch = { id: string; orderId?: string; at?: string; plate?: string; driver?: string; quantity?: number; unit?: string; status: DetailStatus; guideUrl?: string; guideNumber?: string; url?: string; pictures?: DispatchPicture[]; cubicage?: DispatchCubicage };
export type ServiceReport = { id: string; title: string; typeLabel?: string; date?: string; status: DetailStatus; pdfUrl?: string; url?: string };
export type QuoteItem = { name: string; quantity?: number; unit?: string; unitPrice?: number; total?: number };
export type ServiceQuote = { id: string; code?: string; date?: string; total?: number; status: DetailStatus; url?: string; items?: QuoteItem[]; pdfUrl?: string };
export type DetailTotals = { orders: number; dispatches: number; reports: number; quotes?: number };
export type ServiceDetail = {
  service: { id: string; name: string; stageLabel?: string; progress?: number; url?: string };
  orders: ServiceOrder[];
  dispatches: ServiceDispatch[];
  reports: ServiceReport[];
  /** Portal leaves them out where amounts are not shown (a group, like the client channel): no tab then. */
  quotes?: ServiceQuote[];
  /** Same rule as quotes: only in the private view (design f-05). */
  billing?: ServiceBilling;
  totals: DetailTotals;
};
export type DetailTabKey = 'orders' | 'dispatches' | 'reports' | 'quotes' | 'billing';

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

export const statusOf = (raw: Raw): DetailStatus => ({ label: text(raw.status_label) ?? '—', tone: DETAIL_TONES.includes(raw.tone as DetailTone) ? (raw.tone as DetailTone) : 'neutral' });

const guideOf = (one: unknown): OrderGuide[] => {
  const raw = record(one);
  const url = https(raw?.url);
  return url ? [{ name: text(raw?.name) ?? 'Guía', url }] : [];
};
const orderPaymentOf = (one: unknown): OrderPayment[] => {
  const raw = record(one);
  const date = dateOnly(raw?.date);
  const paid = count(raw?.amount);
  return date && paid ? [{ date, amount: paid }] : [];
};
const listMap = <T>(value: unknown, parse: (one: unknown) => T[]) => (Array.isArray(value) ? value.flatMap(parse).slice(0, LIST_MAX) : undefined);
const orderOf = (raw: Raw): ServiceOrder =>
  defined({
    id: text(raw.id)!,
    date: dateOnly(raw.date),
    product: text(raw.product),
    quantity: count(raw.quantity),
    unit: text(raw.unit),
    status: statusOf(raw),
    url: https(raw.url),
    site: text(raw.site),
    invoice: text(raw.invoice),
    invoiceUrl: https(raw.invoice_url),
    guides: listMap(raw.guides, guideOf),
    unitPrice: count(raw.unit_price),
    total: count(raw.total),
    isCredit: typeof raw.is_credit === 'boolean' ? raw.is_credit : undefined,
    dueAt: dateOnly(raw.due_at),
    payments: listMap(raw.payments, orderPaymentOf),
  });
const PICTURES_MAX = 20;
const pictureOf = (one: unknown): DispatchPicture[] => {
  const raw = record(one);
  const url = https(raw?.url);
  return raw && url ? [defined({ url, thumbUrl: https(raw.thumb_url), mime: text(raw.mime) ?? 'application/octet-stream', name: text(raw.name) })] : [];
};
const dimensionOf = (one: unknown) => {
  const raw = record(one);
  const label = text(raw?.label);
  const value = text(raw?.value);
  return label && value ? [{ label, value }] : [];
};
/** `null` when nothing in it says anything. */
function cubicageOf(value: unknown): DispatchCubicage | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const cubicage = { ...defined({ m3: count(raw.m3) || undefined, shape: text(raw.shape) }), dimensions: Array.isArray(raw.dimensions) ? raw.dimensions.flatMap(dimensionOf) : [] };
  return cubicage.m3 !== undefined || cubicage.shape || cubicage.dimensions.length ? cubicage : undefined;
}
const dispatchOf = (raw: Raw): ServiceDispatch =>
  defined({
    id: text(raw.id)!,
    orderId: text(raw.order_id),
    at: instant(raw.at),
    plate: text(raw.plate),
    driver: text(raw.driver),
    quantity: count(raw.quantity),
    unit: text(raw.unit),
    status: statusOf(raw),
    guideUrl: https(raw.guide_url),
    guideNumber: text(raw.guide_number),
    url: https(raw.url),
    pictures: Array.isArray(raw.pictures) ? raw.pictures.flatMap(pictureOf).slice(0, PICTURES_MAX) : undefined,
    cubicage: cubicageOf(raw.cubicage),
  });
const reportOf = (raw: Raw): ServiceReport => defined({ id: text(raw.id)!, title: text(raw.title) ?? 'Informe', typeLabel: text(raw.type_label), date: dateOnly(raw.date), status: statusOf(raw), pdfUrl: https(raw.pdf_url), url: https(raw.url) });
const quoteItemOf = (one: unknown): QuoteItem[] => {
  const raw = record(one);
  const name = text(raw?.name);
  return raw && name ? [defined({ name, quantity: count(raw.quantity), unit: text(raw.unit), unitPrice: count(raw.unit_price), total: count(raw.total) })] : [];
};
/** Its line items only when agentes sends them (private view, `quotes:view`). */
const quoteItemsOf = (value: unknown) => (Array.isArray(value) ? value.flatMap(quoteItemOf).slice(0, LIST_MAX) : undefined);
export const quoteOf = (raw: Raw): ServiceQuote => defined({ id: text(raw.id)!, code: text(raw.code), date: dateOnly(raw.date), total: count(raw.total), status: statusOf(raw), url: https(raw.url), items: quoteItemsOf(raw.items), pdfUrl: https(raw.pdf_url) });

function listOf<T>(value: unknown, parse: (raw: Raw) => T): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((one) => {
    const raw = record(one);
    return raw && text(raw.id) ? [parse(raw)] : [];
  }).slice(0, LIST_MAX);
}

function serviceHeadOf(service: Raw): ServiceDetail['service'] {
  return defined({ id: text(service.id)!, name: text(service.name) ?? 'Servicio', stageLabel: text(service.stage_label), progress: count(service.progress), url: https(service.url) });
}

/** Portal's real counts; the length of what came when it sends none. */
function totalsOf(raw: unknown, lists: Pick<ServiceDetail, 'orders' | 'dispatches' | 'reports' | 'quotes'>): DetailTotals {
  const totals = record(raw) ?? {};
  const { orders, dispatches, reports, quotes } = lists;
  return defined({
    orders: count(totals.orders) ?? orders.length,
    dispatches: count(totals.dispatches) ?? dispatches.length,
    reports: count(totals.reports) ?? reports.length,
    quotes: quotes ? (count(totals.quotes) ?? quotes.length) : undefined,
  });
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
  const billing = billingOf(input.billing);
  return {
    service: serviceHeadOf(service),
    orders,
    dispatches,
    reports,
    ...(quotes ? { quotes } : {}),
    ...(billing ? { billing } : {}),
    totals: totalsOf(input.totals, { orders, dispatches, reports, quotes }),
  };
}

/** «12 oct» from «2026-10-12», read as a calendar day: no time zone can move it to the 11th. */
export function dayOf(date: string): string {
  const [, , month, day] = DATE_ONLY.exec(date) ?? [];
  return month && day ? `${Number(day)} ${MONTHS[Number(month) - 1]}` : date;
}

let clock: Intl.DateTimeFormat | null = null;
let limaDay: Intl.DateTimeFormat | null = null;

/** «12 oct» for an instant, as the day it was in Lima; the formatter is built once (Hermes, OOM 30/10). */
export const instantDayOf = (iso: string): string => dayOf((limaDay ??= new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })).format(new Date(iso)));

/** «12 oct, 9:05 a. m.» in Lima. */
export function dayAndTimeOf(iso: string): string {
  const time = (clock ??= new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })).format(new Date(iso));
  // ICU puts narrow no-break spaces in «a. m.»; plain spaces read the same everywhere.
  return `${instantDayOf(iso)}, ${time.replace(/[\u00a0\u202f]/g, ' ')}`;
}

export const amount = (quantity?: number, unit?: string) => (quantity === undefined ? undefined : `${quantity}${unit ? ` ${unit}` : ''}`);
const joined = (parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
const money = (total?: number) => (total === undefined ? undefined : moneyOf(total));

/** One row of the detail, whatever the tab: what the person reads and what opens. */
export type DetailRow = { id: string; title: string; line: string; status: DetailStatus; url?: string; file?: { url: string; label: string } };

const fileOf = (url: string | undefined, label: string) => (url ? { file: { url, label } } : {});
const urlOf = (url: string | undefined) => (url ? { url } : {});

const orderRow = (order: ServiceOrder): DetailRow => ({ id: order.id, title: order.product ?? 'Pedido', line: joined([amount(order.quantity, order.unit), order.date ? dayOf(order.date) : 'sin fecha']), status: order.status, ...urlOf(order.url) });
export const dispatchRow = (dispatch: ServiceDispatch): DetailRow => ({
  id: dispatch.id,
  title: dispatch.plate ?? 'Despacho',
  line: joined([amount(dispatch.quantity, dispatch.unit), dispatch.at ? dayAndTimeOf(dispatch.at) : undefined, dispatch.driver]),
  status: dispatch.status,
  ...urlOf(dispatch.url),
  ...fileOf(dispatch.guideUrl, 'Guía'),
});
const LONG_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const titleHasDay = (title: string, date: string) => title.toLowerCase().includes(LONG_MONTHS[Number(DATE_ONLY.exec(date)?.[2] ?? 0) - 1] ?? '\u0000');

/** «Densidades de campo» does not start with the type «Densidad»; «Densidad · 9 set» does. */
const titleStartsWith = (title: string, type: string) => title.toLowerCase().startsWith(type.toLowerCase()) && /^\s*([·\-–—:]|$)/.test(title.slice(type.length));

/** Portal titles a report «Producción de planta · 10 de setiembre»: the line only adds what the title does not say. */
function reportLine(report: ServiceReport): string {
  const type = report.typeLabel && !titleStartsWith(report.title, report.typeLabel) ? report.typeLabel : undefined;
  const day = report.date && !titleHasDay(report.title, report.date) ? dayOf(report.date) : undefined;
  return joined([type, day]);
}
const reportRow = (report: ServiceReport): DetailRow => ({ id: report.id, title: report.title, line: reportLine(report), status: report.status, ...urlOf(report.url), ...fileOf(report.pdfUrl, 'PDF') });
const quoteRow = (quote: ServiceQuote): DetailRow => ({ id: quote.id, title: quote.code ?? 'Cotización', line: joined([money(quote.total), quote.date ? dayOf(quote.date) : undefined]), status: quote.status, ...urlOf(quote.url) });

/** The rows of one tab: a pedido has no number of its own in Portal, a dispatch shows its departure or the planned hour. «Cobranza» has its own view. */
export function detailRows(detail: ServiceDetail, tab: DetailTabKey): DetailRow[] {
  if (tab === 'orders') return detail.orders.map(orderRow);
  if (tab === 'dispatches') return detail.dispatches.map(dispatchRow);
  if (tab === 'reports') return detail.reports.map(reportRow);
  if (tab === 'quotes') return (detail.quotes ?? []).map(quoteRow);
  return [];
}

/** «Mostrando 100 de 148» when Portal has more than it sent; the rest is in Portal. */
export const moreInPortal = (shown: number, total: number): string | null => (total > shown ? `Mostrando ${shown} de ${total}` : null);

const TAB_NAMES: Record<DetailTabKey, string> = { orders: 'Pedidos', dispatches: 'Despachos', reports: 'Informes', quotes: 'Cotizaciones', billing: 'Cobranza' };

/** What an empty tab says. */
export const DETAIL_EMPTY: Record<DetailTabKey, string> = { orders: 'Este servicio todavía no tiene pedidos.', dispatches: 'Todavía no hay despachos.', reports: 'Todavía no hay informes.', quotes: 'Sin cotizaciones.', billing: 'Sin cobranza.' };

/** The detail's tabs with Portal's real counts; «Cotizaciones» and «Cobranza» only when they came, and first (José 30/10 night). */
export function detailTabs(detail: ServiceDetail): { key: DetailTabKey; label: string }[] {
  const keys: DetailTabKey[] = [...(detail.quotes ? (['quotes'] as const) : []), ...(detail.billing ? (['billing'] as const) : []), 'orders', 'dispatches', 'reports'];
  return keys.map((key) => ({ key, label: key === 'billing' ? TAB_NAMES.billing : `${TAB_NAMES[key]} · ${detail.totals[key] ?? 0}` }));
}

/** «15 nov 2026»: a calendar day with its year, for a due date. */
export function longDayOf(date: string): string {
  const year = DATE_ONLY.exec(date)?.[1];
  return year ? `${dayOf(date)} ${year}` : date;
}
