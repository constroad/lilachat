import { describe, expect, it } from 'vitest';
import { APP_LOCK_DELAYS, DEFAULT_APP_LOCK_DELAY_MS, appLockDelayOf, appLockDue, blockActionLabel } from './blockedContacts.js';

describe('blocked contacts texts (pending 9)', () => {
  it('the action says what it will do', () => {
    expect(blockActionLabel(false, 'Ana')).toBe('Bloquear a Ana');
    expect(blockActionLabel(true, 'Ana')).toBe('Desbloquear a Ana');
  });
});

describe('app lock (pending 9)', () => {
  it('three delays, one minute by default; an unknown one falls back', () => {
    expect(APP_LOCK_DELAYS.map((delay) => delay.ms)).toEqual([0, 60_000, 1_800_000]);
    expect(appLockDelayOf(0)).toBe(0);
    expect(appLockDelayOf(5)).toBe(DEFAULT_APP_LOCK_DELAY_MS);
    expect(appLockDelayOf(undefined)).toBe(DEFAULT_APP_LOCK_DELAY_MS);
  });

  it('off never locks; a cold start with it on always does', () => {
    expect(appLockDue({ enabled: false, delayMs: 0, hiddenAt: 0, now: 99_999, coldStart: true })).toBe(false);
    expect(appLockDue({ enabled: true, delayMs: 60_000, hiddenAt: null, now: 0, coldStart: true })).toBe(true);
  });

  it('back before the delay stays open; at the delay or after, it locks', () => {
    expect(appLockDue({ enabled: true, delayMs: 60_000, hiddenAt: 1_000, now: 60_999 })).toBe(false);
    expect(appLockDue({ enabled: true, delayMs: 60_000, hiddenAt: 1_000, now: 61_000 })).toBe(true);
    expect(appLockDue({ enabled: true, delayMs: 0, hiddenAt: 1_000, now: 1_000 })).toBe(true);
  });

  it('never left the app: nothing to ask', () => {
    expect(appLockDue({ enabled: true, delayMs: 0, hiddenAt: null, now: 5_000 })).toBe(false);
  });
});
