import { describe, expect, it } from 'vitest';
import { archivedAgeGroup, archivedSince, isClientChannelLive, validateClientState, type ClientState } from './clientChannels.js';

/** Pending 21 (§157): a channel per client, live with an order in 90 days or an open service. */
const now = new Date('2026-10-29T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const state = (lastOrderAt: string | null, statuses: ClientState['services'][number]['status'][] = [], closedAt?: string): ClientState => ({
  name: 'Transportes Huaral',
  lastOrderAt,
  ordersTotal: 12,
  services: statuses.map((status, index) => ({ id: `s${index}`, name: `Servicio ${index}`, status, stage: 'ejecucion', stageLabel: 'Ejecución', ...(closedAt ? { closedAt } : {}) })),
});

describe('isClientChannelLive', () => {
  it('an order within 90 days keeps it live, the 91st day archives it', () => {
    expect(isClientChannelLive(state(daysAgo(89)), now)).toBe(true);
    expect(isClientChannelLive(state(daysAgo(91)), now)).toBe(false);
  });

  it('an open service keeps it live without orders; a closed one does not', () => {
    expect(isClientChannelLive(state(null, ['in_progress']), now)).toBe(true);
    expect(isClientChannelLive(state(daysAgo(200), ['pending']), now)).toBe(true);
    expect(isClientChannelLive(state(daysAgo(200), ['completed', 'rejected']), now)).toBe(false);
  });

  it('a client with no order and no service is archived', () => {
    expect(isClientChannelLive(state(null), now)).toBe(false);
  });
});

describe('archivedSince and archivedAgeGroup', () => {
  it('it was archived 90 days after the last order, or when its last service closed if later', () => {
    expect(archivedSince(state('2026-07-14T12:00:00Z'))).toBe('2026-10-12T12:00:00.000Z');
    expect(archivedSince(state('2026-07-14T12:00:00Z', ['completed'], '2026-10-20T10:00:00Z'))).toBe('2026-10-20T10:00:00.000Z');
    expect(archivedSince(state(null))).toBeNull();
  });

  it('groups by the age of the last order (design f-02)', () => {
    expect(archivedAgeGroup(daysAgo(100), now)).toBe('3-6');
    expect(archivedAgeGroup(daysAgo(200), now)).toBe('6+');
    expect(archivedAgeGroup(null, now)).toBe('6+');
  });
});

describe('validateClientState', () => {
  const wire = { name: ' Transportes Huaral ', ruc: '20491238471', last_order_at: '2026-07-14T12:00:00Z', orders_total: 12, services: [{ id: '64f1c2', name: 'Base granular km 12', status: 'in_progress', stage: 'ejecucion', stage_label: 'Ejecución', progress: 40, url: 'https://portal.constroad.com/x' }] };

  it('reads the snake_case body of the app', () => {
    const valid = validateClientState(wire);
    expect(valid).toEqual({ ok: true, state: { name: 'Transportes Huaral', ruc: '20491238471', lastOrderAt: '2026-07-14T12:00:00.000Z', ordersTotal: 12, services: [{ id: '64f1c2', name: 'Base granular km 12', status: 'in_progress', stage: 'ejecucion', stageLabel: 'Ejecución', progress: 40, url: 'https://portal.constroad.com/x' }] } });
  });

  it('refuses a missing name, an unknown status, a bad date and a progress out of 0–100', () => {
    expect(validateClientState({ ...wire, name: '' }).ok).toBe(false);
    expect(validateClientState({ ...wire, services: [{ ...wire.services[0], status: 'done' }] }).ok).toBe(false);
    expect(validateClientState({ ...wire, last_order_at: 'ayer' }).ok).toBe(false);
    expect(validateClientState({ ...wire, services: [{ ...wire.services[0], progress: 140 }] }).ok).toBe(false);
  });

  it('a client without orders yet sends last_order_at null', () => {
    const valid = validateClientState({ ...wire, last_order_at: null, orders_total: 0, services: [] });
    expect(valid.ok && valid.state.lastOrderAt).toBeNull();
  });
});
