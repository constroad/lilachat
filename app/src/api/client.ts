/**
 * Cliente del lilachat-server. Sin imports de react-native (testeable en
 * vitest); el `fetch` se puede inyectar en los tests.
 *
 * `EXPO_PUBLIC_API_URL` se hornea al compilar (lección Timón: un release con el
 * .env de dev sale apuntando al emulador y falla con wifi andando — el script
 * de release lo fija y lo verifica dentro del binario).
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 15_000;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | 'network'; message?: string };

type FetchLike = typeof fetch;

async function post<T>(
  route: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch
): Promise<ApiResult<T>> {
  try {
    const response = await fetchImpl(`${BASE_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 'network' };
  }
}

export const requestOtp = (phone: string, preferEmail = false, fetchImpl?: FetchLike) =>
  post<{ message: string }>('/api/auth/otp/request', { phone, preferEmail }, fetchImpl);

export const verifyOtp = (
  params: { phone: string; code: string; deviceId: string; name?: string },
  fetchImpl?: FetchLike
) =>
  post<{ deviceSecret: string; jwt: string; user: { id: string; name: string | null; phone: string } }>(
    '/api/auth/otp/verify',
    params,
    fetchImpl
  );

export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group';
  name?: string;
  memberIds: string[];
  lastSeq: number;
  unread: number;
  lastMessage: { seq: number; body?: string; kind?: string; senderId: string; at: string } | null;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Chat secreto (F9). */
  encrypted?: boolean;
};

async function get<T>(route: string, token: string, fetchImpl: FetchLike = fetch): Promise<ApiResult<T>> {
  try {
    const response = await fetchImpl(`${BASE_URL}${route}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 'network' };
  }
}

export const listChats = (token: string, fetchImpl?: FetchLike) =>
  get<{ chats: ChatSummary[] }>('/api/chats', token, fetchImpl);

export const refreshSession = (
  params: { deviceId: string; deviceSecret: string },
  fetchImpl?: FetchLike
) =>
  post<{ jwt: string; user?: { id: string; name: string | null; phone: string } }>(
    '/api/auth/session',
    params,
    fetchImpl
  );
