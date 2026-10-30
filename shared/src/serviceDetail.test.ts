import { describe, expect, it } from 'vitest';
import { detailRows, detailTabs, moreInPortal, serviceDetailOf } from './serviceDetail.js';

/** The detail of a client's service (José, 30/10: «qué informes hay, qué pedidos, qué despachos»), from `client.service.requested`. */
const body = {
  service: { id: 'srv-1', name: 'Reparación de vías Chancay', status: 'pending', stage_label: 'Ejecución', progress: 21, url: 'https://portal.constroad.com/s/1' },
  orders: [
    { id: 'o1', date: '2026-10-12', product: 'Asfalto MAC 2', quantity: 24, unit: 'm³', status_label: 'Despachado', tone: 'ok', url: 'https://portal.constroad.com/o/1' },
    { id: 'o2', product: 'Imprimación', status_label: 'Pendiente', tone: 'warn' },
    { id: 'bad', status_label: 'X', tone: 'purple', url: 'http://inseguro' },
  ],
  dispatches: [{ id: 'd1', order_id: 'o1', at: '2026-10-12T14:05:00.000Z', plate: 'ABC-123', quantity: 12, unit: 'm³', status_label: 'En ruta', tone: 'info', guide_url: 'https://lila.constroad.com/g/1' }],
  reports: [{ id: 'r1', title: 'Densidades de campo', type_label: 'Densidad', date: '2026-10-13', status_label: 'Completado', tone: 'ok', pdf_url: 'https://lila.constroad.com/r/1.pdf' }],
  totals: { orders: 148, dispatches: 1, reports: 1 },
};

describe('serviceDetailOf', () => {
  it('keeps https links only, a known tone (else neutral), and the totals', () => {
    const detail = serviceDetailOf(body)!;
    expect(detail.service).toEqual({ id: 'srv-1', name: 'Reparación de vías Chancay', stageLabel: 'Ejecución', progress: 21, url: 'https://portal.constroad.com/s/1' });
    expect(detail.orders).toHaveLength(3);
    expect(detail.orders[2]).toEqual({ id: 'bad', status: { label: 'X', tone: 'neutral' } });
    expect(detail.dispatches[0]).toMatchObject({ orderId: 'o1', plate: 'ABC-123', guideUrl: 'https://lila.constroad.com/g/1', status: { label: 'En ruta', tone: 'info' } });
    expect(detail.reports[0]).toMatchObject({ typeLabel: 'Densidad', pdfUrl: 'https://lila.constroad.com/r/1.pdf' });
    expect(detail.quotes).toBeUndefined();
    expect(detail.totals).toEqual({ orders: 148, dispatches: 1, reports: 1 });
  });

  it('is null without a service or without the lists', () => {
    expect(serviceDetailOf({ orders: [] })).toBeNull();
    expect(serviceDetailOf(null)).toBeNull();
    expect(serviceDetailOf({ service: { id: 's', name: 'S' } })).toBeNull();
  });
});

describe('rows and tabs', () => {
  it('an order reads product, then quantity · day, the day without moving to the day before in Lima', () => {
    const [first, second] = detailRows(serviceDetailOf(body)!, 'orders');
    expect(first).toEqual({ id: 'o1', title: 'Asfalto MAC 2', line: '24 m³ · 12 oct', status: { label: 'Despachado', tone: 'ok' }, url: 'https://portal.constroad.com/o/1' });
    expect(second).toEqual({ id: 'o2', title: 'Imprimación', line: 'sin fecha', status: { label: 'Pendiente', tone: 'warn' } });
  });

  it('a dispatch reads the plate, then quantity · day and hour in Lima · driver, with its guide', () => {
    const detail = serviceDetailOf({ ...body, dispatches: [{ ...body.dispatches[0], driver: 'Rosa Quispe' }] })!;
    expect(detailRows(detail, 'dispatches')[0]).toEqual({ id: 'd1', title: 'ABC-123', line: '12 m³ · 12 oct, 9:05 a. m. · Rosa Quispe', status: { label: 'En ruta', tone: 'info' }, file: { url: 'https://lila.constroad.com/g/1', label: 'Guía' } });
  });

  it('a report reads its title, then type · day, with its PDF', () => {
    expect(detailRows(serviceDetailOf(body)!, 'reports')[0]).toEqual({ id: 'r1', title: 'Densidades de campo', line: 'Densidad · 13 oct', status: { label: 'Completado', tone: 'ok' }, file: { url: 'https://lila.constroad.com/r/1.pdf', label: 'PDF' } });
  });

  it('a quote reads its code, then the total in soles · day; nothing when they did not come', () => {
    const detail = serviceDetailOf({ ...body, quotes: [{ id: 'q1', code: 'COT-2026-0142', total: 48380, date: '2026-10-14', status_label: 'Aceptada', tone: 'ok' }] })!;
    expect(detailRows(detail, 'quotes')[0]).toMatchObject({ title: 'COT-2026-0142', line: 'S/ 48,380.00 · 14 oct' });
    expect(detailRows(serviceDetailOf(body)!, 'quotes')).toEqual([]);
  });

  it('«100 de 148» only when Portal has more than it sent; quotes only when they came', () => {
    expect(moreInPortal(100, 148)).toBe('Mostrando 100 de 148');
    expect(moreInPortal(3, 3)).toBeNull();
    expect(detailTabs(serviceDetailOf(body)!).map((tab) => tab.label)).toEqual(['Pedidos · 148', 'Despachos · 1', 'Informes · 1']);
    expect(detailTabs({ ...serviceDetailOf(body)!, quotes: [], totals: { orders: 0, dispatches: 0, reports: 0, quotes: 2 } }).map((tab) => tab.key)).toEqual(['orders', 'dispatches', 'reports', 'quotes']);
  });
});
