import { describe, expect, it } from 'vitest';
import { serviceStages, stagesDone } from './serviceStages.js';
import type { ServiceDetail } from './serviceDetail.js';

/** José 30/10: how to measure what is done and what is pending. The stages come from Portal, not from a manual checklist. */
const ok = { label: 'Entregado', tone: 'ok' as const };
const draft = { label: 'Borrador', tone: 'neutral' as const };
const base: ServiceDetail = {
  service: { id: 's1', name: 'CHANCAY', progress: 14 },
  orders: [{ id: 'o1', status: ok }, { id: 'o2', status: { label: 'Pendiente', tone: 'warn' } }],
  dispatches: [{ id: 'd1', status: ok }],
  reports: [{ id: 'r1', title: 'Producción', status: { label: 'Publicado', tone: 'ok' } }, { id: 'r2', title: 'Área', status: draft }],
  totals: { orders: 2, dispatches: 15, reports: 7 },
};

describe('serviceStages', () => {
  it('orders done, dispatches going (an order still pending), reports going with how many are published', () => {
    // Act
    const stages = serviceStages(base);
    // Assert
    expect(stages.map((stage) => [stage.key, stage.state, stage.line])).toEqual([
      ['orders', 'done', '2 pedidos'],
      ['dispatches', 'doing', '15 despachos · 1 pedido por despachar'],
      ['reports', 'doing', '1 de 2 publicados'],
    ]);
    expect(stagesDone(stages)).toEqual({ done: 1, total: 3 });
  });

  it('with quotes and collection (the private view): approved quote, part invoiced, part collected', () => {
    const detail: ServiceDetail = {
      ...base,
      quotes: [{ id: 'q1', code: '313', status: { label: 'Aprobada', tone: 'ok' } }],
      billing: { total: 1000, isCredit: false, collected: 400, pending: 600, items: [{ name: 'MAC', invoiced: true }, { name: 'Imprimación', invoiced: false }], payments: [] },
    };
    const byKey = Object.fromEntries(serviceStages(detail).map((stage) => [stage.key, stage]));
    expect(byKey.quote).toMatchObject({ state: 'done', line: 'Cotización 313 aprobada' });
    expect(byKey.invoices).toMatchObject({ state: 'doing', line: '1 de 2 partidas facturadas' });
    expect(byKey.collection).toMatchObject({ state: 'doing', line: 'Cobrado S/ 400.00 de S/ 1,000.00' });
  });

  it('nothing yet: every stage pending; a quote not approved is going; all collected is done', () => {
    const empty: ServiceDetail = { service: { id: 's', name: 'S' }, orders: [], dispatches: [], reports: [], quotes: [{ id: 'q', status: draft }], billing: { total: 500, isCredit: true, collected: 500, pending: 0, items: [], payments: [] }, totals: { orders: 0, dispatches: 0, reports: 0 } };
    const stages = serviceStages(empty);
    expect(stages.map((stage) => [stage.key, stage.state])).toEqual([['quote', 'doing'], ['orders', 'pending'], ['dispatches', 'pending'], ['reports', 'pending'], ['invoices', 'pending'], ['collection', 'done']]);
  });
});
