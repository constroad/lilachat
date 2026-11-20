/**
 * «Pedidos» of a service as the design draws it (José 19/11, design cc-02; José 20/11, ped-v2):
 * one card per order with a summary of what was sent and its dispatches inside as thin rows by
 * hour — hour and m³, plate and the pictures that fit. The order's sheet still has the rest
 * (cubicage, delivery guide). Portal sends no order code: the card does not invent one. PURE.
 */
import { amount, dayOf, detailRows, type DetailRow, type ServiceDetail, type ServiceDispatch, type ServiceOrder } from './serviceDetail.js';
import { dispatchMediaOf, type SheetMedia } from './serviceDetailSheet.js';
import { SHELL_WIDE_MIN_PX } from './serviceShell.js';

/** Thumbs a dispatch row fits (José 20/11): a phone row (< 768 px) and a wide one. */
export const DISPATCH_THUMB_SLOTS = { compact: 3, wide: 5 } as const;
const TIME_ZONE = 'America/Lima';
const PERCENT_FULL = 100;
const SUM_DECIMALS = 2;

/** `media`: ALL the dispatch's photos and videos, so the viewer swipes among every one (José 20/11). */
export type OrderCardDispatch = { id: string; title: string; line: string; hour?: string; quantity?: string; media: SheetMedia[]; cubicage: boolean };
export type DispatchThumbs = { shown: SheetMedia[]; more: number };
/** What was dispatched against what was ordered, in the order's unit; `percent` only with an ordered quantity. */
export type OrderSummary = { dispatches: string; sent?: string; media?: string };
export type OrderProgress = { delivered: number; ordered?: number; percent?: number };
/** `heading`: the product (or «Pedido») and «qty · day» apart, so the product reads first. */
export type OrderCard = { order: DetailRow; heading: { title: string; detail: string }; site?: string; summary?: OrderSummary; progress?: OrderProgress; dispatches: OrderCardDispatch[] };

let clock: Intl.DateTimeFormat | undefined;
/** «08:20» in Lima: the day is the order's, the card only needs the hour. */
const hourOf = (iso: string) => (clock ??= new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).format(new Date(iso));
const joined = (parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const sameUnit = (left?: string, right?: string) => !left || !right || left.trim().toLowerCase() === right.trim().toLowerCase();

/** By departure, earliest first; a dispatch without an hour goes last (José 20/11: «ordenado»). */
const byHour = (left: ServiceDispatch, right: ServiceDispatch) => (left.at ? Date.parse(left.at) : Infinity) - (right.at ? Date.parse(right.at) : Infinity) || 0;

/** The m³ (or the order's unit) dispatched against the order's; dispatches in another unit do not count. */
export function orderProgressOf(order: Pick<ServiceOrder, 'quantity' | 'unit'>, dispatches: readonly Pick<ServiceDispatch, 'quantity' | 'unit'>[]): OrderProgress | undefined {
  const counted = dispatches.filter((one) => one.quantity !== undefined && sameUnit(order.unit, one.unit));
  if (!counted.length) return undefined;
  const delivered = Number(counted.reduce((sum, one) => sum + one.quantity!, 0).toFixed(SUM_DECIMALS));
  if (!order.quantity) return { delivered };
  return { delivered, ordered: order.quantity, percent: Math.min(PERCENT_FULL, Math.round((delivered / order.quantity) * PERCENT_FULL)) };
}

/** «5 despachos», «60 / 75 m³», «18 medios» (each in its place); none for an order without dispatches (its card says so). */
function summaryOf(order: ServiceOrder, dispatches: OrderCardDispatch[], progress?: OrderProgress): OrderSummary | undefined {
  if (!dispatches.length) return undefined;
  const sent = progress ? (progress.ordered ? `${amount(progress.delivered)} / ${amount(progress.ordered, order.unit)}` : amount(progress.delivered, order.unit)) : undefined;
  const media = dispatches.reduce((sum, one) => sum + one.media.length, 0);
  return { dispatches: plural(dispatches.length, 'despacho', 'despachos'), ...(sent ? { sent } : {}), ...(media ? { media: plural(media, 'medio', 'medios') } : {}) };
}

const cardDispatchOf = (one: ServiceDispatch): OrderCardDispatch => {
  const quantity = amount(one.quantity, one.unit);
  const hour = one.at ? hourOf(one.at) : undefined;
  return { id: one.id, title: one.plate ?? 'Despacho', line: joined([quantity, hour]), ...(hour ? { hour } : {}), ...(quantity ? { quantity } : {}), media: dispatchMediaOf(one), cubicage: Boolean(one.cubicage) };
};

export function orderCardsOf(detail: Pick<ServiceDetail, 'orders' | 'dispatches' | 'reports' | 'totals' | 'service'>): OrderCard[] {
  const rows = detailRows(detail as ServiceDetail, 'orders');
  return detail.orders.map((order, index) => {
    const own = detail.dispatches.filter((one) => one.orderId === order.id).sort(byHour);
    const dispatches = own.map(cardDispatchOf);
    const progress = orderProgressOf(order, own);
    const heading = { title: order.product ?? 'Pedido', detail: joined([amount(order.quantity, order.unit), order.date ? dayOf(order.date) : undefined]) };
    const summary = summaryOf(order, dispatches, progress);
    return { order: rows[index]!, heading, ...(order.site ? { site: order.site } : {}), ...(summary ? { summary } : {}), ...(progress ? { progress } : {}), dispatches };
  });
}

/** The thumbs that fit `slots`; with more media than slots, the last slot is a «+K» tile. */
export function dispatchThumbs(media: readonly SheetMedia[], slots: number): DispatchThumbs {
  const fits = Math.max(1, Math.floor(slots));
  if (media.length <= fits) return { shown: [...media], more: 0 };
  const shown = media.slice(0, fits - 1);
  return { shown, more: media.length - shown.length };
}

/** The slots for a window `widthPx` wide: a phone's row is narrower than a tablet's (`SHELL_WIDE_MIN_PX`). */
export const dispatchThumbSlotsFor = (widthPx: number): number => (widthPx < SHELL_WIDE_MIN_PX ? DISPATCH_THUMB_SLOTS.compact : DISPATCH_THUMB_SLOTS.wide);

/** «Pedidos asociados (N) · Total: 12 m³ + 300 gal» (design cc-02 mobile): what was ordered, per unit. */
export type OrdersTotal = { count: number; total?: string };

export function ordersTotalOf(orders: readonly Pick<ServiceOrder, 'quantity' | 'unit'>[]): OrdersTotal | undefined {
  if (!orders.length) return undefined;
  const byUnit = new Map<string, { unit?: string; sum: number }>();
  for (const order of orders) {
    if (order.quantity === undefined) continue;
    const key = order.unit?.trim().toLowerCase() ?? '';
    const entry = byUnit.get(key) ?? { unit: order.unit?.trim() || undefined, sum: 0 };
    entry.sum += order.quantity;
    byUnit.set(key, entry);
  }
  const total = [...byUnit.values()].map((entry) => amount(Number(entry.sum.toFixed(SUM_DECIMALS)), entry.unit)).join(' + ');
  return { count: orders.length, ...(total ? { total } : {}) };
}
