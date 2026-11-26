import { describe, expect, it } from 'vitest';
import { BACKGROUND_DRAIN_BUDGET_MS, drainStep, shouldWakeToDrain } from './backgroundDrainPlan';

describe('draining the queues with the app closed (26/11)', () => {
  it('connects only signed in, with something pending, and when the app is not already running', () => {
    expect(shouldWakeToDrain({ pending: 3, appAlive: false, signedIn: true })).toBe(true);
    expect(shouldWakeToDrain({ pending: 0, appAlive: false, signedIn: true })).toBe(false);
    expect(shouldWakeToDrain({ pending: 3, appAlive: true, signedIn: true })).toBe(false);
    expect(shouldWakeToDrain({ pending: 3, appAlive: false, signedIn: false })).toBe(false);
  });

  it('keeps waiting while something is left, and resets the quiet count when work shows up again', () => {
    expect(drainStep({ pending: 2, elapsedMs: 10_000, quietChecks: 0 })).toEqual({ next: 'wait', quietChecks: 0 });
    expect(drainStep({ pending: 1, elapsedMs: 12_000, quietChecks: 1 })).toEqual({ next: 'wait', quietChecks: 0 });
  });

  it('stops after two empty checks in a row', () => {
    const first = drainStep({ pending: 0, elapsedMs: 20_000, quietChecks: 0 });
    expect(first).toEqual({ next: 'wait', quietChecks: 1 });
    expect(drainStep({ pending: 0, elapsedMs: 22_000, quietChecks: 1 })).toEqual({ next: 'stop', reason: 'done' });
  });

  it('stops when the budget is spent even with work left (the next wake goes on)', () => {
    expect(drainStep({ pending: 5, elapsedMs: BACKGROUND_DRAIN_BUDGET_MS, quietChecks: 0 })).toEqual({ next: 'stop', reason: 'budget' });
  });
});
