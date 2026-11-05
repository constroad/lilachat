import { describe, expect, it } from 'vitest';
import { accountQuoteLine, accountServiceLine, accountSummary, byUrgency, clientAccountOf, collectionByService, creditOrderLine } from './clientAccount.js';

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
    expect(byUrgency(orders, NOW).map((order) => order.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('the summary: Portal’s total pending, what is overdue today in Lima and how many are on credit', () => {
    expect(accountSummary(clientAccountOf(body)!, NOW)).toEqual({ pending: 26380, overdue: 8000, onCredit: 3 });
  });
});

/** The account said S/ 0.00 while the services owed S/ 1,365,828.12 (José, 05/11): services come with what they owe. */
describe('services to collect', () => {
  const withServices = {
    ...body,
    services: [
      { id: 's1', name: 'Asfaltado Av. Lima', total: 90000, collected: 40000, pending: 50000, is_credit: true, due_at: '2026-10-01' },
      { id: 's2', name: 'Imprimación', total: 7000, collected: 0, pending: 7000, is_credit: true, due_at: '2026-12-01' },
      { id: 's3', name: 'Contado', total: 500, pending: 500, is_credit: false, due_at: '2026-01-01' },
    ],
    pending: 83380,
    totals: { ...body.totals, services: 3 },
  };

  it('keeps each service and how many there are', () => {
    // Act
    const account = clientAccountOf(withServices)!;
    // Assert
    expect(account.services?.[0]).toEqual({ id: 's1', name: 'Asfaltado Av. Lima', total: 90000, collected: 40000, pending: 50000, isCredit: true, dueAt: '2026-10-01' });
    expect(account.totals.services).toBe(3);
  });

  it('a list that does not come stays absent: an older agentes keeps working', () => {
    const account = clientAccountOf(body)!;
    expect(account.services).toBeUndefined();
    expect(account.totals.services).toBeUndefined();
  });

  it('a due day only counts on credit', () => {
    expect(clientAccountOf(withServices)!.services?.[2]).toEqual({ id: 's3', name: 'Contado', total: 500, pending: 500, isCredit: false });
  });

  it('a due day with a time is not a calendar day: it is dropped, like an order’s', () => {
    const account = clientAccountOf({ ...body, services: [{ id: 's1', pending: 10, is_credit: true, due_at: '2026-10-01T05:00:00.000Z' }] })!;
    expect(account.services?.[0]).toEqual({ id: 's1', pending: 10, isCredit: true });
  });

  it('the overdue adds the credit services past due, and those on credit are counted', () => {
    // Act
    const summary = accountSummary(clientAccountOf(withServices)!, NOW);
    // Assert
    expect(summary).toEqual({ pending: 83380, overdue: 58000, onCredit: 5 });
  });

  it('the overdue service goes first', () => {
    const { services } = clientAccountOf({ ...withServices, services: [...withServices.services].reverse() })!;
    expect(byUrgency(services!, NOW).map((service) => service.id)).toEqual(['s1', 's2', 's3']);
  });

  it('a service’s line says its total and what was collected', () => {
    const [first, , third] = clientAccountOf(withServices)!.services!;
    expect(accountServiceLine(first!)).toBe('Total S/ 90,000.00 · Cobrado S/ 40,000.00');
    expect(accountServiceLine(third!)).toBe('Total S/ 500.00');
  });
});

/** Loroña's order said «28 oct» and was from 2025 (José, 05/11): an old date must not read as recent. */
describe('collectionByService (José 05/11: Cobranza lives in Cuenta, by service)', () => {
  const channel = [{ id: 's1', name: 'Pavimentación' }, { id: 's2', name: 'Imprimación' }, { id: 's3', name: 'Bacheo' }];
  const debts = [{ id: 's2', name: 'Imprimación Av. Lima', pending: 500, isCredit: false }, { id: 's3', pending: 900, isCredit: true, dueAt: '2020-01-01' }];
  const now = new Date('2026-11-05T15:00:00Z');

  it('what owes goes first, overdue on top; the rest of the channel\'s services follow without amounts', () => {
    expect(collectionByService(debts, channel, now).map((row) => row.id)).toEqual(['s3', 's2', 's1']);
    expect(collectionByService(debts, channel, now)[2]).toEqual({ id: 's1', name: 'Pavimentación', isCredit: false });
  });

  it('a debt keeps its own name, or the channel\'s when it comes without one', () => {
    const rows = collectionByService(debts, channel, now);
    expect(rows[0]?.name).toBe('Bacheo');
    expect(rows[1]?.name).toBe('Imprimación Av. Lima');
  });

  it('a service Portal charges and the channel does not list still shows', () => {
    expect(collectionByService([{ id: 's9', pending: 1, isCredit: false }], [], now).map((row) => row.id)).toEqual(['s9']);
  });

  it('without debts it is the channel\'s services; without either, nothing', () => {
    expect(collectionByService(undefined, channel, now)).toHaveLength(3);
    expect(collectionByService(undefined, [], now)).toEqual([]);
  });
});

describe('the year in the account’s lines', () => {
  it('an order from another year says it; one from this year does not', () => {
    const order = { id: 'o', product: 'MAC 2', quantity: 50, unit: 'm³', total: 12000, status: { label: 'Pendiente', tone: 'warn' as const } };
    expect(creditOrderLine({ ...order, date: '2025-10-28' }, NOW)).toBe('50 m³ · 28 oct 2025 · Total S/ 12,000.00');
    expect(creditOrderLine({ ...order, date: '2026-10-28' }, NOW)).toBe('50 m³ · 28 oct · Total S/ 12,000.00');
  });

  it('so does a quote, and it says when it has no service', () => {
    const quote = { id: 'q', total: 5000, status: { label: 'Aceptada', tone: 'ok' as const } };
    expect(accountQuoteLine({ ...quote, date: '2025-07-01' }, NOW)).toBe('S/ 5,000.00 · 1 jul 2025 · sin servicio');
    expect(accountQuoteLine({ ...quote, date: '2026-07-01', serviceId: 'srv-1' }, NOW)).toBe('S/ 5,000.00 · 1 jul');
  });
});
