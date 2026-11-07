import { answerOfOutcome, type CommandGroup, type CommandOutcome, type EphemeralAnswer } from './botCommands.js';
import type { AppForm, FormField, FormValues, GeoPoint } from './appForms.js';
import { liveSelfieFieldOf } from './appForms.js';
import { cutAtWord } from './textCut.js';
import { CLIENT_LINK_ACTION, clientChannelButtonOf, hasOwnSpacePlace, SERVICE_LINK_ACTION } from './appItems.js';
import { MAP_LINK_FAILED, serviceMapUrl, type ServiceMapDeps, type ServiceMapResult } from './serviceMap.js';

/**
 * The actions of the apps (R160): the rows of «Acciones rápidas» (the space's ⚡,
 * design e-30, and the composer's «+», e-29) and what sending a form leaves on
 * screen. PURE: the app and the web draw with it.
 */
/** `command`: a slash command the admin made global, run from the ⚡ with no text. */
export type ShortcutRow = { kind: 'shortcut' | 'command'; appId: string; appName: string; avatarUrl?: string; key: string; name: string; description?: string; /** A command that asks for text after it. */ usageHint?: string };

const appOf = (group: CommandGroup) => ({ appId: group.appId, appName: group.appName, ...(group.avatarUrl ? { avatarUrl: group.avatarUrl } : {}) });

/** The «+» of a chat: its actions (the commands are a «/» away). */
export function shortcutRows(groups: readonly CommandGroup[]): ShortcutRow[] {
  return groups.flatMap((group) => (group.shortcuts ?? []).map((shortcut) => ({ kind: 'shortcut' as const, ...appOf(group), ...shortcut })));
}

/** An action drawn somewhere else: the clients' picker, or a button of a client's channel (José 01/11). */
const hasPlaceOfItsOwn = (key: string) => hasOwnSpacePlace('shortcut', key) || Boolean(clientChannelButtonOf('shortcut', key));

/**
 * A ⚡, the space's or a chat's: the actions and the commands, app by app. One list
 * (José 06/11: a ⚡ and a «/» that showed different things took the field's room).
 */
export function quickActionRows(groups: readonly CommandGroup[]): ShortcutRow[] {
  return groups.flatMap((group) => [
    ...(group.shortcuts ?? []).filter((shortcut) => !hasPlaceOfItsOwn(shortcut.key)).map((shortcut) => ({ kind: 'shortcut' as const, ...appOf(group), ...shortcut })),
    ...group.commands.map((entry) => ({ kind: 'command' as const, ...appOf(group), key: entry.command, name: `/${entry.command}`, description: entry.description, ...(entry.usageHint ? { usageHint: entry.usageHint } : {}) })),
  ]);
}

/** A command that needs its text goes to the field with its slash; `null` when the row runs from the ⚡. */
export const commandToWrite = (row: ShortcutRow): string | null => (row.kind === 'command' && row.usageHint ? `/${row.key} ` : null);

/**
 * The ⚡ of a chat (R31/10): backlog 111 took the actions out of the clip and
 * the ones the admin turns on for a channel or for the chat with the app were
 * left with no place. Only those two kinds of chat can have them.
 */
export function chatHasActionPlace(chat: { workspaceId?: string | null; isGroup: boolean; appId?: string | null }): boolean {
  return Boolean(chat.workspaceId) && (chat.isGroup || Boolean(chat.appId));
}

/** The rows a client channel's buttons run (links, report): the server lists them only to who may use them. */
export const channelButtonRows = (groups: readonly CommandGroup[]): ShortcutRow[] => shortcutRows(groups).filter((row) => clientChannelButtonOf(row.kind, row.key));

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
 * what Portal's modal asks (tabs, days); a service's has an action of its own.
 */
export type LinkTarget =
  | { kind: 'client'; clientId: string }
  | { kind: 'order'; clientId: string; orderId: string }
  | { kind: 'service'; clientId: string; serviceId: string };

const LINK_ACTIONS: Record<LinkTarget['kind'], string> = { client: CLIENT_LINK_ACTION, order: CLIENT_LINK_ACTION, service: SERVICE_LINK_ACTION };

const linkValuesOf = (target: LinkTarget): ShortcutValues => {
  if (target.kind === 'client') return { alcance: 'cliente', clienteId: target.clientId };
  if (target.kind === 'order') return { alcance: 'pedido', clienteId: target.clientId, pedidoId: target.orderId };
  return { servicioId: target.serviceId };
};

const linkRowOf = (actions: readonly ShortcutRow[], kind: LinkTarget['kind']) => actions.find((one) => one.kind === 'shortcut' && one.key === LINK_ACTIONS[kind]);

/** The action of a client's channel that makes that link, with what it already knows; null while it is off there. */
export function linkActionOf(actions: readonly ShortcutRow[], target: LinkTarget): { row: ShortcutRow; values: ShortcutValues } | null {
  const row = linkRowOf(actions, target.kind);
  return row ? { row, values: linkValuesOf(target) } : null;
}

/** The link buttons of a client's channel: which ones show, and what tapping one does. */
export type ChannelLinks = { can: (kind: LinkTarget['kind']) => boolean; open: (target: LinkTarget) => void; /** A service's map: its link, made without the form. */ map: (target: LinkTarget) => Promise<ServiceMapResult> };
export function channelLinksOf(actions: readonly ShortcutRow[], run: (row: ShortcutRow, values: ShortcutValues) => void, mapDeps?: (row: ShortcutRow, values: ShortcutValues) => ServiceMapDeps): ChannelLinks {
  return {
    can: (kind) => Boolean(linkRowOf(actions, kind)),
    open: (target) => {
      const link = linkActionOf(actions, target);
      if (link) run(link.row, link.values);
    },
    map: async (target) => {
      const link = linkActionOf(actions, target);
      return link && mapDeps ? serviceMapUrl(mapDeps(link.row, link.values)) : { ok: false, message: MAP_LINK_FAILED };
    },
  };
}

/**
 * What a service's space button carries: «Registrar pago» (José 31/10: admins
 * only, no approval step; Portal 2d0bdea2) and «Generar informe de servicio»
 * (LIQ-SRV: quote, executed, payments and balance). Portal refuses both inside
 * a group, and the client's channel is one: they run from the space (not in
 * its ⚡), with the service filled in.
 */
export const serviceValuesOf = (serviceId: string): ShortcutValues => ({ servicioId: serviceId });

/** The answers that came back since the last look, once each: after a payment or a report the detail is asked again. */
export const answeredSince = (answers: readonly Pick<EphemeralAnswer, 'commandId' | 'state'>[], seen: ReadonlySet<string>): string[] =>
  answers.filter((answer) => answer.state === 'answered' && !seen.has(answer.commandId)).map((answer) => answer.commandId);

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
export type FormSubmitReply = { ok: true; outcome: CommandOutcome } | { ok: false; errors?: Record<string, string>; message?: string; /** Missing with no network: the HTTP refusal, to tell one from the other. */ status?: number; /** `rate_limited` (agentes 06/11): too many calls, with the seconds to wait. */ code?: string; retryAfterS?: number };

/** The HTTP refusal of a sent form as the app and the web read it: the app's errors, agentes' rate limit, or the server's message. */
export function formSubmitFailure(status: number, body: { errors?: Record<string, string>; message?: string; code?: string; retry_after_s?: number }, fallback: string): FormSubmitReply {
  const rate = body.code === 'rate_limited' ? { code: body.code, ...(typeof body.retry_after_s === 'number' ? { retryAfterS: body.retry_after_s } : {}) } : {};
  if (body.errors) return { ok: false, status, errors: body.errors, ...rate };
  return { ok: false, status, message: body.message ?? fallback };
}
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
/** What fits the band of a photo beside the precision: measured on a 1200 px photo, 48 characters reach the edge. */
const STAMP_PLACE_MAX = 38;

function stampDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('es-PE', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((one) => one.type === type)?.value ?? '';
  return `${part('weekday').replace('.', '')} ${part('day')}/${part('month')}/${part('year')} · ${part('hour')}:${part('minute')}`;
}

/** A time zone the phone or the space got wrong falls back to Lima: the stamp is never lost. */
function stampDateOf(at: Date, timeZone: string = STAMP_TIME_ZONE): string {
  try {
    return stampDate(at, timeZone);
  } catch {
    return stampDate(at, STAMP_TIME_ZONE);
  }
}

/** What a photo of the camera asks the server for: the day and the hour, nothing else (José 06/11: tank and materials). */
export const HOUR_STAMP = 'hour';
/** A photo of the gallery: the date and place of when it was taken, not of the upload (José 06/11). */
export type GalleryStamp = { takenAt: string; location?: GeoPoint };
export type FormPhotoStamp = GeoPoint | typeof HOUR_STAMP | GalleryStamp;

/**
 * The two lines burned into a form's photo (pending 94, José 23/10: a
 * watermark with the date, the hour and the place): the server writes them
 * with ITS clock, so the phone cannot fake the hour.
 */
export function photoHourLines(params: { at: Date; timeZone?: string }): [string] {
  return [stampDateOf(params.at, params.timeZone)];
}

export function photoStampLines(params: { at: Date; timeZone?: string; location?: GeoPoint; /** The address, when it arrived in time; otherwise the coordinates. */ place?: string | null }): [string, string] {
  const date = stampDateOf(params.at, params.timeZone);
  const { location } = params;
  const where = params.place ? cutAtWord(params.place, STAMP_PLACE_MAX) : location && `${location.lat.toFixed(STAMP_DECIMALS)}, ${location.lng.toFixed(STAMP_DECIMALS)}`;
  const place = location ? `${where} · ${precisionLabel(location)}` : 'Sin ubicación';
  return [date, place];
}
