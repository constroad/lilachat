/**
 * El cliente HTTP de la web.
 *
 * Mismo origen que el server (en desarrollo por el proxy de Vite, en producción
 * porque Express sirve este bundle), así que las rutas son relativas: sin CORS,
 * sin una URL de API que configurar por entorno y sin la clase de bug donde el
 * build de producción apunta al localhost del desarrollador.
 */
/**
 * La sesión de la web (W0, 19/10).
 *
 * - En `localStorage` va SOLO el perfil (quién soy y el id de este navegador),
 *   nada que sirva para entrar.
 * - El secreto del dispositivo vive en una cookie `HttpOnly` que pone el server
 *   y que JavaScript no ve.
 * - El JWT (24 h) vive en MEMORIA: se renueva al abrir con la cookie.
 *
 * Antes el JWT y el secreto iban juntos en `localStorage`: un script inyectado
 * se llevaba la sesión para siempre.
 */
const PERFIL_KEY = 'lilachat.perfil';
/** La credencial de antes de W0: se lee una vez para mudarla a la cookie. */
const CREDENCIAL_VIEJA_KEY = 'lilachat.credential';

export type Perfil = {
  userId: string;
  phone: string;
  name?: string;
  deviceId: string;
};

/** Lo que usa la app con sesión: el perfil más el JWT en memoria (vacío sin red). */
export type Credential = Perfil & { jwt: string };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

function leerJson(clave: string): Record<string, unknown> | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const esPerfil = (valor: Record<string, unknown> | null): valor is Perfil & Record<string, unknown> =>
  Boolean(valor && typeof valor.userId === 'string' && typeof valor.deviceId === 'string');

/** El perfil guardado; si solo está la credencial vieja, su perfil (sin secretos). */
export function loadPerfil(): Perfil | null {
  const actual = leerJson(PERFIL_KEY);
  const fuente = esPerfil(actual) ? actual : leerJson(CREDENCIAL_VIEJA_KEY);
  if (!esPerfil(fuente)) return null;
  return { userId: fuente.userId, phone: String(fuente.phone ?? ''), name: typeof fuente.name === 'string' ? fuente.name : undefined, deviceId: fuente.deviceId };
}

export function savePerfil(perfil: Perfil): void {
  try {
    localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
  } catch {
    // Modo privado: la sesión dura lo que la pestaña.
  }
}

/** El secreto de una sesión vieja, para mudarlo a la cookie en el primer arranque. */
export function leerSecretoViejo(): { deviceId: string; deviceSecret: string } | null {
  const vieja = leerJson(CREDENCIAL_VIEJA_KEY);
  return vieja && typeof vieja.deviceId === 'string' && typeof vieja.deviceSecret === 'string'
    ? { deviceId: vieja.deviceId, deviceSecret: vieja.deviceSecret }
    : null;
}

/** Ya mudado (o revocado): el secreto viejo no puede quedar en `localStorage`. */
export function borrarCredencialVieja(): void {
  try {
    localStorage.removeItem(CREDENCIAL_VIEJA_KEY);
  } catch {
    // Nada que borrar.
  }
}

export function clearPerfil(): void {
  try {
    localStorage.removeItem(PERFIL_KEY);
  } catch {
    // Nada que borrar.
  }
  borrarCredencialVieja();
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
 * Renovar el `jwt` con la cookie del dispositivo (o, una sola vez, con el
 * secreto de una sesión vieja, que el server muda a la cookie).
 *
 * **No borra la sesión si falla por red**: solo un 401 real revoca.
 */
export async function refreshSession(
  secretoViejo?: { deviceId: string; deviceSecret: string } | null
): Promise<{ ok: true; jwt: string; user?: { name: string | null } } | { ok: false; revocado: boolean }> {
  const result = await api<{ jwt: string; user?: { name: string | null } }>('/auth/session', {
    body: { cliente: 'web', ...(secretoViejo ?? {}) },
  });
  if (result.ok) return { ok: true, jwt: result.data.jwt, user: result.data.user };
  return { ok: false, revocado: result.status === 401 };
}

/** Cerrar sesión: el server borra la cookie y este navegador deja de recibir avisos. */
export async function salirDelServer(): Promise<void> {
  await api('/auth/salir', { method: 'POST' });
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
