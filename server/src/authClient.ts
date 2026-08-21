/**
 * Cliente de constroad-auth. Contrato copiado del cliente VIVO de lilastore
 * (`authService.ts`) y del propio servicio (`constroad-auth/src/index.ts`) —
 * no inventado:
 *
 * - `POST /v1/codigo`      {companyId, destino, enlaceBase} → {canal}
 * - `POST /v1/verificar`   {companyId, destino, codigo, deviceId} → {secreto?}
 * - `POST /v1/dispositivos/:id/validar` {secreto} → {companyId, identidad, app}
 *
 * Dos reglas que el tipo `AuthOutcome` obliga a respetar:
 * - **Fail-closed**: sin llave configurada, `sin_configurar` — nunca un
 *   request sin credencial que del otro lado sería un 401 misterioso.
 * - **`sin_respuesta` ≠ rechazo**: la ausencia de respuesta no autoriza ni
 *   revoca; quien llama tiene que poder distinguirlas (regla escrita del
 *   servicio, y hay test que la fija).
 */

export type AuthOutcome<T> = { ok: true; valor: T } | { ok: false; codigo: string };

export interface AuthClient {
  requestCode(email: string): Promise<AuthOutcome<{ canal: string }>>;
  verifyCode(
    email: string,
    code: string,
    deviceId: string
  ): Promise<AuthOutcome<{ secreto?: string }>>;
  validateDevice(
    deviceId: string,
    deviceSecret: string
  ): Promise<AuthOutcome<{ companyId: string; identidad: string; app: string }>>;
}

const COMPANY_ID = 'constroad';
const TIMEOUT_MS = 12_000;
/** Producción como default: un default que no es el valor real obliga a
 *  declarar la variable en todos lados (constroad-security §2). */
const DEFAULT_AUTH_URL = 'https://auth.constroad.com';
const DEFAULT_CALLBACK = 'https://chat.constroad.com/login/callback';

function credentials(): { base: string; key: string } | null {
  const base = process.env.CONSTROAD_AUTH_URL || DEFAULT_AUTH_URL;
  const key = process.env.CONSTROAD_AUTH_KEY || '';
  return key ? { base, key } : null;
}

/** El enlace se ELIGE de la lista de la llave; en dev se apunta al localhost
 *  declarado ahí (`CONSTROAD_AUTH_CALLBACK`), igual que lilastore. */
const callbackUrl = (): string => process.env.CONSTROAD_AUTH_CALLBACK || DEFAULT_CALLBACK;

async function call<T>(route: string, body: Record<string, unknown>): Promise<AuthOutcome<T>> {
  const creds = credentials();
  if (!creds) return { ok: false, codigo: 'sin_configurar' };

  try {
    const response = await fetch(`${creds.base}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.key}` },
      body: JSON.stringify({ companyId: COMPANY_ID, ...body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return { ok: false, codigo: typeof payload?.codigo === 'string' ? payload.codigo : 'error' };
    }
    return { ok: true, valor: payload as T };
  } catch {
    return { ok: false, codigo: 'sin_respuesta' };
  }
}

export function buildHttpAuthClient(): AuthClient {
  return {
    requestCode: (email) => call('/v1/codigo', { destino: email, enlaceBase: callbackUrl() }),
    verifyCode: (email, code, deviceId) =>
      call('/v1/verificar', { destino: email, codigo: code, deviceId }),
    validateDevice: (deviceId, deviceSecret) =>
      call(`/v1/dispositivos/${encodeURIComponent(deviceId)}/validar`, { secreto: deviceSecret }),
  };
}
