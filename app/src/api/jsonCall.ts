/**
 * One JSON request with the session, a timeout and the server's message on a
 * refusal. `status` tells «it no longer exists» (404) from «no network».
 */
import { buildHeader, reportStatus } from './appBuild';

const TIMEOUT_MS = 15_000;

export type JsonResult<T> = { ok: true; data: T } | { ok: false; message?: string; status?: number };

export async function jsonCall<T>(url: string, jwt: string, init: RequestInit = {}): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, ...buildHeader(), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      reportStatus(response.status);
      return { ok: false, message: typeof payload.message === 'string' ? payload.message : undefined, status: response.status };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: 'Sin conexión. Inténtalo de nuevo.' };
  }
}
