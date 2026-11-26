import { describe, expect, it } from 'vitest';
import { shouldRehydrate, isOnline, REHYDRATE_EVERY_MS, networkCameBack } from './networkReturn';

describe('isOnline', () => {
  it('connected with internet, or not measured yet, is online', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('wifi without internet or no link at all is offline', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isOnline({ isConnected: false })).toBe(false);
    expect(isOnline({})).toBe(false);
  });
});

describe('networkCameBack', () => {
  it('offline to online is a return', () => {
    expect(networkCameBack(false, { isConnected: true, isInternetReachable: true })).toEqual({ online: true, cameBack: true });
  });

  it('the first reading is not a return', () => {
    expect(networkCameBack(null, { isConnected: true, isInternetReachable: true }).cameBack).toBe(false);
  });

  it('online to online, or going offline, is not a return', () => {
    expect(networkCameBack(true, { isConnected: true, isInternetReachable: true }).cameBack).toBe(false);
    expect(networkCameBack(true, { isConnected: false })).toEqual({ online: false, cameBack: false });
  });
});

describe('shouldRehydrate', () => {
  const NOW = 1_764_000_000_000;

  it('runs the first time and after ten minutes', () => {
    expect(shouldRehydrate(null, NOW)).toBe(true);
    expect(shouldRehydrate(NOW - REHYDRATE_EVERY_MS, NOW)).toBe(true);
  });

  it('not again sooner', () => {
    expect(shouldRehydrate(NOW - REHYDRATE_EVERY_MS + 1, NOW)).toBe(false);
  });
});
