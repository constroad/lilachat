import { describe, expect, it } from 'vitest';
import { archivedAgeGroup, archivedSince, isClientChannelLive, validateClientState } from './clientChannels.js';

/** Pending 21 (§157; José, 29/10): a channel per client, live with any movement in the last 60 days. */
const now = new Date('2026-10-29T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('isClientChannelLive', () => {
  it('a movement within 60 days keeps it live, the 61st day archives it', () => {
    expect(isClientChannelLive({ lastActivityAt: daysAgo(59) }, now)).toBe(true);
    expect(isClientChannelLive({ lastActivityAt: daysAgo(61) }, now)).toBe(false);
  });

  it('a client with no movement at all is archived', () => {
    expect(isClientChannelLive({ lastActivityAt: null }, now)).toBe(false);
  });
});

describe('archivedSince and archivedAgeGroup', () => {
  it('it was archived 60 days after its last movement', () => {
    expect(archivedSince({ lastActivityAt: '2026-07-14T12:00:00Z' })).toBe('2026-09-12T12:00:00.000Z');
    expect(archivedSince({ lastActivityAt: null })).toBeNull();
  });

  it('groups by the age of the last movement (design f-02)', () => {
    expect(archivedAgeGroup(daysAgo(100), now)).toBe('2-6');
    expect(archivedAgeGroup(daysAgo(200), now)).toBe('6+');
    expect(archivedAgeGroup(null, now)).toBe('6+');
  });
});

describe('validateClientState', () => {
  const wire = { name: ' Transportes Huaral ', ruc: '20491238471', last_activity_at: '2026-10-20T09:00:00Z', last_order_at: '2026-07-14T12:00:00Z', orders_total: 12, services: [{ id: '64f1c2', name: 'Base granular km 12', status: 'in_progress', stage: 'in_progress', stage_label: 'En ejecución', progress: 40, url: 'https://portal.constroad.com/x' }] };

  it('reads the snake_case body of the app', () => {
    const valid = validateClientState(wire);
    expect(valid).toEqual({ ok: true, state: { name: 'Transportes Huaral', ruc: '20491238471', lastActivityAt: '2026-10-20T09:00:00.000Z', lastOrderAt: '2026-07-14T12:00:00.000Z', ordersTotal: 12, services: [{ id: '64f1c2', name: 'Base granular km 12', status: 'in_progress', stage: 'in_progress', stageLabel: 'En ejecución', progress: 40, url: 'https://portal.constroad.com/x' }] } });
  });

  it('refuses a missing name, an unknown status, a bad date and a progress out of 0–100', () => {
    expect(validateClientState({ ...wire, name: '' }).ok).toBe(false);
    expect(validateClientState({ ...wire, services: [{ ...wire.services[0], status: 'done' }] }).ok).toBe(false);
    expect(validateClientState({ ...wire, last_activity_at: 'ayer' }).ok).toBe(false);
    expect(validateClientState({ ...wire, services: [{ ...wire.services[0], progress: 140 }] }).ok).toBe(false);
  });

  it('a long Drive link of a service is not cut at 160 characters', () => {
    const url = `https://portal.constroad.com/drive/${'a'.repeat(300)}`;
    const valid = validateClientState({ ...wire, services: [{ ...wire.services[0], url }] });
    expect(valid.ok && valid.state.services[0]!.url).toBe(url);
  });

  it('keeps the client Drive folder only when it is https', () => {
    expect(validateClientState({ ...wire, drive_url: 'https://portal.constroad.com/drive/c1' })).toMatchObject({ ok: true, state: { driveUrl: 'https://portal.constroad.com/drive/c1' } });
    const plain = validateClientState({ ...wire, drive_url: 'http://x.com' });
    expect(plain.ok && 'driveUrl' in plain.state).toBe(false);
  });

  it('a client without orders yet sends last_order_at null', () => {
    const valid = validateClientState({ ...wire, last_order_at: null, orders_total: 0, services: [] });
    expect(valid.ok && valid.state.lastOrderAt).toBeNull();
  });
});
