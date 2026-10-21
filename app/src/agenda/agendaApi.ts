import type { AgendaReminder } from '@lilachat/shared';
import { subirFotoRedonda, type FotoElegida } from '../chat/fotoDeGrupo';
import { jsonCall } from '../api/jsonCall';

/**
 * Cliente de la agenda (eventos, recordatorios, encuestas). Comparte forma con
 * `api/client.ts` pero vive aparte porque son tres recursos con sus tipos, y
 * meterlos en el cliente del chat lo volvería un cajón de sastre.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

/** `status` (19/10): un 404 dice «ya no existe», que no es lo mismo que «sin red». */
export type AgendaResult<T> = { ok: true; data: T } | { ok: false; message?: string; status?: number };

export type { AgendaEvent, AgendaPoll, AgendaReminder, PendientesDeAgenda } from '@lilachat/shared';

const call = <T>(route: string, jwt: string, init: RequestInit = {}): Promise<AgendaResult<T>> => jsonCall<T>(`${BASE_URL}/api/agenda${route}`, jwt, init);

export const agendaGet = <T>(route: string, jwt: string) => call<T>(route, jwt);

export const agendaPost = <T>(route: string, jwt: string, body: Record<string, unknown>) =>
  call<T>(route, jwt, { method: 'POST', body: JSON.stringify(body) });

/** Editar: solo los campos que cambian; un opcional vacío se borra en el server. */
export const agendaPatch = <T>(route: string, jwt: string, body: Record<string, unknown>) =>
  call<T>(route, jwt, { method: 'PATCH', body: JSON.stringify(body) });

export const agendaDelete = <T>(route: string, jwt: string) => call<T>(route, jwt, { method: 'DELETE' });

/** Los recordatorios de un grupo, para su detalle (19/10). Solo miembros. */
export const recordatoriosDelGrupo = (chatId: string, jwt: string) =>
  agendaGet<{ reminders: AgendaReminder[] }>(`/reminders/del-chat/${chatId}`, jwt);

/** Saca la tarjeta en el chat del grupo cuando ya tiene su imagen (idempotente). */
export const publicarRecordatorio = (reminderId: string, jwt: string) =>
  agendaPost<Record<string, never>>(`/reminders/${reminderId}/publicar`, jwt, {});

/** Quitar la imagen al editar un recordatorio del grupo. */
export const quitarImagenDeRecordatorio = (reminderId: string, jwt: string) =>
  agendaDelete<Record<string, never>>(`/reminders/${reminderId}/imagen`, jwt);

/** La imagen de un recordatorio del grupo: se sube y se guarda en un request. */
export function subirImagenDeRecordatorio(reminderId: string, jwt: string, foto: FotoElegida) {
  return subirFotoRedonda({ url: `${BASE_URL}/api/agenda/reminders/${reminderId}/imagen`, jwt, foto });
}
