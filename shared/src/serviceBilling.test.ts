import { describe, expect, it } from 'vitest';
import { billingOf, billingSummary, dueStatus, moneyOf } from './serviceBilling.js';
import { detailTabs, longDayOf, serviceDetailOf } from './serviceDetail.js';

/** A service's collection (design f-05), as agentes answers it inside `client.service.requested` (shape closed with Portal e7d3ffd7). */
const raw = {
  total: 48380,
  is_credit: true,
  due_at: '2026-11-15',
  collected: 30000,
  pending: 18380,
  detraction_rate: 0.04,
  items: [
    { name: 'Mezcla asfáltica en caliente 200 m³', total: 38000, invoiced: true },
    { name: 'Transporte a obra', total: 6000, invoiced: false },
    { total: 1 },
  ],
  payments: [
    { date: '2026-10-20', amount: 30000, method: 'Transferencia', reference: 'OP-7781', voucher_url: 'https://lila.constroad.com/files/v1.jpg' },
    { date: 'ayer', amount: 5 },
    { date: '2026-10-21', amount: -3 },
  ],
};

/** 30/10/2026 at 23:30 in Lima is already the 31st in UTC. */
const LATE_IN_LIMA = new Date('2026-10-31T04:30:00.000Z');

describe('billingOf', () => {
  it('keeps what validates: positive amounts, a calendar day, https vouchers, named items', () => {
    expect(billingOf(raw)).toEqual({
      total: 48380,
      isCredit: true,
      dueAt: '2026-11-15',
      collected: 30000,
      pending: 18380,
      detractionRate: 0.04,
      items: [
        { name: 'Mezcla asfáltica en caliente 200 m³', total: 38000, invoiced: true },
        { name: 'Transporte a obra', total: 6000, invoiced: false },
      ],
      payments: [{ date: '2026-10-20', amount: 30000, method: 'Transferencia', reference: 'OP-7781', voucherUrl: 'https://lila.constroad.com/files/v1.jpg' }],
    });
  });

  it('CHANCAY: billing with no payment yet is still a billing; a due day only counts on credit', () => {
    expect(billingOf({ total: 142416.02, is_credit: false, due_at: '2026-11-15', collected: 0, pending: 142416.02, items: [], payments: [] })).toEqual({ total: 142416.02, isCredit: false, collected: 0, pending: 142416.02, items: [], payments: [] });
  });

  it('is null when it is not an object', () => {
    expect(billingOf(null)).toBeNull();
    expect(billingOf([])).toBeNull();
    expect(billingOf('x')).toBeNull();
  });
});

describe('billingSummary', () => {
  it('uses Portal’s pending; progress is collected over total', () => {
    expect(billingSummary(billingOf(raw)!)).toEqual({ pending: 18380, progress: 62, detraction: 1935.2, detractionPercent: 4, paidOff: false });
  });

  it('derives pending when it does not come; a rate in percent is the same rate', () => {
    expect(billingSummary(billingOf({ total: 1000, collected: 250, detraction_rate: 4 })!)).toEqual({ pending: 750, progress: 25, detraction: 40, detractionPercent: 4, paidOff: false });
  });

  it('paid off when nothing is pending; no total means nothing to derive', () => {
    expect(billingSummary(billingOf({ total: 500, collected: 500 })!)).toMatchObject({ pending: 0, progress: 100, paidOff: true });
    expect(billingSummary(billingOf({ total: 0, collected: 0 })!)).toEqual({ pending: 0, progress: 0, paidOff: true });
    expect(billingSummary(billingOf({ collected: 10 })!)).toEqual({ paidOff: false });
  });
});

describe('dueStatus', () => {
  it('counts calendar days in Lima, not UTC', () => {
    expect(dueStatus('2026-11-15', LATE_IN_LIMA)).toEqual({ label: 'en 16 días', tone: 'warn' });
    expect(dueStatus('2026-10-31', LATE_IN_LIMA)).toEqual({ label: 'vence mañana', tone: 'warn' });
    expect(dueStatus('2026-10-30', LATE_IN_LIMA)).toEqual({ label: 'vence hoy', tone: 'error' });
  });

  it('overdue reads how long ago', () => {
    expect(dueStatus('2026-10-29', LATE_IN_LIMA)).toEqual({ label: 'venció ayer', tone: 'error' });
    expect(dueStatus('2026-10-20', LATE_IN_LIMA)).toEqual({ label: 'venció hace 10 días', tone: 'error' });
  });
});

describe('moneyOf', () => {
  it('soles with two decimals', () => {
    expect(moneyOf(48380)).toBe('S/ 48,380.00');
    expect(moneyOf(1935.2)).toBe('S/ 1,935.20');
  });
});

describe('the detail carries it', () => {
  const detail = { service: { id: 's', name: 'CHANCAY' }, orders: [], dispatches: [], reports: [], quotes: [] };

  it('«Cobranza» is a tab only when billing came', () => {
    expect(detailTabs(serviceDetailOf({ ...detail, billing: raw })!).map((tab) => tab.label)).toEqual(['Cotizaciones · 0', 'Cobranza', 'Pedidos · 0', 'Despachos · 0', 'Informes · 0']);
    expect(detailTabs(serviceDetailOf(detail)!).map((tab) => tab.key)).not.toContain('billing');
    expect(serviceDetailOf({ ...detail, billing: 'roto' })!.billing).toBeUndefined();
  });

  it('a due day reads with its year', () => {
    expect(longDayOf('2026-11-15')).toBe('15 nov 2026');
    expect(longDayOf('pronto')).toBe('pronto');
  });
});
