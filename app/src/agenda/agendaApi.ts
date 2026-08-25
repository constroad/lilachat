import type { AttendeeSummary, Recurrence, Rsvp } from '@lilachat/shared';

/**
 * Cliente de la agenda (eventos, recordatorios, encuestas). Comparte forma con
 * `api/client.ts` pero vive aparte porque son tres recursos con sus tipos, y
 * meterlos en el cliente del chat lo volvería un cajón de sastre.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 15_000;

export type AgendaResult<T> = { ok: true; data: T } | { ok: false; message?: string };

export type AgendaEvent = {
  id: string;
  chatId: string;
  title: string;
  description?: string;
  startsAt: string;
  location?: string;
  rsvpSummary: AttendeeSummary;
  myRsvp: Rsvp | null;
};

export type AgendaReminder = {
  _id: string;
  title: string;
  /** La segunda línea de la tarjeta del diseño («Cada 2 horas»). */
  note?: string;
  startsAt: string;
  recurrence: Recurrence;
  active: boolean;
};

export type AgendaPoll = {
  id: string;
  chatId: string;
  question: string;
  options: { text: string; votes: string[] }[];
  allowMultiple: boolean;
  anonymous: boolean;
  closedAt?: string | null;
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
