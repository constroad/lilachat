import type { AttendeeSummary, Recurrence, Rsvp } from '@lilachat/shared';
import { subirFotoRedonda, type FotoElegida } from '../chat/fotoDeGrupo';

/**
 * Cliente de la agenda (eventos, recordatorios, encuestas). Comparte forma con
 * `api/client.ts` pero vive aparte porque son tres recursos con sus tipos, y
 * meterlos en el cliente del chat lo volvería un cajón de sastre.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 15_000;

/** `status` (19/10): un 404 dice «ya no existe», que no es lo mismo que «sin red». */
export type AgendaResult<T> = { ok: true; data: T } | { ok: false; message?: string; status?: number };

export type AgendaEvent = {
  id: string;
  chatId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  rsvpSummary: AttendeeSummary;
  myRsvp: Rsvp | null;
  /** Lo creé yo: solo entonces se ofrece editarlo y cancelarlo. */
  mio: boolean;
  /** «Avisar 1 hora antes»; los eventos viejos no lo traen y cuentan como sí. */
  remindGuests?: boolean;
  /** Lo que el detalle muestra a todos (FL10). Un server viejo no lo manda. */
  createdBy?: string;
  attendees?: { userId: string; rsvp?: Rsvp; invitedBy?: string }[];
  chat?: { kind: 'direct' | 'group'; name?: string; phone?: string };
  personas?: Record<string, { phone: string; name?: string }>;
  guestsCanInvite?: boolean;
  puedoInvitar?: boolean;
};

export type AgendaReminder = {
  _id: string;
  title: string;
  /** La segunda línea de la tarjeta del diseño («Cada 2 horas»). */
  note?: string;
  startsAt: string;
  recurrence: Recurrence;
  active: boolean;
  /** Solo en los del grupo (19/10): el chat donde vive y su imagen. */
  chatId?: string;
  imageUrl?: string;
};

export type AgendaPoll = {
  id: string;
  chatId: string;
  question: string;
  options: { text: string; votes: string[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt?: string | null;
  /** De qué chat y quién preguntó (FL10). Un server viejo no los manda. */
  chat?: { kind: 'direct' | 'group'; name?: string; phone?: string };
  autor?: { id: string; phone: string; name?: string };
  /** La creé yo: solo entonces se cierra o se elimina. */
  esMia?: boolean;
  /** Para nombrar al autor y, si no es anónima, a los votantes. */
  personas?: Record<string, { phone: string; name?: string }>;
};

async function call<T>(
  route: string,
  jwt: string,
  init: RequestInit = {}
): Promise<AgendaResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}/api/agenda${route}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        status: response.status,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: 'Sin conexión. Inténtalo de nuevo.' };
  }
}

export const agendaGet = <T>(route: string, jwt: string) => call<T>(route, jwt);

export const agendaPost = <T>(route: string, jwt: string, body: Record<string, unknown>) =>
  call<T>(route, jwt, { method: 'POST', body: JSON.stringify(body) });

/** Editar: solo los campos que cambian; un opcional vacío se borra en el server. */
export const agendaPatch = <T>(route: string, jwt: string, body: Record<string, unknown>) =>
  call<T>(route, jwt, { method: 'PATCH', body: JSON.stringify(body) });

export const agendaDelete = <T>(route: string, jwt: string) => call<T>(route, jwt, { method: 'DELETE' });

/** Lo que me espera, para los contadores de las pestañas (`GET /pendientes`, 18/10). */
export type PendientesDeAgenda = { encuestas: number; eventos: number };

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
