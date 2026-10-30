import { BASE_URL } from '../api/client';

const REQUEST_TIMEOUT_MS = 10_000;

export type BlockedPerson = { id: string; name: string | null; phone: string; avatarUrl: string | null };
export type BlockedOutcome = { ok: true } | { ok: false; message: string };

/** «Contactos bloqueados» (pending 9): `/api/me/blocked`. A failure says why, never throws. */
async function call(jwt: string, route: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}/api/me/blocked${route}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function outcomeOf(request: Promise<Response>): Promise<BlockedOutcome> {
  try {
    const response = await request;
    if (response.ok) return { ok: true };
    const reply = (await response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: reply?.message ?? 'No se pudo cambiar.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Prueba de nuevo.' };
  }
}

export const blockPerson = (jwt: string, userId: string) => outcomeOf(call(jwt, '', { method: 'POST', body: JSON.stringify({ userId }) }));
export const unblockPerson = (jwt: string, userId: string) => outcomeOf(call(jwt, `/${userId}`, { method: 'DELETE' }));

export async function listBlockedPeople(jwt: string): Promise<BlockedPerson[] | null> {
  try {
    const response = await call(jwt, '', { method: 'GET' });
    if (!response.ok) return null;
    return ((await response.json()) as { blocked?: BlockedPerson[] }).blocked ?? [];
  } catch {
    return null;
  }
}
