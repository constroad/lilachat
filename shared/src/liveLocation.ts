/**
 * Live location (pending 11), like WhatsApp: 15 min, 1 h or 8 h; the card
 * follows the phone until the time is up or the person stops it. The point
 * travels on the same `location` message. PURE: server, app and web.
 */
import type { SharedLocation } from './sharedLocation.js';

export const LIVE_LOCATION_MINUTES = [15, 60, 480] as const;
export type LiveLocationMinutes = (typeof LIVE_LOCATION_MINUTES)[number];
export type LiveLocation = SharedLocation & { liveUntil?: string; endedAt?: string; updatedAt?: string };
export type LiveState = 'fixed' | 'live' | 'ended';

/** A send is not repeated more often than this, however much the phone moves (ms). */
export const LIVE_MIN_INTERVAL_MS = 10_000;
/** Without moving, one send this often says «still here» (ms). */
export const LIVE_KEEPALIVE_MS = 60_000;
/** Less than this is GPS noise, not a move (m). */
const LIVE_MIN_MOVE_M = 25;
const EARTH_RADIUS_M = 6_371_000;
const MS_PER_MINUTE = 60_000;

export function liveMinutesOf(raw: unknown): LiveLocationMinutes | null {
  const minutes = Number(raw);
  return (LIVE_LOCATION_MINUTES as readonly number[]).includes(minutes) ? (minutes as LiveLocationMinutes) : null;
}

export const liveUntilFrom = (minutes: LiveLocationMinutes, now: Date): Date => new Date(now.getTime() + minutes * MS_PER_MINUTE);

export function liveState(location: Pick<LiveLocation, 'liveUntil' | 'endedAt'>, now: Date): LiveState {
  if (!location.liveUntil) return 'fixed';
  if (location.endedAt || new Date(location.liveUntil).getTime() <= now.getTime()) return 'ended';
  return 'live';
}

/** Haversine distance between two points (m). */
export function distanceMeters(a: SharedLocation, b: SharedLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Whether a new fix is worth sending: a real move after the minimum interval, or a keep-alive. */
export function shouldSendLiveUpdate(last: (SharedLocation & { at: number }) | null, next: SharedLocation, now: number): boolean {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed >= LIVE_KEEPALIVE_MS) return true;
  return elapsed >= LIVE_MIN_INTERVAL_MS && distanceMeters(last, next) >= LIVE_MIN_MOVE_M;
}

/** The line under the map: until when, or that it ended. `clock` formats a time in the reader's zone. */
export function liveCaption(location: Pick<LiveLocation, 'liveUntil' | 'endedAt'>, now: Date, clock: (iso: string) => string): string | null {
  const state = liveState(location, now);
  if (state === 'fixed') return null;
  return state === 'live' ? `En tiempo real · hasta ${clock(location.liveUntil!)}` : 'Ya no comparte su ubicación';
}
