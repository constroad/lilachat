/**
 * When an OTA update (self-hosted Expo Updates, agentes 25/10/2026) may be
 * APPLIED. Downloading is silent and free; reloading the JavaScript is not:
 * it drops what is on screen. So it happens only when the app comes back to
 * the foreground after a real absence and nothing is in flight.
 */
export const MIN_BACKGROUND_BEFORE_APPLY_MS = 10 * 60_000;
/** How often the quiet check runs while the app is in use. */
export const CHECK_EVERY_MS = 30 * 60_000;
/**
 * Pending 13: expo-updates purges its own log at launch by reading EVERY line
 * into memory; a 40 MB log gave an OutOfMemoryError (E2E 28/10). Nobody reads
 * that log, so it is emptied (written blank, never read) a while after start.
 */
export const CLEAR_UPDATES_LOG_AFTER_MS = 20_000;
/** Coming back to the app checks too, but never twice within this gap. */
export const MIN_GAP_BETWEEN_CHECKS_MS = 5 * 60_000;

export type ApplyContext = {
  /** An update is downloaded and waiting (`useUpdates().isUpdatePending`). */
  updatePending: boolean;
  /** How long the app spent in the background before this return; null when unknown. */
  backgroundMs: number | null;
  callInProgress: boolean;
  /** Messages still in the outbox. */
  unsentMessages: number;
  /** Photos, files and voice notes still waiting to upload. */
  unsentFiles: number;
};

export type ApplyDecision = 'apply' | 'no-update' | 'in-call' | 'unsent' | 'short-absence';

export function shouldApplyUpdateNow(context: ApplyContext): ApplyDecision {
  if (!context.updatePending) return 'no-update';
  if (context.callInProgress) return 'in-call';
  if (context.unsentMessages > 0 || context.unsentFiles > 0) return 'unsent';
  if (context.backgroundMs === null || context.backgroundMs < MIN_BACKGROUND_BEFORE_APPLY_MS) return 'short-absence';
  return 'apply';
}

/** A clock that moved backwards must not silence the updater until it catches up. */
export function shouldCheckForUpdate(lastCheckAt: number | null, now: number): boolean {
  if (lastCheckAt === null || now < lastCheckAt) return true;
  return now - lastCheckAt >= MIN_GAP_BETWEEN_CHECKS_MS;
}
