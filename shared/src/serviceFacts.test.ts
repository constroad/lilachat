import { describe, expect, it } from 'vitest';
import { serviceCardFacts, serviceFactsFromWire, SERVICE_ACTIVITY_TEXT_MAX } from './serviceFacts.js';

/** José 19/11 (design cc-01): pedidos, informes, etapas and the last movement per service, only when Portal sends them. */
describe('serviceFactsFromWire', () => {
  it('keeps the four optional fields in the camelCase keys agentes sends', () => {
    // Arrange
    const body = { ordersCount: 2, reportsCount: 3, stagesTotal: 6, lastActivity: { at: '2026-11-19T14:40:00Z', text: '  Observación   Parche 12 ' } };
    // Act
    const facts = serviceFactsFromWire(body);
    // Assert
    expect(facts).toEqual({ ordersCount: 2, reportsCount: 3, stagesTotal: 6, lastActivity: { at: '2026-11-19T14:40:00.000Z', text: 'Observación Parche 12' } });
  });

  it('a service without data sends 0/0/0 and keeps its zeros', () => {
    expect(serviceFactsFromWire({ ordersCount: 0, reportsCount: 0, stagesTotal: 0 })).toEqual({ ordersCount: 0, reportsCount: 0, stagesTotal: 0 });
  });

  it('drops what is not a whole number ≥ 0 and ignores snake_case look-alikes, never inventing a figure', () => {
    const facts = serviceFactsFromWire({ ordersCount: -1, reportsCount: 2.5, stagesTotal: '6', orders_count: 4, extra: 7 });
    expect(facts).toEqual({});
  });

  it('drops a last movement with a bad date or no text, and cuts a long text', () => {
    // Arrange
    const long = 'x'.repeat(200);
    // Act
    const badDate = serviceFactsFromWire({ lastActivity: { at: 'ayer', text: 'Informe' } });
    const noText = serviceFactsFromWire({ lastActivity: { at: '2026-11-19T14:40:00Z', text: '   ' } });
    const notObject = serviceFactsFromWire({ lastActivity: 'Informe' });
    const cut = serviceFactsFromWire({ lastActivity: { at: '2026-11-19T14:40:00Z', text: long } });
    // Assert
    expect(badDate).toEqual({});
    expect(noText).toEqual({});
    expect(notObject).toEqual({});
    expect(cut.lastActivity?.text).toHaveLength(SERVICE_ACTIVITY_TEXT_MAX);
  });

  it('an empty or missing body gives nothing', () => {
    expect(serviceFactsFromWire({})).toEqual({});
    expect(serviceFactsFromWire(null)).toEqual({});
  });
});

describe('serviceCardFacts', () => {
  const now = new Date('2026-11-19T17:00:00Z');

  it('says the counts, the start with its stages and the last movement of today', () => {
    // Arrange
    const service = { started_at: '2026-11-12', ordersCount: 2, reportsCount: 1, stagesTotal: 6, lastActivity: { at: '2026-11-19T14:40:00.000Z', text: 'Observación Parche 12' } };
    // Act
    const facts = serviceCardFacts(service, now);
    // Assert
    expect(facts).toEqual({ ordersCount: 2, reportsCount: 1, ordersLabel: '2 pedidos', reportsLabel: '1 informe', startLine: 'Inicio 12 nov · 6 etapas', lastActivity: { when: 'Hoy 09:40', text: 'Observación Parche 12' } });
  });

  it('reads yesterday and an older day in Lima', () => {
    const yesterday = serviceCardFacts({ lastActivity: { at: '2026-11-18T22:05:00.000Z', text: 'Control de pista' } }, now);
    const older = serviceCardFacts({ lastActivity: { at: '2026-11-02T15:00:00.000Z', text: 'Informe de servicio' } }, now);
    // 00:30 in Lima on the 19th is «Hoy»; 23:30 on the 18th in Lima is already the 19th in UTC and still «Ayer».
    const afterMidnight = serviceCardFacts({ lastActivity: { at: '2026-11-19T05:30:00.000Z', text: 'Despacho' } }, now);
    const beforeMidnight = serviceCardFacts({ lastActivity: { at: '2026-11-19T04:30:00.000Z', text: 'Despacho' } }, now);
    expect(yesterday.lastActivity?.when).toBe('Ayer 17:05');
    expect(older.lastActivity?.when).toBe('2 nov');
    expect(afterMidnight.lastActivity?.when).toBe('Hoy 00:30');
    expect(beforeMidnight.lastActivity?.when).toBe('Ayer 23:30');
  });

  it('leaves out what did not come: no figure is made up', () => {
    expect(serviceCardFacts({}, now)).toEqual({ startLine: '' });
  });

  it('a single stage, an order and no stages at all read right', () => {
    expect(serviceCardFacts({ ordersCount: 1, stagesTotal: 1 }, now)).toMatchObject({ ordersLabel: '1 pedido', startLine: '1 etapa' });
    expect(serviceCardFacts({ started_at: '2026-10-06', stagesTotal: 0 }, now).startLine).toBe('Inicio 6 oct');
  });
});
