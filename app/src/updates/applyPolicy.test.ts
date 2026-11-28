import { describe, expect, it } from 'vitest';
import { MIN_BACKGROUND_BEFORE_APPLY_MS, restartDecision, shouldApplyUpdateNow, shouldCheckForUpdate, type ApplyContext } from './applyPolicy';

/** The moment the app comes back to the foreground with a downloaded update waiting. */
const idleReturn: ApplyContext = {
  updatePending: true,
  backgroundMs: MIN_BACKGROUND_BEFORE_APPLY_MS,
  callInProgress: false,
  unsentMessages: 0,
  unsentFiles: 0,
};

describe('shouldApplyUpdateNow (OTA applies only when nobody is using the app)', () => {
  it('applies a downloaded update when the app comes back after at least 10 minutes away and nothing is in flight', () => {
    // Act
    const decision = shouldApplyUpdateNow(idleReturn);
    // Assert
    expect(decision).toBe('apply');
  });

  it('keeps waiting when there is no downloaded update', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, updatePending: false })).toBe('no-update');
  });

  it('keeps waiting when the person was away less than 10 minutes (a quick glance at another app)', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, backgroundMs: MIN_BACKGROUND_BEFORE_APPLY_MS - 1 })).toBe('short-absence');
  });

  it('keeps waiting when the time away is unknown (never reloads on a guess)', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, backgroundMs: null })).toBe('short-absence');
  });

  it('never reloads during a call', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, callInProgress: true })).toBe('in-call');
  });

  it('never reloads with a message still waiting in the outbox', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, unsentMessages: 1 })).toBe('unsent');
  });

  it('never reloads with a photo, file or voice note still waiting to upload', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, unsentFiles: 2 })).toBe('unsent');
  });

  it('a call wins over a short absence (the reason reported is the one that blocks first in life: the call)', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, callInProgress: true, backgroundMs: 0 })).toBe('in-call');
  });

  it('a negative time away (clock moved back) is not enough to apply', () => {
    expect(shouldApplyUpdateNow({ ...idleReturn, backgroundMs: -5 })).toBe('short-absence');
  });
});

describe('shouldCheckForUpdate (a quiet check, never a hammer)', () => {
  const minute = 60_000;

  it('checks the first time (never checked)', () => {
    expect(shouldCheckForUpdate(null, 1_000_000)).toBe(true);
  });

  it('does not check again within 5 minutes of the last check', () => {
    expect(shouldCheckForUpdate(1_000_000, 1_000_000 + 5 * minute - 1)).toBe(false);
  });

  it('checks again once 5 minutes have passed', () => {
    expect(shouldCheckForUpdate(1_000_000, 1_000_000 + 5 * minute)).toBe(true);
  });

  it('checks when the clock went backwards (a stale last check must not silence the updater forever)', () => {
    expect(shouldCheckForUpdate(2_000_000, 1_000_000)).toBe(true);
  });
});

describe('restartDecision («Reiniciar» from the prompt, José 28/11)', () => {
  const asked = { updatePending: true, callInProgress: false, unsentMessages: 0, unsentFiles: 0 };

  it('restarts at once, with no absence needed', () => {
    expect(restartDecision(asked)).toBe('apply');
  });

  it('waits while photos or messages are still going out', () => {
    expect(restartDecision({ ...asked, unsentFiles: 2 })).toBe('unsent');
    expect(restartDecision({ ...asked, unsentMessages: 1 })).toBe('unsent');
  });

  it('never cuts a call, and does nothing without a downloaded update', () => {
    expect(restartDecision({ ...asked, callInProgress: true })).toBe('in-call');
    expect(restartDecision({ ...asked, updatePending: false })).toBe('no-update');
  });
});
