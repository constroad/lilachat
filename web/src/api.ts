/**
 * El cliente HTTP de la web.
 *
 * Mismo origen que el server (en desarrollo por el proxy de Vite, en producción
 * porque Express sirve este bundle), así que las rutas son relativas: sin CORS,
 * sin una URL de API que configurar por entorno y sin la clase de bug donde el
 * build de producción apunta al localhost del desarrollador.
 */
const CREDENTIAL_KEY = 'lilachat.credential';

export type Credential = {
  jwt: string;
  userId: string;
  phone: string;
  name?: string;
  deviceId: string;
  /**
   * El secreto del dispositivo, que es lo que permite renovar la sesión SIN
   * pedir otro código.
   *
   * La web lo tiraba: guardaba solo el `jwt`, que dura 24 h, así que al día
   * siguiente había que volver a escribir un código —mientras la app, que sí lo
   * guardaba, seguía entrando sola—. WhatsApp Web mantiene la sesión hasta que
   * uno la cierra, y esto es lo que faltaba para hacer lo mismo.
   */
  deviceSecret?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export function loadCredential(): Credential | null {
  const raw = localStorage.getItem(CREDENTIAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Credential;
    return parsed.jwt && parsed.deviceId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCredential(credential: Credential): void {
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
}

export function clearCredential(): void {
  localStorage.removeItem(CREDENTIAL_KEY);
}

/**
 * El id de dispositivo de ESTE navegador. Persiste: si cambiara en cada carga,
 * cada refresco crearía un dispositivo nuevo y la lista de sesiones del usuario
 * se llenaría de fantasmas.
 */
export function deviceId(): string {
  const KEY = 'lilachat.deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Renovar el `jwt` con el secreto del dispositivo.
 *
 * Se llama al arrancar y ante cualquier 401. **No borra la sesión si falla por
 * red**: quedarse afuera porque el wifi estaba mal es exactamente lo que esta
 * app existe para evitar.
 */
export async function refreshSession(
  credential: Credential
): Promise<{ ok: true; jwt: string } | { ok: false; revocado: boolean }> {
  if (!credential.deviceSecret) return { ok: false, revocado: false };

  const result = await api<{ jwt: string }>('/auth/session', {
    body: { deviceId: credential.deviceId, deviceSecret: credential.deviceSecret },
  });

  if (result.ok) return { ok: true, jwt: result.data.jwt };
  // Solo un 401 REAL revoca. Un 503 o la falta de red dejan pasar con lo que hay.
  return { ok: false, revocado: result.status === 401 };
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; jwt?: string } = {}
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.jwt ? { Authorization: `Bearer ${options.jwt}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) return { ok: true, data: undefined as T };

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: (data as { message?: string }).message ?? 'No se pudo completar.',
      };
    }
    return { ok: true, data: data as T };
  } catch {
    // Sin red NO se dice «rechazado»: son cosas distintas y confundirlas hace
    // que el usuario borre su sesión creyendo que caducó.
    return { ok: false, status: 0, message: 'Sin conexión. Revisa tu internet.' };
  }
}
