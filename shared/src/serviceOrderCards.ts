/**
 * «Pedidos» of a service as the design draws it (José 19/11, design cc-02): one card per order
 * with its dispatches inside — plate, quantity, hour and its first pictures — instead of a row
 * that has to be opened to see them. The order's sheet still has the rest (cubicage, delivery guide). PURE.
 */
import { amount, detailRows, type DetailRow, type DispatchPicture, type ServiceDetail } from './serviceDetail.js';

export const ORDER_CARD_PICTURES_MAX = 3;
const TIME_ZONE = 'America/Lima';

export type OrderCardDispatch = { id: string; title: string; line: string; pictures: DispatchPicture[]; cubicage: boolean };
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
      pictures: (one.pictures ?? []).slice(0, ORDER_CARD_PICTURES_MAX),
      cubicage: Boolean(one.cubicage),
    })),
  }));
}
