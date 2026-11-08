import { describe, expect, it } from 'vitest';
import { dayWithYearOf, detailEmptyText, detailRows, detailTabs, moreInPortal, serviceTabs, orphanDispatchesOf, recordDays, reportGroups, serviceDetailOf } from './serviceDetail.js';

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

  it('brings the units placed by their photos for the map, and nothing when Portal leaves the key out (07/11)', () => {
    // Arrange
    const discharges = [{ dispatch_id: 'd1', plate: '', m3: 15, arrival_at: '2026-11-07T14:00:00.000Z', points: [{ kind: 'ingreso', lat: -12.05, lng: -77.03, precision_m: 6, at: '2026-11-07T14:00:00.000Z' }] }];
    // Act
    const placed = serviceDetailOf({ ...body, discharges })!;
    const none = serviceDetailOf(body)!;
    // Assert
    expect(placed.discharges).toEqual([{ dispatchId: 'd1', plate: 'Sin placa', m3: 15, arrivalAt: '2026-11-07T14:00:00.000Z', points: [{ kind: 'ingreso', lat: -12.05, lng: -77.03, precisionM: 6, at: '2026-11-07T14:00:00.000Z' }] }]);
    expect(none.discharges).toBeUndefined();
    expect(serviceDetailOf({ ...body, discharges: [] })!.discharges).toBeUndefined();
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
    expect(first).toEqual({ id: 'o1', title: 'Asfalto MAC 2', line: '24 m³ · 12 oct · 1 despacho', status: { label: 'Despachado', tone: 'ok' }, url: 'https://portal.constroad.com/o/1' });
    expect(second).toEqual({ id: 'o2', title: 'Imprimación', line: 'sin fecha', status: { label: 'Pendiente', tone: 'warn' } });
  });

  it('an order also says its site (José 31/10: «los pedidos no muestran la obra»)', () => {
    // Arrange
    const detail = serviceDetailOf({ ...body, orders: [{ ...body.orders[0], site: 'Obra Grau' }] })!;
    // Act
    const [row] = detailRows(detail, 'orders');
    // Assert
    // A long site gets cut at the end of the line, so the count goes before it.
    expect(row!.line).toBe('24 m³ · 12 oct · 1 despacho · Obra Grau');
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

  it('«100 de 148» only when Portal has more than it sent; the money lives in «Cuenta», never here', () => {
    expect(moreInPortal(100, 148)).toBe('Mostrando 100 de 148');
    expect(moreInPortal(3, 3)).toBeNull();
    // An empty list says it itself (01/11: «Mostrando 0 de 1» under «Todavía no hay informes»).
    expect(moreInPortal(0, 1)).toBeNull();
    expect(detailTabs(serviceDetailOf(body)!).map((tab) => tab.label)).toEqual(['Pedidos · 148', 'Informes · 1']);
    // José 05/11: even for whoever sees money, the service has no money tab.
    expect(detailTabs({ ...serviceDetailOf(body)!, quotes: [], totals: { orders: 0, dispatches: 0, reports: 0, quotes: 2 } }).map((tab) => tab.key)).toEqual(['orders', 'reports']);
  });
});

describe('the dispatches live inside their order (José 01/11: «por servicio pueden haber varios pedidos»)', () => {
  it('no «Despachos» tab: each order says how many it has', () => {
    // Arrange
    const detail = serviceDetailOf({ ...body, dispatches: [body.dispatches[0], { ...body.dispatches[0], id: 'd2' }] })!;
    // Act
    const [first, second] = detailRows(detail, 'orders');
    // Assert
    expect(detailTabs(detail).map((tab) => tab.key)).not.toContain('dispatches');
    expect(first!.line).toBe('24 m³ · 12 oct · 2 despachos');
    expect(second!.line).toBe('sin fecha');
  });

  it('the Drive is a tab of the service for whoever may see it (José 06/11), and has no count to show', () => {
    // Arrange
    const detail = serviceDetailOf(body)!;
    // Act
    const withDrive = serviceTabs(detail, true);
    // Assert
    expect(withDrive.map((tab) => tab.label)).toEqual(['Pedidos · 148', 'Informes · 1', 'Drive']);
    expect(serviceTabs(detail, false).map((tab) => tab.key)).toEqual(['orders', 'reports']);
  });

  it('reads «Incluir en el informe» only with a map (Portal c7088e7d)', () => {
    const on = serviceDetailOf({ ...body, service: { ...body.service, has_map: true, mapa_en_informe: { incluido: true, etapaId: 'e1', hasta: '2026-11-06' } } })!;
    expect(on.service.mapInReport).toEqual({ included: true, stageId: 'e1', until: '2026-11-06' });
    expect(serviceDetailOf({ ...body, service: { ...body.service, mapa_en_informe: { incluido: true } } })!.service.mapInReport).toBeUndefined();
    expect(serviceDetailOf({ ...body, service: { ...body.service, has_map: true, mapa_en_informe: { incluido: true, hasta: 'ayer' } } })!.service.mapInReport).toEqual({ included: true });
  });

  it('«Mapa» goes to whoever can make its link, with streets or not, before the Drive (José 06/11 and 07/11, design o-10)', () => {
    // Arrange
    const withMap = serviceDetailOf({ ...body, service: { ...body.service, has_map: true } })!;
    const withoutMap = serviceDetailOf(body)!;
    // Assert
    expect(withMap.service.hasMap).toBe(true);
    expect(serviceTabs(withMap, true, true).map((tab) => tab.key)).toEqual(['orders', 'reports', 'map', 'drive']);
    expect(serviceTabs(withoutMap, false, true).map((tab) => tab.key)).toEqual(['orders', 'reports', 'map']);
    expect(serviceTabs(withMap, true, false).map((tab) => tab.key)).toEqual(['orders', 'reports', 'drive']);
  });

  it('a dispatch whose order did not come (Portal sends 100 of each) is not lost: it is listed apart', () => {
    // Arrange
    const detail = serviceDetailOf({ ...body, dispatches: [body.dispatches[0], { id: 'd9', order_id: 'o-viejo', plate: 'BBE 942', status_label: 'Entregado', tone: 'ok' }, { id: 'd10', plate: 'C3D 111', status_label: 'Entregado', tone: 'ok' }] })!;
    // Act / Assert
    expect(orphanDispatchesOf(detail).map((row) => row.id)).toEqual(['d9', 'd10']);
    expect(orphanDispatchesOf(serviceDetailOf(body)!)).toEqual([]);
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

describe('recordDays (José 01/11: «tampoco están agrupados los informes por fecha de un servicio»)', () => {
  const record = (seq: number, at: string) => ({ seq, at, service_id: 's1', title: `Informe ${seq}` });
  it('the records of a service card under a header per day in Lima, keeping the newest first', () => {
    // Arrange: 00:30 of the 7th in UTC is still the 6th in Lima.
    const records = [record(9, '2026-10-07T15:00:00.000Z'), record(8, '2026-10-07T00:30:00.000Z'), record(7, '2026-10-06T14:00:00.000Z')];
    // Act
    const days = recordDays(records);
    // Assert
    expect(days.map((day) => [day.title, day.records.map((one) => one.seq)])).toEqual([['7 de octubre', [9]], ['6 de octubre', [8, 7]]]);
  });

  it('no records, no days', () => {
    expect(recordDays([])).toEqual([]);
  });
});

describe('an empty tab with Portal counting some (01/11: «Informes · 1» over «Todavía no hay informes»)', () => {
  const none = { orders: 0, dispatches: 0, reports: 0 };
  it('says none yet only when Portal counts none', () => {
    expect(detailEmptyText('reports', none)).toBe('Todavía no hay informes.');
    expect(detailEmptyText('orders', none)).toBe('Este servicio todavía no tiene pedidos.');
  });

  it('says how many are in Portal when none came', () => {
    expect(detailEmptyText('reports', { ...none, reports: 1 })).toBe('Hay 1 en el Portal que todavía no llega aquí.');
    expect(detailEmptyText('orders', { ...none, orders: 3 })).toBe('Hay 3 en el Portal que todavía no llegan aquí.');
  });
});

describe('dayWithYearOf', () => {
  it('this year’s day needs no year, another year’s says it', () => {
    const now = new Date('2026-11-05T15:00:00.000Z');
    expect(dayWithYearOf('2026-10-28', now)).toBe('28 oct');
    expect(dayWithYearOf('2025-10-28', now)).toBe('28 oct 2025');
    expect(dayWithYearOf('2027-01-02', now)).toBe('2 ene 2027');
  });

  it('the year is Lima’s: New Year’s Eve at night is still the old year there', () => {
    const lastNight = new Date('2027-01-01T03:00:00.000Z');
    expect(dayWithYearOf('2026-12-31', lastNight)).toBe('31 dic');
  });

  it('what is not a calendar day comes back as it was', () => {
    expect(dayWithYearOf('ayer', new Date('2026-11-05T15:00:00.000Z'))).toBe('ayer');
  });
});
