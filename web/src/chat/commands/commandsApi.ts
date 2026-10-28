import { FORMS_LEVEL, commandScopePath, type CommandGroup, type CommandOutcome, type CommandScope, type FormSubmitReply, type FormValues, type GeoPoint, type ItemPlace } from '@lilachat/shared';
import { api } from '../../api';

/** The slash commands and actions of the apps (§c-bis), only what the admin enabled at that place (R160). */
export const spaceCommands = (jwt: string, spaceId: string, place: ItemPlace) =>
  api<{ groups: CommandGroup[] }>(`/workspaces/${spaceId}/commands?${place === 'space' ? 'place=space' : `chat=${place.chatId}`}`, { jwt });

export const runCommand = (jwt: string, chatId: string, input: { appId: string; command: string; text: string }) =>
  api<CommandOutcome>(`/chats/${chatId}/commands`, { jwt, body: { app_id: input.appId, command: input.command, text: input.text, forms: FORMS_LEVEL } });

/** «Enviar al canal»: the app posts in the channel the answer only I saw. */
export const shareCommandAnswer = (jwt: string, chatId: string, commandId: string) => api<{ seq: number }>(`/chats/${chatId}/commands/${commandId}/share`, { jwt, body: {} });

/** `api()` paths are under `/api` already. */
const pathOf = (scope: CommandScope) => commandScopePath(scope).replace(/^\/api/, '');

/** An action of the space's ⚡ or a chat's «+» (R160); a global command from the ⚡ goes with no text. */
export const runShortcut = (jwt: string, scope: CommandScope, input: { kind: 'shortcut' | 'command'; appId: string; key: string }) =>
  input.kind === 'command'
    ? api<CommandOutcome>(`${pathOf(scope)}/commands`, { jwt, body: { app_id: input.appId, command: input.key, text: '', forms: FORMS_LEVEL } })
    : api<CommandOutcome>(`${pathOf(scope)}/shortcuts`, { jwt, body: { app_id: input.appId, shortcut: input.key, forms: FORMS_LEVEL } });

/** A form's photo, the moment it is picked: the form then carries its id. */
export async function uploadFormPhoto(jwt: string, scope: CommandScope, commandId: string, file: Blob, stamp?: GeoPoint): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
  const body = new FormData();
  body.append('file', file, file instanceof File ? file.name : 'foto.jpg');
  // A signing's selfie: the server burns its hour and this place into it (pending 94).
  if (stamp) {
    body.append('stamp', '1');
    body.append('lat', String(stamp.lat));
    body.append('lng', String(stamp.lng));
    body.append('precision', String(stamp.precision));
  }
  try {
    const response = await fetch(`${commandScopePath(scope)}/commands/${commandId}/files`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body });
    const data = (await response.json().catch(() => ({}))) as { fileId?: string; message?: string };
    return response.ok && data.fileId ? { ok: true, fileId: data.fileId } : { ok: false, message: data.message ?? 'No se pudo subir la foto.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}

/** Sending is the person's confirmation; a 422 brings what to fix, field by field. */
export async function submitAppForm(jwt: string, scope: CommandScope, commandId: string, values: FormValues): Promise<FormSubmitReply> {
  try {
    const response = await fetch(`${commandScopePath(scope)}/commands/${commandId}/form`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ values }) });
    const data = (await response.json().catch(() => ({}))) as CommandOutcome & { errors?: Record<string, string>; message?: string };
    if (response.ok) return { ok: true, outcome: data };
    return { ok: false, ...(data.errors ? { errors: data.errors } : {}), message: data.errors ? undefined : (data.message ?? 'No se pudo enviar.') };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}
