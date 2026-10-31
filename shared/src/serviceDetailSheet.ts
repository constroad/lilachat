import { moneyOf } from './serviceBilling.js';
import { amount, dayAndTimeOf, dayOf, dispatchRow, longDayOf, type DetailRow, type DetailStatus, type DetailTabKey, type QuoteItem, type ServiceDetail, type ServiceDispatch, type ServiceOrder, type ServiceQuote, type ServiceReport, type ServiceValuation } from './serviceDetail.js';
/**
 * One order, dispatch, report or quote opened inside Lilachat (José 30/10:
 * sending him to Portal for an order's detail was not useful). Built from
 * what the detail already brought; Portal stays as a secondary link. PURE:
 * app and web.
 */
export type SheetFact = { label: string; value: string };
export type SheetItem = { name: string; line: string; total?: string };
export type SheetFile = { url: string; label: string };
/** `pdfOnDemand`: a report with no PDF stored, asked to Portal when tapped (agentes 30/10, `client.report.requested`). */
/** A photo or video shown as a thumbnail that opens the viewer (a dispatch's, José 30/10 night). */
export type SheetMedia = { url: string; thumbUrl?: string; mime: string; name: string; /** The dispatch's departure, so the viewer does not date the photo «Hoy». */ when?: string };
/** A block of facts with its own title, like a dispatch's «Cubicaje»; `folded` opens behind a button that shows `summary` (José 31/10). */
export type SheetGroup = { title: string; facts: SheetFact[]; summary?: string; folded?: boolean };
export type DetailSheet = { title: string; status: DetailStatus; facts: SheetFact[]; related: DetailRow[]; items: SheetItem[]; files: SheetFile[]; media: SheetMedia[]; groups: SheetGroup[]; url?: string; note?: string; pdfOnDemand?: string };


/** The facts that came, in reading order; a missing one is not a «—». */
const facts = (pairs: [string, string | undefined][]): SheetFact[] => pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []));
const base = (title: string, status: DetailStatus, url?: string) => ({ title, status, related: [], items: [], files: [], media: [], groups: [], ...(url ? { url } : {}) });

const money = (value?: number) => (value === undefined ? undefined : moneyOf(value));
const conditionOf = (order: ServiceOrder) => (order.isCredit === undefined ? undefined : order.isCredit ? `Crédito${order.dueAt ? ` · vence el ${longDayOf(order.dueAt)}` : ''}` : 'Contado');

/** Collected is the sum of its payments (there is no per-order «collected»); pending, the total minus that. */
function orderMoney(order: ServiceOrder): [string, string | undefined][] {
  const collected = order.payments?.reduce((sum, payment) => sum + payment.amount, 0);
  const pending = order.total !== undefined && collected !== undefined ? Math.max(0, order.total - collected) : undefined;
  return [['Precio unitario', money(order.unitPrice)], ['Total', money(order.total)], ['Condición', conditionOf(order)], ['Cobrado', money(collected)], ['Por cobrar', money(pending)]];
}

/** José 30/10 night: invoices are money, so they live in «Cobranza»; a whole-order guide lives in «Despachos». */
export type InvoiceRow = { id: string; label: string; line: string; url?: string };
export const invoicesOf = (detail: ServiceDetail): InvoiceRow[] =>
  detail.orders.flatMap((order) => (order.invoice || order.invoiceUrl ? [{ id: order.id, label: order.invoice ? `Factura ${order.invoice}` : 'Factura', line: [order.product, order.date && dayOf(order.date)].filter(Boolean).join(' · '), ...(order.invoiceUrl ? { url: order.invoiceUrl } : {}) }] : []));
export const orderGuidesOf = (detail: ServiceDetail): SheetFile[] => detail.orders.flatMap((order) => (order.guides ?? []).map((guide) => ({ url: guide.url, label: order.product ? `${guide.name} · ${order.product}` : guide.name })));

function orderSheet(order: ServiceOrder, detail: ServiceDetail): DetailSheet {
  const dispatches = detail.dispatches.filter((one) => one.orderId === order.id);
  const head: [string, string | undefined][] = [['Obra', order.site], ['Cantidad', amount(order.quantity, order.unit)], ['Fecha', order.date && dayOf(order.date)], ['Despachos', String(dispatches.length)]];
  return { ...base(order.product ?? 'Pedido', order.status, order.url), facts: facts([...head, ...orderMoney(order)]), related: dispatches.map(dispatchRow) };
}

/** Each photo or video with a name the viewer can show: its own, or «AZJ 910 · foto 2». */
const mediaOf = (dispatch: ServiceDispatch): SheetMedia[] =>
  (dispatch.pictures ?? []).map((picture, index) => ({ url: picture.url, ...(picture.thumbUrl ? { thumbUrl: picture.thumbUrl } : {}), mime: picture.mime, name: picture.name ?? `${dispatch.plate ?? 'Despacho'} · ${picture.mime.startsWith('video/') ? 'video' : 'foto'} ${index + 1}`, ...(dispatch.at ? { when: dispatch.at } : {}) }));

function cubicageGroup(dispatch: ServiceDispatch): SheetGroup[] {
  const cubicage = dispatch.cubicage;
  if (!cubicage) return [];
  const head = facts([['Volquete cubica', amount(cubicage.m3, 'm³')], ['Forma', cubicage.shape]]);
  // José 31/10: «para ver el cubicaje debería haber un botón… prioridad a las fotos y videos».
  const summary = [amount(cubicage.m3, 'm³'), cubicage.shape].filter(Boolean).join(' · ');
  return [{ title: 'Cubicaje', ...(summary ? { summary } : {}), folded: true, facts: [...head, ...cubicage.dimensions] }];
}

function dispatchSheet(dispatch: ServiceDispatch, detail: ServiceDetail): DetailSheet {
  const order = detail.orders.find((one) => one.id === dispatch.orderId);
  const sheetFacts = facts([['Chofer', dispatch.driver], ['Cantidad', amount(dispatch.quantity, dispatch.unit)], ['Salida', dispatch.at && dayAndTimeOf(dispatch.at)], ['Guía N°', dispatch.guideNumber], ['Pedido', order?.product]]);
  return { ...base(dispatch.plate ?? 'Despacho', dispatch.status, dispatch.url), facts: sheetFacts, files: dispatch.guideUrl ? [{ url: dispatch.guideUrl, label: 'Guía' }] : [], media: mediaOf(dispatch), groups: cubicageGroup(dispatch) };
}

function reportSheet(report: ServiceReport): DetailSheet {
  const sheet = { ...base(report.title, report.status, report.url), facts: facts([['Tipo', report.typeLabel], ['Fecha', report.date && dayOf(report.date)]]) };
  return report.pdfUrl ? { ...sheet, files: [{ url: report.pdfUrl, label: 'PDF' }] } : { ...sheet, pdfOnDemand: report.id };
}

const itemLine = (item: QuoteItem) => [amount(item.quantity, item.unit), item.unitPrice === undefined ? undefined : `${moneyOf(item.unitPrice)} c/u`].filter(Boolean).join(' · ');
const sheetItem = (item: QuoteItem): SheetItem => ({ name: item.name, line: itemLine(item), ...(item.total === undefined ? {} : { total: moneyOf(item.total) }) });

/** Also opened from the client's account (all its quotes, design f-08). */
export function quoteSheet(quote: ServiceQuote): DetailSheet {
  const sheet = { ...base(quote.code ? `Cotización ${quote.code}` : 'Cotización', quote.status, quote.url), facts: facts([['Total', quote.total === undefined ? undefined : moneyOf(quote.total)], ['Fecha', quote.date && dayOf(quote.date)]]), items: (quote.items ?? []).map(sheetItem) };
  // José 30/10 night: «en cotizaciones me gustaría poder ver el PDF».
  return quote.pdfUrl ? { ...sheet, files: [{ url: quote.pdfUrl, label: 'PDF' }] } : sheet;
}

function valuationSheet(valuation: ServiceValuation): DetailSheet {
  const sheet = { ...base(valuation.number ? `Valorización ${valuation.number}` : 'Valorización', valuation.status), facts: facts([['Periodo', valuation.period], ['Desde', valuation.periodFrom && dayOf(valuation.periodFrom)], ['Hasta', valuation.periodTo && dayOf(valuation.periodTo)], ['Total', money(valuation.total)]]) };
  return valuation.pdfUrl ? { ...sheet, files: [{ url: valuation.pdfUrl, label: 'PDF' }] } : sheet;
}

/** The sheet of one row of a tab; `null` when it is not there (or for «Cobranza», which has its own view). */
export function detailSheet(detail: ServiceDetail, tab: DetailTabKey, id: string): DetailSheet | null {
  if (tab === 'orders') return ((order) => (order ? orderSheet(order, detail) : null))(detail.orders.find((one) => one.id === id));
  if (tab === 'dispatches') return ((dispatch) => (dispatch ? dispatchSheet(dispatch, detail) : null))(detail.dispatches.find((one) => one.id === id));
  if (tab === 'reports') return ((report) => (report ? reportSheet(report) : null))(detail.reports.find((one) => one.id === id));
  if (tab === 'quotes') return ((quote) => (quote ? quoteSheet(quote) : null))(detail.quotes?.find((one) => one.id === id));
  if (tab === 'valuations') return ((valuation) => (valuation ? valuationSheet(valuation) : null))(detail.valuations?.find((one) => one.id === id));
  return null;
}
