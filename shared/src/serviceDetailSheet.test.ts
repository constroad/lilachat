import { describe, expect, it } from 'vitest';
import { serviceDetailOf } from './serviceDetail.js';
import { detailSheet } from './serviceDetailSheet.js';

/** José 30/10: «si quiero ver el detalle de un pedido me dice que abra Portal… lo mismo con informes». */
const detail = serviceDetailOf({
  service: { id: 's', name: 'CHANCAY' },
  orders: [{ id: 'o1', date: '2026-09-10', product: 'ASTM D 3515 - tamaño 12.5mm', quantity: 383.5, unit: 'm³', status_label: 'Despachado', tone: 'ok', url: 'https://portal.constroad.com/o/1' }],
  dispatches: [
    { id: 'd1', order_id: 'o1', at: '2026-09-10T06:57:00.000Z', plate: 'AZJ 910', driver: 'Huber Quispe', quantity: 25.5, unit: 'm³', status_label: 'Entregado', tone: 'ok', guide_url: 'https://lila.constroad.com/files/g1.jpg' },
    { id: 'd2', order_id: 'otro', plate: 'BBE 942', status_label: 'Entregado', tone: 'ok' },
  ],
  reports: [
    { id: 'r1', title: 'Producción de planta · 10 de setiembre', type_label: 'Producción de planta', date: '2026-09-10', status_label: 'Completado', tone: 'ok', pdf_url: 'https://lila.constroad.com/files/r1.pdf' },
    { id: 'r2', title: 'Área adicional', date: '2026-09-13', status_label: 'Borrador', tone: 'neutral' },
  ],
  quotes: [{ id: 'q1', code: '300', date: '2026-08-28', total: 142416.02, status_label: 'Borrador', tone: 'neutral', items: [{ name: 'Mezcla asfáltica', quantity: 383.5, unit: 'm³', unit_price: 320, total: 122720 }, { quantity: 1 }] }],
})!;

describe('detailSheet', () => {
  it('an order: its facts and its dispatches, by order', () => {
    // Act
    const sheet = detailSheet(detail, 'orders', 'o1')!;
    // Assert
    expect(sheet.title).toBe('ASTM D 3515 - tamaño 12.5mm');
    expect(sheet.facts).toEqual([{ label: 'Cantidad', value: '383.5 m³' }, { label: 'Fecha', value: '10 set' }, { label: 'Despachos', value: '1' }]);
    expect(sheet.related.map((row) => row.id)).toEqual(['d1']);
    expect(sheet.url).toBe('https://portal.constroad.com/o/1');
  });

  it('a dispatch: plate, driver, quantity, departure in Lima and its order; the guide as a file', () => {
    const sheet = detailSheet(detail, 'dispatches', 'd1')!;
    expect(sheet.facts).toEqual([{ label: 'Chofer', value: 'Huber Quispe' }, { label: 'Cantidad', value: '25.5 m³' }, { label: 'Salida', value: '10 set, 1:57 a. m.' }, { label: 'Pedido', value: 'ASTM D 3515 - tamaño 12.5mm' }]);
    expect(sheet.file).toEqual({ url: 'https://lila.constroad.com/files/g1.jpg', label: 'Guía' });
  });

  it('a report with its PDF; one without says it has no PDF saved', () => {
    expect(detailSheet(detail, 'reports', 'r1')).toMatchObject({ facts: [{ label: 'Tipo', value: 'Producción de planta' }, { label: 'Fecha', value: '10 set' }], file: { url: 'https://lila.constroad.com/files/r1.pdf', label: 'PDF' } });
    expect(detailSheet(detail, 'reports', 'r2')).toMatchObject({ note: 'Este informe todavía no tiene PDF guardado en el Portal.' });
  });

  it('a quote: total, day and its line items when they come', () => {
    const sheet = detailSheet(detail, 'quotes', 'q1')!;
    expect(sheet.facts).toEqual([{ label: 'Total', value: 'S/ 142,416.02' }, { label: 'Fecha', value: '28 ago' }]);
    expect(sheet.items).toEqual([{ name: 'Mezcla asfáltica', line: '383.5 m³ · S/ 320.00 c/u', total: 'S/ 122,720.00' }]);
  });

  it('null for an id that is not there or for the collection tab', () => {
    expect(detailSheet(detail, 'orders', 'nada')).toBeNull();
    expect(detailSheet(detail, 'billing', 'o1')).toBeNull();
  });
});
