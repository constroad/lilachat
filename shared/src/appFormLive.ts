import type { FormField, FormValues } from './appForms.js';

/** How long typing must stop before the app is asked again (agentes 30/10: its budget is 3 s). */
export const LIVE_TYPING_PAUSE_MS = 600;

const sameValue = (before: unknown, now: unknown): boolean => JSON.stringify(before ?? null) === JSON.stringify(now ?? null);

/**
 * When a changed `x-refresh` field asks the app for the form again (Andrea 12/11: the clients,
 * then the partidas, took long). A pick —a choice, a check, a date— is final: it leaves at once.
 * Typing a text or a number waits until it settles, so every key is not a call.
 */
export function refreshDelayMs(fields: readonly FormField[], before: FormValues, now: FormValues): number {
  const changed = fields.filter((field) => field.refresh && !sameValue(before[field.name], now[field.name]));
  return changed.some((field) => field.kind === 'text' || field.kind === 'number') ? LIVE_TYPING_PAUSE_MS : 0;
}

/** A list or a long picker needs room (Andrea 12/11: the partidas showed in a tiny space): the dialog goes wide. */
export const isWideForm = (fields: readonly FormField[]): boolean => fields.some((field) => field.kind === 'list' || (field.kind === 'choice' && field.searchable && !field.segmented));
