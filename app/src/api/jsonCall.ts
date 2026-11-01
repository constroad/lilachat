/**
 * One JSON request with the session, a timeout and the server's message on a
 * refusal. `status` tells «it no longer exists» (404) from «no network».
 */
import { buildHeader, reportStatus } from './appBuild';

const TIMEOUT_MS = 15_000;
const NO_CONNECTION = 'Sin conexión. Inténtalo de nuevo.';

export type JsonResult<T> = { ok: true; data: T } | { ok: false; message?: string; status?: number };

export async function jsonCall<T>(url: string, jwt: string, init: RequestInit = {}): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, ...buildHeader(), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      reportStatus(response.status);
      return { ok: false, message: typeof payload?.message === 'string' ? payload.message : undefined, status: response.status };
    }
    // 01/11: a 2xx whose body did not arrive whole was taken as `{}` and left the spaces undefined.
    if (!payload) return { ok: false, message: NO_CONNECTION };
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
}

/** The body as JSON, or `undefined` when it could not be read or is not JSON (a cut connection, an HTML page). An empty body is `{}`: a 204 is a success. */
async function readJson(response: Response): Promise<Record<string, unknown> | undefined> {
  const text = await response.text().catch(() => undefined);
  if (text === undefined) return undefined;
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
