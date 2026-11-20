/**
 * «Pedidos» of a service as the design draws it (José 19/11, design cc-02): one card per order
 * with its dispatches inside — plate, quantity, hour and the pictures that fit — instead of a row
 * that has to be opened to see them. The order's sheet still has the rest (cubicage, delivery guide). PURE.
 */
import { amount, detailRows, type DetailRow, type ServiceDetail } from './serviceDetail.js';
import { dispatchMediaOf, type SheetMedia } from './serviceDetailSheet.js';
import { SHELL_WIDE_MIN_PX } from './serviceShell.js';

/** Thumbs a dispatch row fits (José 20/11): a phone row (< 768 px) and a wide one. */
export const DISPATCH_THUMB_SLOTS = { compact: 3, wide: 5 } as const;
const TIME_ZONE = 'America/Lima';

/** `media`: ALL the dispatch's photos and videos, so the viewer swipes among every one (José 20/11). */
export type OrderCardDispatch = { id: string; title: string; line: string; media: SheetMedia[]; cubicage: boolean };
export type DispatchThumbs = { shown: SheetMedia[]; more: number };
export type OrderCard = { order: DetailRow; dispatches: OrderCardDispatch[] };

let clock: Intl.DateTimeFormat | undefined;
/** «08:20» in Lima: the day is the order's, the card only needs the hour. */
const hourOf = (iso: string) => (clock ??= new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).format(new Date(iso));

export function orderCardsOf(detail: Pick<ServiceDetail, 'orders' | 'dispatches' | 'reports' | 'totals' | 'service'>): OrderCard[] {
  const rows = detailRows(detail as ServiceDetail, 'orders');
  return detail.orders.map((order, index) => ({
    order: rows[index]!,
    dispatches: detail.dispatches.filter((one) => one.orderId === order.id).map((one) => ({
      id: one.id,
      title: one.plate ?? 'Despacho',
      line: [amount(one.quantity, one.unit), one.at ? hourOf(one.at) : undefined].filter(Boolean).join(' · '),
      media: dispatchMediaOf(one),
      cubicage: Boolean(one.cubicage),
    })),
  }));
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
