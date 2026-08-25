/**
 * Cliente del respaldo (F7).
 *
 * Vive aparte del de agenda por la misma razón que aquel vive aparte del chat:
 * `agendaApi` tiene el prefijo `/api/agenda` FIJO adentro, y estirarlo con un
 * parámetro de ruta para reusarlo acá lo volvería un cajón de sastre. Son
 * treinta líneas y cada cliente dice a qué recurso le habla.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 60_000;

export type BackupResult<T> = { ok: true; data: T } | { ok: false; message?: string };

export type BackupStatus = {
  count: number;
  lastAt: string | null;
  totalBytes: number;
  totalLabel: string;
  stale: boolean;
};

async function call<T>(route: string, jwt: string, init: RequestInit = {}): Promise<BackupResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}/api/backup${route}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, ...(init.headers ?? {}) },
      // Un respaldo tarda: el timeout es más largo que el del resto de la app.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, message: typeof payload.message === 'string' ? payload.message : undefined };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: 'Sin conexión. Inténtalo de nuevo.' };
  }
}

export const getBackupStatus = (jwt: string) => call<BackupStatus>('', jwt);

export const runBackupNow = (jwt: string) =>
  call<{ sizeLabel: string; mediaCount: number }>('/run', jwt, { method: 'POST', body: '{}' });
