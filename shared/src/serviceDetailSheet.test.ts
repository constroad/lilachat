import { describe, expect, it } from 'vitest';
import { serviceDetailOf } from './serviceDetail.js';
import { detailSheet, invoicesOf, orderGuidesOf } from './serviceDetailSheet.js';

/** José 30/10: «si quiero ver el detalle de un pedido me dice que abra Portal… lo mismo con informes». */
const detail = serviceDetailOf({
  service: { id: 's', name: 'CHANCAY' },
  orders: [{ id: 'o1', date: '2026-09-10', product: 'ASTM D 3515 - tamaño 12.5mm', quantity: 383.5, unit: 'm³', status_label: 'Despachado', tone: 'ok', url: 'https://portal.constroad.com/o/1' }],
  dispatches: [
    { id: 'd1', order_id: 'o1', at: '2026-09-10T06:57:00.000Z', plate: 'AZJ 910', driver: 'Huber Quispe', quantity: 25.5, unit: 'm³', status_label: 'Entregado', tone: 'ok', guide_url: 'https://lila.constroad.com/files/g1.jpg', guide_number: '001-77' },
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
    expect(sheet.files).toEqual([]);
  });

  it('an order with Portal 611e61d7 fields: site and, with the collection rule, price, credit and what is pending; its invoice goes to Cobranza and its guides to Despachos', () => {
    // Arrange
    const order = { id: 'o2', product: 'MAC 2', quantity: 10, unit: 'm³', status_label: 'Despachado', tone: 'ok', site: 'Av. Los Álamos km 12', invoice: 'F001-345', invoice_url: 'https://lila.constroad.com/files/f345.pdf', guides: [{ name: 'Guía 001-77', url: 'https://lila.constroad.com/files/g77.jpg' }, { name: 'sin url' }], unit_price: 320, total: 3200, is_credit: true, due_at: '2026-11-15', payments: [{ date: '2026-10-20', amount: 1000 }, { date: '2026-10-25', amount: 200 }] };
    const withOrder = serviceDetailOf({ service: { id: 's', name: 'S' }, orders: [order], dispatches: [], reports: [] })!;
    // Act
    const sheet = detailSheet(withOrder, 'orders', 'o2')!;
    // Assert
    expect(sheet.facts).toEqual([
      { label: 'Obra', value: 'Av. Los Álamos km 12' },
      { label: 'Cantidad', value: '10 m³' },
      { label: 'Despachos', value: '0' },
      { label: 'Precio unitario', value: 'S/ 320.00' },
      { label: 'Total', value: 'S/ 3,200.00' },
      { label: 'Condición', value: 'Crédito · vence el 15 nov 2026' },
      { label: 'Cobrado', value: 'S/ 1,200.00' },
      { label: 'Por cobrar', value: 'S/ 2,000.00' },
    ]);
    expect(sheet.files).toEqual([]);
    expect(invoicesOf(withOrder)).toEqual([{ id: 'o2', label: 'Factura F001-345', line: 'MAC 2', url: 'https://lila.constroad.com/files/f345.pdf' }]);
    expect(orderGuidesOf(withOrder)).toEqual([{ url: 'https://lila.constroad.com/files/g77.jpg', label: 'Guía 001-77 · MAC 2' }]);
  });

  it('a dispatch: plate, driver, quantity, departure in Lima and its order; the guide as a file', () => {
    const sheet = detailSheet(detail, 'dispatches', 'd1')!;
    expect(sheet.facts).toEqual([{ label: 'Chofer', value: 'Huber Quispe' }, { label: 'Cantidad', value: '25.5 m³' }, { label: 'Salida', value: '10 set, 1:57 a. m.' }, { label: 'Guía N°', value: '001-77' }, { label: 'Pedido', value: 'ASTM D 3515 - tamaño 12.5mm' }]);
    expect(sheet.files).toEqual([{ url: 'https://lila.constroad.com/files/g1.jpg', label: 'Guía' }]);
    expect(sheet.media).toEqual([]);
    expect(sheet.groups).toEqual([]);
  });

  it('a dispatch with its photos, videos and the truck cubicaje (José 30/10 night)', () => {
    // Arrange
    const withMedia = serviceDetailOf({
      service: { id: 's', name: 'S' },
      orders: [],
      reports: [],
      dispatches: [{ id: 'd9', plate: 'AZJ 910', at: '2026-09-10T06:57:00.000Z', status_label: 'Entregado', tone: 'ok', pictures: [{ url: 'https://lila.constroad.com/f/p1.jpg', thumb_url: 'https://lila.constroad.com/t/p1.jpg', mime: 'image/jpeg', name: 'carga.jpg' }, { url: 'https://lila.constroad.com/f/v1.mp4', mime: 'video/mp4' }, { url: 'http://inseguro/x.jpg', mime: 'image/jpeg' }], cubicage: { m3: 24.114116940799995, shape: 'Cuadrado', dimensions: [{ label: 'Largo', value: '5.20 m' }, { label: 'Ancho', value: '' }] } }],
    })!;
    // Act
    const sheet = detailSheet(withMedia, 'dispatches', 'd9')!;
    // Assert
    // The viewer dates each photo with the dispatch's departure, not «Hoy»; Portal's raw m³ comes with 15 decimals.
    const when = '2026-09-10T06:57:00.000Z';
    expect(sheet.media).toEqual([{ url: 'https://lila.constroad.com/f/p1.jpg', thumbUrl: 'https://lila.constroad.com/t/p1.jpg', mime: 'image/jpeg', name: 'carga.jpg', when }, { url: 'https://lila.constroad.com/f/v1.mp4', mime: 'video/mp4', name: 'AZJ 910 · video 2', when }]);
    expect(sheet.groups).toEqual([{ title: 'Cubicaje', facts: [{ label: 'Volquete cubica', value: '24.11 m³' }, { label: 'Forma', value: 'Cuadrado' }, { label: 'Largo', value: '5.20 m' }] }]);
  });

  it('a report with its PDF; one without asks Portal for it on demand (agentes 30/10)', () => {
    expect(detailSheet(detail, 'reports', 'r1')).toMatchObject({ facts: [{ label: 'Tipo', value: 'Producción de planta' }, { label: 'Fecha', value: '10 set' }], files: [{ url: 'https://lila.constroad.com/files/r1.pdf', label: 'PDF' }] });
    expect(detailSheet(detail, 'reports', 'r2')).toMatchObject({ files: [], pdfOnDemand: 'r2' });
    expect(detailSheet(detail, 'reports', 'r2')?.note).toBeUndefined();
  });

  it('a quote: total, day and its line items when they come', () => {
    const sheet = detailSheet(detail, 'quotes', 'q1')!;
    expect(sheet.facts).toEqual([{ label: 'Total', value: 'S/ 142,416.02' }, { label: 'Fecha', value: '28 ago' }]);
    expect(sheet.items).toEqual([{ name: 'Mezcla asfáltica', line: '383.5 m³ · S/ 320.00 c/u', total: 'S/ 122,720.00' }]);
  });

  it('a quote with its PDF (José 30/10 night: «en cotizaciones me gustaría poder ver el PDF»)', () => {
    const withPdf = serviceDetailOf({ service: { id: 's', name: 'S' }, orders: [], dispatches: [], reports: [], quotes: [{ id: 'q2', code: '301', status_label: 'Enviada', tone: 'info', pdf_url: 'https://lila.constroad.com/files/q301.pdf' }] })!;
    expect(detailSheet(withPdf, 'quotes', 'q2')?.files).toEqual([{ url: 'https://lila.constroad.com/files/q301.pdf', label: 'PDF' }]);
    expect(detailSheet(detail, 'quotes', 'q1')?.files).toEqual([]);
  });

  it('null for an id that is not there or for the collection tab', () => {
    expect(detailSheet(detail, 'orders', 'nada')).toBeNull();
    expect(detailSheet(detail, 'billing', 'o1')).toBeNull();
  });
});
