/**
 * When the app was closed (swiped away or killed by the system) with work still on the phone (José 26/11: a site
 * without signal), the system wakes a background task when there is network. These rules decide, PURE:
 * whether to connect at all, and when to stop — everything left, or the run's budget spent (WorkManager gives 10 min).
 */
export const BACKGROUND_DRAIN_BUDGET_MS = 8 * 60_000;
export const BACKGROUND_DRAIN_CHECK_MS = 2_000;
/** Two empty checks in a row: a queue that just finished a job may still be writing its next state. */
const QUIET_CHECKS_TO_STOP = 2;

export type DrainState = { pending: number; elapsedMs: number; quietChecks: number };
export type DrainStep = { next: 'wait'; quietChecks: number } | { next: 'stop'; reason: 'done' | 'budget' };

/** Only with something to send and the app not already running (a living app sends by itself). */
export const shouldWakeToDrain = (input: { pending: number; appAlive: boolean; signedIn: boolean }): boolean =>
  input.signedIn && !input.appAlive && input.pending > 0;

export function drainStep(state: DrainState, budgetMs: number = BACKGROUND_DRAIN_BUDGET_MS): DrainStep {
  const quietChecks = state.pending > 0 ? 0 : state.quietChecks + 1;
  if (quietChecks >= QUIET_CHECKS_TO_STOP) return { next: 'stop', reason: 'done' };
  if (state.elapsedMs >= budgetMs) return { next: 'stop', reason: 'budget' };
  return { next: 'wait', quietChecks };
}
