import { describe, expect, it } from 'vitest';
import { detailRows, detailTabs, moreInPortal, reportGroups, serviceDetailOf } from './serviceDetail.js';

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

  it('an order also says its site (José 31/10: «los pedidos no muestran la obra»)', () => {
    // Arrange
    const detail = serviceDetailOf({ ...body, orders: [{ ...body.orders[0], site: 'Obra Grau' }] })!;
    // Act
    const [row] = detailRows(detail, 'orders');
    // Assert
    expect(row!.line).toBe('24 m³ · 12 oct · Obra Grau');
  });

  it('a dispatch reads the plate, then quantity · day and hour in Lima · driver, with its guide', () => {
    const detail = serviceDetailOf({ ...body, dispatches: [{ ...body.dispatches[0], driver: 'Rosa Quispe' }] })!;
    expect(detailRows(detail, 'dispatches')[0]).toEqual({ id: 'd1', title: 'ABC-123', line: '12 m³ · 12 oct, 9:05 a. m. · Rosa Quispe', status: { label: 'En ruta', tone: 'info' }, file: { url: 'https://lila.constroad.com/g/1', label: 'Guía' } });
  });

  it('a report reads its title, then type · day, with its PDF', () => {
    expect(detailRows(serviceDetailOf(body)!, 'reports')[0]).toEqual({ id: 'r1', title: 'Densidades de campo', line: 'Densidad · 13 oct', status: { label: 'Completado', tone: 'ok' }, file: { url: 'https://lila.constroad.com/r/1.pdf', label: 'PDF' } });
  });

  it('a report line does not repeat what its title already says (type, day in words)', () => {
    const detail = serviceDetailOf({ ...body, reports: [{ id: 'r2', title: 'Producción de planta · 10 de setiembre', type_label: 'Producción de planta', date: '2026-09-10', status_label: 'Completado', tone: 'ok' }] })!;
    expect(detailRows(detail, 'reports')[0]!.line).toBe('');
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
    // José 30/10 night: Cotizaciones and Cobranza go first.
    expect(detailTabs({ ...serviceDetailOf(body)!, quotes: [], totals: { orders: 0, dispatches: 0, reports: 0, quotes: 2 } }).map((tab) => tab.key)).toEqual(['quotes', 'orders', 'dispatches', 'reports']);
  });
});

describe('reportGroups', () => {
  const reportsOf = (reports: object[]) => serviceDetailOf({ ...body, reports })!;
  const status = { status_label: 'Borrador', tone: 'neutral' };

  it('groups the reports by day, newest first, like the Portal (José 31/10); the title drops the day the header already says', () => {
    // Arrange
    const detail = reportsOf([
      { id: 'r3', title: 'Control de pista · 5 de octubre', type_label: 'Control de pista', date: '2026-10-05', ...status },
      { id: 'r1', title: 'Producción de planta · 6 de octubre', type_label: 'Producción de planta', date: '2026-10-06', ...status },
      { id: 'r2', title: 'Densidades de campo', type_label: 'Densidad', date: '2026-10-06', ...status },
    ]);
    // Act
    const groups = reportGroups(detail);
    // Assert
    expect(groups.map((group) => [group.title, group.rows.map((row) => [row.title, row.line])])).toEqual([
      ['6 de octubre', [['Producción de planta', ''], ['Densidades de campo', 'Densidad']]],
      ['5 de octubre', [['Control de pista', '']]],
    ]);
  });

  it('a report without a day goes last, under «Sin fecha»; no reports, no groups', () => {
    // Arrange
    const detail = reportsOf([{ id: 'r9', title: 'Área adicional', ...status }, { id: 'r1', title: 'Losa', date: '2026-09-10', ...status }]);
    // Act
    const groups = reportGroups(detail);
    // Assert
    expect(groups.map((group) => group.title)).toEqual(['10 de setiembre', 'Sin fecha']);
    expect(reportGroups(reportsOf([]))).toEqual([]);
  });
});

describe('valuations (José 31/10: «debería poder generar la valorización desde algún lugar del servicio»)', () => {
  const valued = {
    ...body,
    valuations: [
      { id: 'v1', number: 3, period: 'Octubre 2026', period_from: '2026-10-01', period_to: '2026-10-31', total: 18500.5, status: 'approved', status_label: 'Aprobada', tone: 'ok', pdf_url: 'https://portal.constroad.com/v/3.pdf' },
      { id: 'v2', period: 'Noviembre 2026', status: 'draft', status_label: 'Borrador', tone: 'neutral', pdf_url: 'http://inseguro/v.pdf', period_from: '1 nov' },
    ],
    valuations_url: 'https://portal.constroad.com/valorizaciones?servicio=srv-1',
    totals: { ...body.totals, valuations: 7 },
  };

  it('come only for whoever sees amounts: days without a time, https links only, Portal\'s count', () => {
    // Act
    const detail = serviceDetailOf(valued)!;
    // Assert
    expect(detail.valuations?.[0]).toEqual({ id: 'v1', number: '3', period: 'Octubre 2026', periodFrom: '2026-10-01', periodTo: '2026-10-31', total: 18500.5, status: { label: 'Aprobada', tone: 'ok' }, pdfUrl: 'https://portal.constroad.com/v/3.pdf' });
    expect(detail.valuations?.[1]).toEqual({ id: 'v2', period: 'Noviembre 2026', status: { label: 'Borrador', tone: 'neutral' } });
    expect(detail.valuationsUrl).toBe('https://portal.constroad.com/valorizaciones?servicio=srv-1');
    expect(detail.totals.valuations).toBe(7);
    expect(serviceDetailOf(body)!.valuations).toBeUndefined();
    expect(serviceDetailOf({ ...valued, valuations_url: 'http://inseguro' })!.valuationsUrl).toBeUndefined();
  });

  it('a row reads «Valorización 3», then period · total, with its PDF', () => {
    // Act
    const [first, second] = detailRows(serviceDetailOf(valued)!, 'valuations');
    // Assert
    expect(first).toEqual({ id: 'v1', title: 'Valorización 3', line: 'Octubre 2026 · S/ 18,500.50', status: { label: 'Aprobada', tone: 'ok' }, file: { url: 'https://portal.constroad.com/v/3.pdf', label: 'PDF' } });
    expect(second).toEqual({ id: 'v2', title: 'Valorización', line: 'Noviembre 2026', status: { label: 'Borrador', tone: 'neutral' } });
  });

  it('the tab goes after Cobranza with Portal\'s count, also empty (to generate the first one); without them, no tab', () => {
    // Act
    const tabs = detailTabs({ ...serviceDetailOf(valued)!, billing: { isCredit: false, collected: 0, items: [], payments: [] } });
    const none = detailTabs(serviceDetailOf({ ...valued, valuations: [], totals: body.totals })!);
    // Assert
    expect(tabs.map((tab) => tab.key)).toEqual(['billing', 'valuations', 'orders', 'dispatches', 'reports']);
    expect(tabs[1]!.label).toBe('Valorizaciones · 7');
    expect(none.find((tab) => tab.key === 'valuations')?.label).toBe('Valorizaciones · 0');
    expect(detailTabs(serviceDetailOf(body)!).some((tab) => tab.key === 'valuations')).toBe(false);
  });
});
