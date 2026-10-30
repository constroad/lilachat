import { moneyOf } from './serviceBilling.js';
import { amount, dayAndTimeOf, dayOf, dispatchRow, longDayOf, type DetailRow, type DetailStatus, type DetailTabKey, type QuoteItem, type ServiceDetail, type ServiceDispatch, type ServiceOrder, type ServiceQuote, type ServiceReport } from './serviceDetail.js';
/**
 * One order, dispatch, report or quote opened inside Lilachat (José 30/10:
 * sending him to Portal for an order's detail was not useful). Built from
 * what the detail already brought; Portal stays as a secondary link. PURE:
 * app and web.
 */
export type SheetFact = { label: string; value: string };
export type SheetItem = { name: string; line: string; total?: string };
export type SheetFile = { url: string; label: string };
export type DetailSheet = { title: string; status: DetailStatus; facts: SheetFact[]; related: DetailRow[]; items: SheetItem[]; files: SheetFile[]; url?: string; note?: string };

const NO_REPORT_PDF = 'Este informe todavía no tiene PDF guardado en el Portal.';

/** The facts that came, in reading order; a missing one is not a «—». */
const facts = (pairs: [string, string | undefined][]): SheetFact[] => pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []));
const base = (title: string, status: DetailStatus, url?: string) => ({ title, status, related: [], items: [], files: [], ...(url ? { url } : {}) });

const money = (value?: number) => (value === undefined ? undefined : moneyOf(value));
const conditionOf = (order: ServiceOrder) => (order.isCredit === undefined ? undefined : order.isCredit ? `Crédito${order.dueAt ? ` · vence el ${longDayOf(order.dueAt)}` : ''}` : 'Contado');

/** Collected is the sum of its payments (there is no per-order «collected»); pending, the total minus that. */
function orderMoney(order: ServiceOrder): [string, string | undefined][] {
  const collected = order.payments?.reduce((sum, payment) => sum + payment.amount, 0);
  const pending = order.total !== undefined && collected !== undefined ? Math.max(0, order.total - collected) : undefined;
  return [['Precio unitario', money(order.unitPrice)], ['Total', money(order.total)], ['Condición', conditionOf(order)], ['Cobrado', money(collected)], ['Por cobrar', money(pending)]];
}

const orderFiles = (order: ServiceOrder): SheetFile[] => [...(order.invoiceUrl ? [{ url: order.invoiceUrl, label: order.invoice ? `Factura ${order.invoice}` : 'Factura' }] : []), ...(order.guides ?? []).map((guide) => ({ url: guide.url, label: guide.name }))];

function orderSheet(order: ServiceOrder, detail: ServiceDetail): DetailSheet {
  const dispatches = detail.dispatches.filter((one) => one.orderId === order.id);
  const head: [string, string | undefined][] = [['Obra', order.site], ['Cantidad', amount(order.quantity, order.unit)], ['Fecha', order.date && dayOf(order.date)], ['Despachos', String(dispatches.length)]];
  return { ...base(order.product ?? 'Pedido', order.status, order.url), facts: facts([...head, ...orderMoney(order), ['Factura', order.invoice]]), related: dispatches.map(dispatchRow), files: orderFiles(order) };
}

function dispatchSheet(dispatch: ServiceDispatch, detail: ServiceDetail): DetailSheet {
  const order = detail.orders.find((one) => one.id === dispatch.orderId);
  const sheetFacts = facts([['Chofer', dispatch.driver], ['Cantidad', amount(dispatch.quantity, dispatch.unit)], ['Salida', dispatch.at && dayAndTimeOf(dispatch.at)], ['Guía N°', dispatch.guideNumber], ['Pedido', order?.product]]);
  return { ...base(dispatch.plate ?? 'Despacho', dispatch.status, dispatch.url), facts: sheetFacts, files: dispatch.guideUrl ? [{ url: dispatch.guideUrl, label: 'Guía' }] : [] };
}

function reportSheet(report: ServiceReport): DetailSheet {
  const sheet = { ...base(report.title, report.status, report.url), facts: facts([['Tipo', report.typeLabel], ['Fecha', report.date && dayOf(report.date)]]) };
  return report.pdfUrl ? { ...sheet, files: [{ url: report.pdfUrl, label: 'PDF' }] } : { ...sheet, note: NO_REPORT_PDF };
}

const itemLine = (item: QuoteItem) => [amount(item.quantity, item.unit), item.unitPrice === undefined ? undefined : `${moneyOf(item.unitPrice)} c/u`].filter(Boolean).join(' · ');
const sheetItem = (item: QuoteItem): SheetItem => ({ name: item.name, line: itemLine(item), ...(item.total === undefined ? {} : { total: moneyOf(item.total) }) });

function quoteSheet(quote: ServiceQuote): DetailSheet {
  return { ...base(quote.code ? `Cotización ${quote.code}` : 'Cotización', quote.status, quote.url), facts: facts([['Total', quote.total === undefined ? undefined : moneyOf(quote.total)], ['Fecha', quote.date && dayOf(quote.date)]]), items: (quote.items ?? []).map(sheetItem) };
}

/** The sheet of one row of a tab; `null` when it is not there (or for «Cobranza», which has its own view). */
export function detailSheet(detail: ServiceDetail, tab: DetailTabKey, id: string): DetailSheet | null {
  if (tab === 'orders') return ((order) => (order ? orderSheet(order, detail) : null))(detail.orders.find((one) => one.id === id));
  if (tab === 'dispatches') return ((dispatch) => (dispatch ? dispatchSheet(dispatch, detail) : null))(detail.dispatches.find((one) => one.id === id));
  if (tab === 'reports') return ((report) => (report ? reportSheet(report) : null))(detail.reports.find((one) => one.id === id));
  if (tab === 'quotes') return ((quote) => (quote ? quoteSheet(quote) : null))(detail.quotes?.find((one) => one.id === id));
  return null;
}
