import { describe, expect, it } from 'vitest';
import { distanceMeters, liveCaption, liveMinutesOf, liveState, liveUntilFrom, shouldSendLiveUpdate, LIVE_KEEPALIVE_MS, LIVE_MAP_MAX_ZOOM, LIVE_MAP_MIN_ZOOM, LIVE_STALE_MS, clampMapZoom, liveStaleCaption } from './liveLocation.js';

/** Pending 11: live location for 15 min, 1 h or 8 h. */
const now = new Date('2026-10-28T15:00:00Z');
const plaza = { lat: -12.046374, lng: -77.042793 };

describe('live location', () => {
  it('takes only the three durations', () => {
    expect([15, '60', 480].map(liveMinutesOf)).toEqual([15, 60, 480]);
    expect([5, 0, 'x', null].map(liveMinutesOf)).toEqual([null, null, null, null]);
    expect(liveUntilFrom(15, now).toISOString()).toBe('2026-10-28T15:15:00.000Z');
  });

  it('a fixed point, a live one, and one that ended by time or by hand', () => {
    expect(liveState({}, now)).toBe('fixed');
    expect(liveState({ liveUntil: '2026-10-28T16:00:00Z' }, now)).toBe('live');
    expect(liveState({ liveUntil: '2026-10-28T14:59:00Z' }, now)).toBe('ended');
    expect(liveState({ liveUntil: '2026-10-28T16:00:00Z', endedAt: '2026-10-28T15:10:00Z' }, now)).toBe('ended');
  });

  it('sends a real move after the interval, or a keep-alive; not GPS noise', () => {
    const last = { ...plaza, at: now.getTime() };
    const moved = { lat: plaza.lat + 0.001, lng: plaza.lng };

    expect(shouldSendLiveUpdate(null, plaza, now.getTime())).toBe(true);
    expect(shouldSendLiveUpdate(last, moved, now.getTime() + 3_000)).toBe(false);
    expect(shouldSendLiveUpdate(last, moved, now.getTime() + 12_000)).toBe(true);
    expect(shouldSendLiveUpdate(last, { lat: plaza.lat + 0.00005, lng: plaza.lng }, now.getTime() + 30_000)).toBe(false);
    expect(shouldSendLiveUpdate(last, plaza, now.getTime() + LIVE_KEEPALIVE_MS)).toBe(true);
    expect(Math.round(distanceMeters(plaza, moved))).toBe(111);
  });

  it('says until when, or that it ended', () => {
    const clock = (iso: string) => iso.slice(11, 16);
    expect(liveCaption({ liveUntil: '2026-10-28T16:00:00Z' }, now, clock)).toBe('En tiempo real · hasta 16:00');
    expect(liveCaption({ liveUntil: '2026-10-28T16:00:00Z', endedAt: '2026-10-28T15:01:00Z' }, now, clock)).toBe('Ya no comparte su ubicación');
    expect(liveCaption({}, now, clock)).toBeNull();
  });
});

describe('a live location without signal (pending 12)', () => {
  const clock = (iso: string) => iso.slice(11, 16);
  const now = new Date('2026-10-29T15:10:00.000Z');
  const live = { lat: -12, lng: -77, liveUntil: '2026-10-29T16:00:00.000Z' };

  it('fresh, or not live, says nothing', () => {
    expect(liveStaleCaption({ ...live, updatedAt: '2026-10-29T15:08:30.000Z' }, now, clock)).toBeNull();
    expect(liveStaleCaption({ lat: -12, lng: -77, updatedAt: '2026-10-29T14:00:00.000Z' }, now, clock)).toBeNull();
    expect(liveStaleCaption({ ...live, endedAt: '2026-10-29T15:00:00.000Z', updatedAt: '2026-10-29T14:00:00.000Z' }, now, clock)).toBeNull();
  });

  it('three keep-alives missed: «Sin señal desde» the last point', () => {
    expect(liveStaleCaption({ ...live, updatedAt: '2026-10-29T15:07:00.000Z' }, now, clock)).toBe('Sin señal desde 15:07');
    expect(LIVE_STALE_MS).toBe(3 * 60_000);
  });

  it('the map zoom stays between the city and the street', () => {
    expect(clampMapZoom(20)).toBe(LIVE_MAP_MAX_ZOOM);
    expect(clampMapZoom(2)).toBe(LIVE_MAP_MIN_ZOOM);
    expect(clampMapZoom(15.6)).toBe(16);
  });
});
