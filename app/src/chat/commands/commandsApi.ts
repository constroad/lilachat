import { FORMS_LEVEL, commandScopePath, formSubmitFailure, stampFieldsOf, type CommandGroup, type CommandOutcome, type CommandScope, type FormPhotoStamp, type FormPhotoUpload, type FormSubmitReply, type FormValues, type GeoPoint, type CommandsPlace, type PreviewReply, type ShortcutValues } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import * as FileSystem from 'expo-file-system/legacy';
import { shrinkPhotoFile, type ShrunkPhotoFile } from '../shrinkPhoto';
import { subirPorXhr } from '../subidaXhr';

/** A selfie is small; a phone on a weak signal still gets a minute. */
const PHOTO_UPLOAD_TIMEOUT_MS = 60_000;

/** The slash commands and actions of the apps (§c-bis), only what the admin enabled at that place (R160). */
export const spaceCommands = (jwt: string, spaceId: string, place: CommandsPlace) =>
  jsonCall<{ groups: CommandGroup[] }>(`${BASE_URL}/api/workspaces/${spaceId}/commands?${place === 'space' ? 'place=space' : `chat=${place.chatId}`}`, jwt);

export const runCommand = (jwt: string, chatId: string, input: { appId: string; command: string; text: string }) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api/chats/${chatId}/commands`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, command: input.command, text: input.text, forms: FORMS_LEVEL }) });

/** A row of a stored card: the server finds its app and checks the line is on the card. */
export const runCardCommand = (jwt: string, chatId: string, input: { seq: number; line: string }) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api/chats/${chatId}/card-commands`, jwt, { method: 'POST', body: JSON.stringify({ seq: input.seq, line: input.line, forms: FORMS_LEVEL }) });

/** «Enviar al canal»: the app posts in the channel the answer only I saw. */
export const shareCommandAnswer = (jwt: string, chatId: string, commandId: string) => jsonCall<{ seq: number }>(`${BASE_URL}/api/chats/${chatId}/commands/${commandId}/share`, jwt, { method: 'POST', body: '{}' });

/** An action of the space's ⚡ or a chat's «+» (R160); a global command from the ⚡ goes with no text. `values`: what the place it was tapped from knows. */
export const runShortcut = (jwt: string, scope: CommandScope, input: { kind: 'shortcut' | 'command'; appId: string; key: string }, values?: ShortcutValues) =>
  input.kind === 'command'
    ? jsonCall<CommandOutcome>(`${BASE_URL}${commandScopePath(scope)}/commands`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, command: input.key, text: '', forms: FORMS_LEVEL }) })
    : jsonCall<CommandOutcome>(`${BASE_URL}${commandScopePath(scope)}/shortcuts`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, shortcut: input.key, forms: FORMS_LEVEL, ...(values ? { values } : {}) }) });

/** `x-refresh`: the app sends the form again for this draft, on the same command (agentes 2483da7). */
export const refreshAppForm = (jwt: string, scope: CommandScope, commandId: string, values: FormValues) =>
  jsonCall<CommandOutcome>(`${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/refresh`, jwt, { method: 'POST', body: JSON.stringify({ values }) });

/** `x-preview`: the app's summary of the draft; an empty one when it cannot answer. */
export const previewAppForm = (jwt: string, scope: CommandScope, commandId: string, values: FormValues) =>
  jsonCall<PreviewReply>(`${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/preview`, jwt, { method: 'POST', body: JSON.stringify({ values }) });

/**
 * A form's photo, the moment it is taken: made lighter with Portal's standard
 * (28/10), then read from disk by the native multipart, never through JS memory.
 */
export async function uploadFormPhoto(jwt: string, scope: CommandScope, commandId: string, photo: { uri: string; mime: string }, stamp?: FormPhotoStamp): Promise<FormPhotoUpload> {
  const name = photo.mime === 'image/png' ? 'foto.png' : 'foto.jpg';
  const shrunk = await shrinkPhotoFile({ uri: photo.uri, mimeType: photo.mime, fileName: name });
  try {
    return await sendFormPhoto(jwt, scope, commandId, shrunk, stamp);
  } finally {
    if (shrunk.temporary) await FileSystem.deleteAsync(shrunk.uri, { idempotent: true }).catch(() => undefined);
  }
}

async function sendFormPhoto(jwt: string, scope: CommandScope, commandId: string, photo: ShrunkPhotoFile, stamp?: FormPhotoStamp): Promise<FormPhotoUpload> {
  const form = new FormData();
  form.append('file', { uri: photo.uri, name: photo.fileName, type: photo.mimeType } as unknown as Blob);
  // The server burns the hour, and the place when there is one (pending 94).
  Object.entries(stampFieldsOf(stamp)).forEach(([name, value]) => form.append(name, value));
  const reply = await subirPorXhr({ url: `${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/files`, token: jwt, form, timeoutMs: PHOTO_UPLOAD_TIMEOUT_MS });
  if (reply.tipo === 'fallo') return { ok: false, message: reply.motivo };
  const fileId = reply.payload.fileId;
  if (reply.status >= 200 && reply.status < 300 && typeof fileId === 'string') return { ok: true, fileId };
  return { ok: false, status: reply.status, message: typeof reply.payload.message === 'string' ? reply.payload.message : 'No se pudo subir la foto.' };
}

/** The address of a reading, for the camera of a signing; `null` when it does not arrive. */
export async function readFormPlace(jwt: string, scope: CommandScope, commandId: string, point: GeoPoint): Promise<string | null> {
  const query = `lat=${point.lat}&lng=${point.lng}&precision=${point.precision}`;
  try {
    const response = await fetch(`${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/place?${query}`, { headers: { Authorization: `Bearer ${jwt}` } });
    return response.ok ? ((await response.json()) as { place?: string | null }).place ?? null : null;
  } catch {
    return null;
  }
}

/** Sending is the person's confirmation; a 422 brings what to fix, field by field. */
export async function submitAppForm(jwt: string, scope: CommandScope, commandId: string, values: FormValues): Promise<FormSubmitReply> {
  try {
    const response = await fetch(`${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/form`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ values }) });
    const data = (await response.json().catch(() => ({}))) as CommandOutcome & { errors?: Record<string, string>; message?: string; code?: string; retry_after_s?: number };
    if (response.ok) return { ok: true, outcome: data };
    return formSubmitFailure(response.status, data, 'No se pudo enviar.');
  } catch {
    return { ok: false, message: 'Sin conexión. Inténtalo de nuevo.' };
  }
}
