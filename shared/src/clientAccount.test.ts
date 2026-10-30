import { describe, expect, it } from 'vitest';
import { accountSummary, clientAccountOf, creditOrdersByUrgency } from './clientAccount.js';

/** José 30/10: «¿dónde veo las cotizaciones del cliente?» — `client.account.requested` (agentes cf37b98, Portal 0227a1f0, design f-08). */
const body = {
  client: { id: 'cli-carceli', name: 'CARCELI SAC' },
  quotes: [
    { id: 'q1', code: '313', date: '2026-08-28', service_id: 'srv-1', total: 168050.71, status_label: 'Borrador', tone: 'neutral', items: [{ name: 'Mezcla', total: 1 }] },
    { id: 'q2', code: '290', date: '2026-07-01', total: 5000, status_label: 'Aceptada', tone: 'ok' },
  ],
  credit_orders: [
    { id: 'o1', service_id: 'srv-1', date: '2026-10-01', product: 'MAC 2', quantity: 50, unit: 'm³', total: 12000, due_at: '2026-10-26', collected: 4000, pending: 8000, status_label: 'Despachado', tone: 'ok' },
    { id: 'o2', product: 'Imprimación', total: 3000, due_at: '2026-11-15', pending: 3000, status_label: 'Pendiente', tone: 'warn' },
    { id: 'o3', product: 'Sin vencimiento', pending: 100, status_label: 'Pendiente', tone: 'warn' },
  ],
  pending: 26380,
  totals: { quotes: 12, credit_orders: 3 },
};
const NOW = new Date('2026-10-30T15:00:00.000Z');

describe('clientAccountOf', () => {
  it('keeps the quotes (with their service and line items), the credit orders and Portal’s pending', () => {
    // Act
    const account = clientAccountOf(body)!;
    // Assert
    expect(account.client).toEqual({ id: 'cli-carceli', name: 'CARCELI SAC' });
    expect(account.quotes?.[0]).toMatchObject({ id: 'q1', code: '313', serviceId: 'srv-1', total: 168050.71, items: [{ name: 'Mezcla', total: 1 }] });
    expect(account.creditOrders?.[0]).toEqual({ id: 'o1', serviceId: 'srv-1', date: '2026-10-01', product: 'MAC 2', quantity: 50, unit: 'm³', total: 12000, dueAt: '2026-10-26', collected: 4000, pending: 8000, status: { label: 'Despachado', tone: 'ok' } });
    expect(account.pending).toBe(26380);
    expect(account.totals).toEqual({ quotes: 12, creditOrders: 3 });
  });

  it('a list that does not come is one that person may not see: it stays absent', () => {
    const account = clientAccountOf({ client: { id: 'c', name: 'C' }, totals: {} })!;
    expect(account.quotes).toBeUndefined();
    expect(account.creditOrders).toBeUndefined();
    expect(account.pending).toBeUndefined();
  });

  it('is null without a client', () => {
    expect(clientAccountOf({ quotes: [] })).toBeNull();
    expect(clientAccountOf(null)).toBeNull();
  });
});

describe('the account in Lima days', () => {
  it('overdue first (oldest due first), then the next to fall due, then those with no due day', () => {
    const orders = clientAccountOf(body)!.creditOrders!;
    expect(creditOrdersByUrgency(orders, NOW).map((order) => order.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('the summary: Portal’s total pending, what is overdue today in Lima and how many are on credit', () => {
    expect(accountSummary(clientAccountOf(body)!, NOW)).toEqual({ pending: 26380, overdue: 8000, onCredit: 3 });
  });
});
