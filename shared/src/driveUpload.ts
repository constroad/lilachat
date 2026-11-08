import { FORMS_LEVEL } from './appForms.js';
import type { FormSubmitReply } from './appActions.js';
import type { CommandNotice, CommandOutcome } from './botCommands.js';

/**
 * A photo or a video sent straight to a service's Drive (José, 06/11: videos
 * never go in a report). `subir_al_drive` answers a ticket, the file goes from
 * the phone to Portal and never through Lilachat. The ticket's address is a
 * secret: it lives in the answer to the one who asked and is not stored. PURE.
 */
export type DriveUpload = { url: string; method: 'POST'; fields: Record<string, string>; fileField: string; expiresAt: string; maxBytes: number; maxSeconds: number; mimeTypes: string[] };
export type DriveUploadRequest = { kind: 'drive_upload'; forms: number };
/** What the phone knows of a file before sending it; what it does not know is left to Portal. */
export type DriveFileFacts = { mime: string; sizeBytes?: number; seconds?: number };
/** `mediaId`: the file's id in Portal, when it answers one (o-06 sends it as evidence). */
export type DriveUploadResult = { ok: true; mediaId?: string } | { ok: false; message: string };
export type DriveUploadDeps<F> = {
  open(): Promise<{ ok: true; data: CommandOutcome } | { ok: false; message?: string }>;
  submit(commandId: string): Promise<FormSubmitReply>;
  notice(commandId: string): Promise<CommandNotice | null>;
  /** No `status`: nothing came back. `message`: what Portal said, or what stopped the phone. */
  send(upload: DriveUpload, file: F, clientUploadId: string): Promise<{ status?: number; message?: string; mediaId?: string }>;
};

export const DRIVE_UPLOAD_FAILED = 'No se pudo subir el archivo. Revisa tu señal y vuelve a intentarlo.';
export const DRIVE_UPLOAD_DONE = 'Archivo subido al Drive.';
export const DRIVE_UPLOADING = 'Subiendo…';
/** «Subiendo… 40 %»: a video can take minutes in the field. */
export const driveUploadingLine = (ratio: number): string => (ratio > 0 ? `${DRIVE_UPLOADING} ${Math.round(ratio * 100)} %` : DRIVE_UPLOADING);
/** What the phone's camera records at most: Portal says it again in each ticket. */
export const DRIVE_VIDEO_SECONDS = 60;

const NOT_ALLOWED = 'Solo se admiten fotos y videos.';
const EXPIRED = 410;
const BYTES_PER_MB = 1_048_576;
const FIELD_MAX = 64;
const FAILURES: Record<number, string> = { [EXPIRED]: 'La subida venció. Vuelve a intentarlo.', 413: 'El archivo pesa demasiado.', 415: NOT_ALLOWED, 409: 'Ese archivo ya se está subiendo.' };
/** Written by hand: `URL` has no `hostname` on every phone. No user part, ours or a subdomain of ours. */
const OUR_ADDRESS = /^https:\/\/([a-z0-9-]+\.)*constroad\.com(:\d+)?\//i;
const MEDIA_TYPE = /^(image|video)\/[a-z0-9.+-]+$/i;
export const KMZ_TYPE = 'application/vnd.google-earth.kmz';
export const KML_TYPE = 'application/vnd.google-earth.kml+xml';
/** The traces «Importar» sends (o-12): Portal announces them in every ticket since 07/11. */
const TRACE_TYPES: readonly string[] = [KMZ_TYPE, KML_TYPE];
const isAnnouncedType = (one: string): boolean => MEDIA_TYPE.test(one) || TRACE_TYPES.includes(one);

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isShortText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= FIELD_MAX;

function fieldsOf(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  return entries.every(([, value]) => typeof value === 'string') ? Object.fromEntries(entries as [string, string][]) : null;
}

/** The ticket as agentes passes it, with closed keys. Anything off the contract is no ticket at all. */
export function driveUploadOf(raw: unknown): DriveUpload | null {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const { url, fileField, expiresAt, maxBytes, maxSeconds, mimeTypes } = input;
  const fields = fieldsOf(input.fields);
  const types = Array.isArray(mimeTypes) ? mimeTypes.filter((one): one is string => typeof one === 'string' && isAnnouncedType(one)) : [];
  const dated = typeof expiresAt === 'string' && !Number.isNaN(Date.parse(expiresAt));
  if (typeof url !== 'string' || !OUR_ADDRESS.test(url) || input.method !== 'POST' || !fields || !isShortText(fileField)) return null;
  if (!dated || !isPositive(maxBytes) || !isPositive(maxSeconds) || !types.length) return null;
  return { url, method: 'POST', fields, fileField, expiresAt, maxBytes, maxSeconds, mimeTypes: types };
}

export const driveUploadRequest = (): DriveUploadRequest => ({ kind: 'drive_upload', forms: FORMS_LEVEL });

/** Why a file does not go, before spending the person's data on it. */
export function driveFileRefusal(upload: DriveUpload, file: DriveFileFacts): string | null {
  if (!upload.mimeTypes.includes(file.mime)) return NOT_ALLOWED;
  if (file.sizeBytes !== undefined && file.sizeBytes > upload.maxBytes) return `El archivo pesa más de ${Math.round(upload.maxBytes / BYTES_PER_MB)} MB.`;
  if (file.mime.startsWith('video/') && file.seconds !== undefined && file.seconds > upload.maxSeconds) return `El video dura más de ${upload.maxSeconds} segundos.`;
  return null;
}

const refusalOf = (reply: Extract<FormSubmitReply, { ok: false }>): string => reply.errors?._ ?? Object.values(reply.errors ?? {})[0] ?? reply.message ?? DRIVE_UPLOAD_FAILED;

/** A new run each time: agentes answers a repeated one with its text alone. */
async function ticketOf<F>(deps: DriveUploadDeps<F>): Promise<{ upload: DriveUpload } | { message: string }> {
  const opened = await deps.open();
  if (!opened.ok) return { message: DRIVE_UPLOAD_FAILED };
  const { commandId } = opened.data;
  const reply = await deps.submit(commandId);
  if (!reply.ok) return { message: refusalOf(reply) };
  const { outcome } = reply;
  if (outcome.outcome === 'failed') return { message: outcome.message ?? DRIVE_UPLOAD_FAILED };
  const response = outcome.outcome === 'pending' ? (await deps.notice(commandId))?.response : outcome.response;
  return response?.upload ? { upload: response.upload } : { message: DRIVE_UPLOAD_FAILED };
}

/** One ticket and one send: `null` asks for a new ticket. */
async function attempt<F>(deps: DriveUploadDeps<F>, file: { source: F; facts: DriveFileFacts }, clientUploadId: string): Promise<DriveUploadResult | null> {
  const ticket = await ticketOf(deps);
  if ('message' in ticket) return { ok: false, message: ticket.message };
  const refusal = driveFileRefusal(ticket.upload, file.facts);
  if (refusal) return { ok: false, message: refusal };
  const { status, message, mediaId } = await deps.send(ticket.upload, file.source, clientUploadId);
  if (status === EXPIRED) return null;
  if (status && status < 300) return mediaId ? { ok: true, mediaId } : { ok: true };
  return { ok: false, message: FAILURES[status ?? 0] ?? message ?? DRIVE_UPLOAD_FAILED };
}

/** The same `clientUploadId` on a retry: Portal answers the file it already has. */
export async function uploadToDrive<F>(deps: DriveUploadDeps<F>, file: { source: F; facts: DriveFileFacts }, clientUploadId: string): Promise<DriveUploadResult> {
  return (await attempt(deps, file, clientUploadId)) ?? (await attempt(deps, file, clientUploadId)) ?? { ok: false, message: FAILURES[EXPIRED]! };
}
