import type { ContactGroup } from '@lilachat/shared';

/**
 * Contactos y creación de chats.
 *
 * Igual que los otros clientes: vive junto a lo que le habla y no en un cajón
 * común, para que cada uno diga a qué recurso apunta.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const TIMEOUT_MS = 15_000;

export type ContactsResult<T> = { ok: true; data: T } | { ok: false; message?: string };

async function call<T>(route: string, jwt: string, init: RequestInit = {}): Promise<ContactsResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, ...(init.headers ?? {}) },
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

export const listContacts = (jwt: string) => call<{ groups: ContactGroup[] }>('/api/contacts', jwt);

export const createChat = (
  jwt: string,
  body: { kind: 'direct' | 'group'; memberIds: string[]; name?: string; encrypted?: boolean }
) => call<{ chatId: string }>('/api/chats', jwt, { method: 'POST', body: JSON.stringify(body) });
