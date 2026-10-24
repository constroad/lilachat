import { commandScopePath, type CommandGroup, type CommandOutcome, type CommandScope, type FormSubmitReply, type FormValues, type GeoPoint, type ItemPlace } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { subirPorXhr } from '../subidaXhr';

/** A selfie is small; a phone on a weak signal still gets a minute. */
const PHOTO_UPLOAD_TIMEOUT_MS = 60_000;

/** The slash commands and actions of the apps (§c-bis), only what the admin enabled at that place (R160). */
export const spaceCommands = (jwt: string, spaceId: string, place: ItemPlace) =>
  jsonCall<{ groups: CommandGroup[] }>(`${BASE_URL}/api/workspaces/${spaceId}/commands?${place === 'space' ? 'place=space' : `chat=${place.chatId}`}`, jwt);

export const runCommand = (jwt: string, chatId: string, input: { appId: string; command: string; text: string }) =>
  jsonCall<CommandOutcome>(`${BASE_URL}/api/chats/${chatId}/commands`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, command: input.command, text: input.text }) });

/** «Enviar al canal»: the app posts in the channel the answer only I saw. */
export const shareCommandAnswer = (jwt: string, chatId: string, commandId: string) => jsonCall<{ seq: number }>(`${BASE_URL}/api/chats/${chatId}/commands/${commandId}/share`, jwt, { method: 'POST', body: '{}' });

/** An action of the space's ⚡ or a chat's «+» (R160); a global command from the ⚡ goes with no text. */
export const runShortcut = (jwt: string, scope: CommandScope, input: { kind: 'shortcut' | 'command'; appId: string; key: string }) =>
  input.kind === 'command'
    ? jsonCall<CommandOutcome>(`${BASE_URL}${commandScopePath(scope)}/commands`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, command: input.key, text: '' }) })
    : jsonCall<CommandOutcome>(`${BASE_URL}${commandScopePath(scope)}/shortcuts`, jwt, { method: 'POST', body: JSON.stringify({ app_id: input.appId, shortcut: input.key }) });

/** A form's photo, the moment it is taken: read from disk by the native multipart, never through JS memory. */
export async function uploadFormPhoto(jwt: string, scope: CommandScope, commandId: string, photo: { uri: string; mime: string }, stamp?: GeoPoint): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('file', { uri: photo.uri, name: photo.mime === 'image/png' ? 'foto.png' : 'foto.jpg', type: photo.mime } as unknown as Blob);
  // A signing's selfie: the server burns its hour and this place into it (pending 94).
  if (stamp) {
    form.append('stamp', '1');
    form.append('lat', String(stamp.lat));
    form.append('lng', String(stamp.lng));
    form.append('precision', String(stamp.precision));
  }
  const reply = await subirPorXhr({ url: `${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/files`, token: jwt, form, timeoutMs: PHOTO_UPLOAD_TIMEOUT_MS });
  if (reply.tipo === 'fallo') return { ok: false, message: reply.motivo };
  const fileId = reply.payload.fileId;
  if (reply.status >= 200 && reply.status < 300 && typeof fileId === 'string') return { ok: true, fileId };
  return { ok: false, message: typeof reply.payload.message === 'string' ? reply.payload.message : 'No se pudo subir la foto.' };
}

/** Sending is the person's confirmation; a 422 brings what to fix, field by field. */
export async function submitAppForm(jwt: string, scope: CommandScope, commandId: string, values: FormValues): Promise<FormSubmitReply> {
  try {
    const response = await fetch(`${BASE_URL}${commandScopePath(scope)}/commands/${commandId}/form`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ values }) });
    const data = (await response.json().catch(() => ({}))) as CommandOutcome & { errors?: Record<string, string>; message?: string };
    if (response.ok) return { ok: true, outcome: data };
    return data.errors ? { ok: false, errors: data.errors } : { ok: false, message: data.message ?? 'No se pudo enviar.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Inténtalo de nuevo.' };
  }
}
