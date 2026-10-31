import { answerOfOutcome, type CommandGroup, type CommandOutcome, type EphemeralAnswer } from './botCommands.js';
import type { AppForm, FormField, FormValues, GeoPoint } from './appForms.js';
import { liveSelfieFieldOf } from './appForms.js';
import { hasOwnSpacePlace } from './appItems.js';

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
    ...(group.shortcuts ?? []).filter((shortcut) => !hasOwnSpacePlace('shortcut', shortcut.key)).map((shortcut) => ({ kind: 'shortcut' as const, ...appOf(group), ...shortcut })),
    ...group.commands.map((entry) => ({ kind: 'command' as const, ...appOf(group), key: entry.command, name: `/${entry.command}`, description: entry.description })),
  ]);
}

/**
 * The ⚡ of a chat (R31/10): backlog 111 took the actions out of the clip and
 * the ones the admin turns on for a channel or for the chat with the app were
 * left with no place. Only those two kinds of chat can have them.
 */
export function chatHasActionPlace(chat: { workspaceId?: string | null; isGroup: boolean; appId?: string | null }): boolean {
  return Boolean(chat.workspaceId) && (chat.isGroup || Boolean(chat.appId));
}

/** The rows of a chat's ⚡: its actions, without the ones that live in a place of their own. */
export function chatActionRows(groups: readonly CommandGroup[]): ShortcutRow[] {
  return shortcutRows(groups).filter((row) => !hasOwnSpacePlace('shortcut', row.key));
}

/** Portal's action that the clients' picker runs (Portal 0227a1f0). */
export const CREATE_CLIENT_ACTION = 'crear_cliente';

/** An action with its own place in the space; absent when it is off there or that person may not run it. */
export const placedActionRow = (groups: readonly CommandGroup[], key: string): ShortcutRow | undefined => shortcutRows(groups).find((row) => row.key === key);

/** What an action carries already filled in (agentes 31/10): short texts, numbers or yes/no, by name. */
export type ShortcutValues = Record<string, string | number | boolean>;
const VALUES_MAX_KEYS = 10;
const VALUE_MAX_LENGTH = 200;
const VALUE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;
const isValue = (value: unknown) => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= VALUE_MAX_LENGTH);

/** `undefined` when nothing came (or `{}`), `null` when it is not that shape. */
export function shortcutValuesOf(raw: unknown): ShortcutValues | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (!entries.length) return undefined;
  if (entries.length > VALUES_MAX_KEYS || entries.some(([key, value]) => !VALUE_KEY.test(key) || !isValue(value))) return null;
  return Object.fromEntries(entries) as ShortcutValues;
}

/**
 * Portal's link actions (agentes 31/10): the client's or an order's link asks
 * what Portal's modal asks (tabs, days); a service's is «compartir_servicio».
 */
export const CLIENT_LINK_ACTION = 'crear_enlace_cliente';
export const SHARE_SERVICE_ACTION = 'compartir_servicio';
export type LinkTarget = { kind: 'client'; clientId: string } | { kind: 'order'; clientId: string; orderId: string } | { kind: 'service'; clientId: string; serviceId: string };

const linkValuesOf = (target: LinkTarget): ShortcutValues => {
  if (target.kind === 'client') return { alcance: 'cliente', clienteId: target.clientId };
  if (target.kind === 'order') return { alcance: 'pedido', clienteId: target.clientId, pedidoId: target.orderId };
  return { clienteId: target.clientId, servicioId: target.serviceId };
};

const linkRowOf = (actions: readonly ShortcutRow[], kind: LinkTarget['kind']) => actions.find((one) => one.kind === 'shortcut' && one.key === (kind === 'service' ? SHARE_SERVICE_ACTION : CLIENT_LINK_ACTION));

/** The action of a client's channel that makes that link, with what it already knows; null while it is off there. */
export function linkActionOf(actions: readonly ShortcutRow[], target: LinkTarget): { row: ShortcutRow; values: ShortcutValues } | null {
  const row = linkRowOf(actions, target.kind);
  return row ? { row, values: linkValuesOf(target) } : null;
}

/** The link buttons of a client's channel: which ones show, and what tapping one does. */
export type ChannelLinks = { can: (kind: LinkTarget['kind']) => boolean; open: (target: LinkTarget) => void };
export function channelLinksOf(actions: readonly ShortcutRow[], run: (row: ShortcutRow, values: ShortcutValues) => void): ChannelLinks {
  return {
    can: (kind) => Boolean(linkRowOf(actions, kind)),
    open: (target) => {
      const link = linkActionOf(actions, target);
      if (link) run(link.row, link.values);
    },
  };
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
/** `waiting`: the app answers later by `/respond`; the form stays open with «Enviando…» until then (consensus 24/10). */
export type FormSubmitOutcome = { done: true; answer: EphemeralAnswer | null } | { done: false; errors: Record<string, string>; message?: string; waiting?: true };

export function formSubmitOutcome(reply: FormSubmitReply, command: string): FormSubmitOutcome {
  if (!reply.ok) return { done: false, errors: reply.errors ?? {}, ...(reply.message ? { message: reply.message } : {}) };
  if (reply.outcome.outcome === 'failed') return { done: false, errors: {}, message: reply.outcome.message ?? `${reply.outcome.appName} no pudo responder.` };
  if (reply.outcome.outcome === 'pending') return { done: false, errors: {}, waiting: true };
  return { done: true, answer: answerOfOutcome(reply.outcome, command) };
}

/** «Marcar ingreso»: the app's button with the option picked in the first side-by-side choice. */
export function submitLabelOf(form: Pick<AppForm, 'submitLabel'>, fields: readonly FormField[], values: FormValues): string {
  const label = form.submitLabel ?? 'Enviar';
  // Only a signature says what it signs («Marcar asistencia ingreso»); «Registrar una medida de tanque medida» read wrong (E2E 24/10).
  if (!liveSelfieFieldOf(fields)) return label;
  const choice = fields.find((field): field is Extract<FormField, { kind: 'choice' }> => field.kind === 'choice' && field.segmented);
  const picked = choice?.options.find((option) => option.value === values[choice.name]);
  return picked && form.submitLabel ? `${label} ${picked.label.toLocaleLowerCase('es')}` : label;
}

/** The foot under the button: what is sent with the form besides what was typed. */
export function evidenceLine(fields: readonly FormField[]): string {
  // A list of photos is a receipt or a tape, not the person: «las fotos», never «tu foto» (E2E 28/10, an expense).
  const photos = fields.filter((field) => field.kind === 'photo');
  const photoWords = photos.some((field) => field.kind === 'photo' && !field.multiple) ? 'tu foto' : photos.length ? 'las fotos' : '';
  const parts = [fields.some((field) => field.kind === 'location') ? 'tu ubicación' : '', photoWords].filter(Boolean);
  return parts.length ? `Se registra con ${parts.join(' y ')}` : '';
}

/** Where a stamp's hour is read when the space says nothing else (ConstRoad works in Peru). */
export const STAMP_TIME_ZONE = 'America/Lima';
const STAMP_DECIMALS = 5;

function stampDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('es-PE', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((one) => one.type === type)?.value ?? '';
  return `${part('weekday').replace('.', '')} ${part('day')}/${part('month')}/${part('year')} · ${part('hour')}:${part('minute')}`;
}

/**
 * The two lines burned into a form's photo (pending 94, José 23/10: a
 * watermark with the date, the hour and the place): the server writes them
 * with ITS clock, so the phone cannot fake the hour.
 */
export function photoStampLines(params: { at: Date; timeZone?: string; location?: GeoPoint }): [string, string] {
  let date: string;
  try {
    date = stampDate(params.at, params.timeZone ?? STAMP_TIME_ZONE);
  } catch {
    date = stampDate(params.at, STAMP_TIME_ZONE);
  }
  const place = params.location ? `${params.location.lat.toFixed(STAMP_DECIMALS)}, ${params.location.lng.toFixed(STAMP_DECIMALS)} · ${precisionLabel(params.location)}` : 'Sin ubicación';
  return [date, place];
}
