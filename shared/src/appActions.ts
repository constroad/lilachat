import { answerOfOutcome, type CommandGroup, type CommandOutcome, type EphemeralAnswer } from './botCommands.js';
import type { AppForm, FormField, FormValues, GeoPoint } from './appForms.js';

/**
 * The actions of the apps (R160): the rows of «Acciones rápidas» (the space's ⚡,
 * design e-30, and the composer's «+», e-29) and what sending a form leaves on
 * screen. PURE: the app and the web draw with it.
 */
/** `command`: a slash command the admin made global, run from the ⚡ with no text. */
export type ShortcutRow = { kind: 'shortcut' | 'command'; appId: string; appName: string; avatarUrl?: string; key: string; name: string; description?: string };

const appOf = (group: CommandGroup) => ({ appId: group.appId, appName: group.appName, ...(group.avatarUrl ? { avatarUrl: group.avatarUrl } : {}) });

/** The «+» of a chat: its actions (the commands are a «/» away). */
export function shortcutRows(groups: readonly CommandGroup[]): ShortcutRow[] {
  return groups.flatMap((group) => (group.shortcuts ?? []).map((shortcut) => ({ kind: 'shortcut' as const, ...appOf(group), ...shortcut })));
}

/** The space's ⚡: the actions and the commands the server says are global here, app by app. */
export function quickActionRows(groups: readonly CommandGroup[]): ShortcutRow[] {
  return groups.flatMap((group) => [
    ...(group.shortcuts ?? []).map((shortcut) => ({ kind: 'shortcut' as const, ...appOf(group), ...shortcut })),
    ...group.commands.map((entry) => ({ kind: 'command' as const, ...appOf(group), key: entry.command, name: `/${entry.command}`, description: entry.description })),
  ]);
}

const METERS_PER_KM = 1000;

/** What the phone or the browser measured, as the form sends it: the precision in whole meters. */
export function geoPointOf(coords: { latitude: number; longitude: number; accuracy: number }): GeoPoint {
  return { lat: coords.latitude, lng: coords.longitude, precision: Math.max(1, Math.round(coords.accuracy)) };
}

export function precisionLabel(point: GeoPoint): string {
  if (point.precision < METERS_PER_KM) return `± ${point.precision} m`;
  // Like `accuracyLabel` of a shared location: «1,5 km».
  return `± ${(point.precision / METERS_PER_KM).toFixed(1).replace('.', ',')} km`;
}

/** The server's answer to a sent form: `errors` are the 422's, `message` a refusal (expired, uninstalled). */
export type FormSubmitReply = { ok: true; outcome: CommandOutcome } | { ok: false; errors?: Record<string, string>; message?: string };
export type FormSubmitOutcome = { done: true; answer: EphemeralAnswer | null } | { done: false; errors: Record<string, string>; message?: string };

export function formSubmitOutcome(reply: FormSubmitReply, command: string): FormSubmitOutcome {
  if (!reply.ok) return { done: false, errors: reply.errors ?? {}, ...(reply.message ? { message: reply.message } : {}) };
  if (reply.outcome.outcome === 'failed') return { done: false, errors: {}, message: reply.outcome.message ?? `${reply.outcome.appName} no pudo responder.` };
  return { done: true, answer: answerOfOutcome(reply.outcome, command) };
}

/** «Marcar ingreso»: the app's button with the option picked in the first side-by-side choice. */
export function submitLabelOf(form: Pick<AppForm, 'submitLabel'>, fields: readonly FormField[], values: FormValues): string {
  const label = form.submitLabel ?? 'Enviar';
  const choice = fields.find((field): field is Extract<FormField, { kind: 'choice' }> => field.kind === 'choice' && field.segmented);
  const picked = choice?.options.find((option) => option.value === values[choice.name]);
  return picked && form.submitLabel ? `${label} ${picked.label.toLocaleLowerCase('es')}` : label;
}

/** The foot under the button: what is sent with the form besides what was typed. */
export function evidenceLine(fields: readonly FormField[]): string {
  const parts = [fields.some((field) => field.kind === 'location') ? 'tu ubicación' : '', fields.some((field) => field.kind === 'photo') ? 'tu foto' : ''].filter(Boolean);
  return parts.length ? `Se registra con ${parts.join(' y ')}` : '';
}
