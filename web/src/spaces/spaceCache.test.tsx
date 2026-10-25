import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BaseLocal } from '../local/baseLocal';
import { forgetMySpaces, setCurrentSpaceId } from './currentSpace';
import { useSpacesWeb } from './useSpacesWeb';

/**
 * A reload mounts the shell BEFORE the session renews (`credential.jwt` is `''`
 * until `POST /api/auth/session` answers). José, 25/10: with the space's list
 * missing from the cache the sidebar said «No se pudo cargar el espacio» until
 * he tapped retry, and with it present a chat deleted on the server stayed in
 * the list through two reloads. Both were the list asking for itself with no
 * token, failing, and never asking again when the token arrived.
 */
const SPACE = { id: 'w1', name: 'Test', status: 'active' };
const chat = (id: string) => ({ id, kind: 'group', name: id, memberIds: [], lastSeq: 0, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0 });
const TOKEN = 'live-token';

let requests: { url: string; authorized: boolean }[] = [];

const answerFor = (url: string) => {
  if (url.includes('/chats?workspace=w1')) return { chats: [chat('general')], activity: { mentions: 0, threads: 0 } };
  return { workspaces: [SPACE], members: [], channels: [], items: [], unread: { mentions: 0, threads: 0 } };
};

beforeEach(() => {
  requests = [];
  localStorage.setItem('lilachat.espacios', JSON.stringify({ userId: 'u1', spaces: [SPACE] }));
  setCurrentSpaceId(SPACE.id);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const authorized = (init?.headers as Record<string, string> | undefined)?.Authorization === `Bearer ${TOKEN}`;
      requests.push({ url, authorized });
      if (!authorized) return new Response(JSON.stringify({ message: 'Sin sesión.' }), { status: 401 });
      return new Response(JSON.stringify(answerFor(url)), { status: 200 });
    })
  );
});

afterEach(() => {
  setCurrentSpaceId(null);
  forgetMySpaces();
  localStorage.clear();
});

const params = (jwt: string, base: BaseLocal | null = null) => ({
  jwt,
  myUserId: 'u1',
  base,
  me: { name: 'José', phone: '+51902049935' },
  personalUnread: 0,
  online: new Set<string>(),
  selectedChatId: null,
  onOpenChat: vi.fn(),
  onOpenMessage: vi.fn(),
  onPersonalChat: vi.fn(),
});

const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 40))));

/** A person's local base that already saw the space's list `ageMs` ago. */
const baseThatSaw = (chats: unknown[], ageMs: number) =>
  ({
    meta: {
      get: async (clave: string) => (clave === 'space-cache:w1:chats' ? { clave, valor: { value: { chats, activity: { mentions: 0, threads: 0 } }, fetchedAt: Date.now() - ageMs } } : undefined),
      put: async () => undefined,
      where: () => ({ startsWith: () => ({ delete: async () => 0 }) }),
    },
  }) as unknown as BaseLocal;

describe('the space list before the session renews', () => {
  it('asks for nothing without a token, and loads once it arrives (first load, no cache)', async () => {
    const { result, rerender } = renderHook((jwt: string) => useSpacesWeb(params(jwt)), { initialProps: '' });
    await settle();
    expect(requests.filter((request) => !request.authorized)).toEqual([]);
    expect(result.current.failed).toBe(false);

    rerender(TOKEN);
    await waitFor(() => expect(result.current.chats?.map((one) => one.id)).toEqual(['general']));
    expect(result.current.failed).toBe(false);
  });

  it('a stale list from disk paints at once, and the server\'s list replaces it when the token arrives', async () => {
    const base = baseThatSaw([chat('deleted-on-server')], 10 * 60_000);
    const { result, rerender } = renderHook((jwt: string) => useSpacesWeb(params(jwt, base)), { initialProps: '' });
    await waitFor(() => expect(result.current.chats?.map((one) => one.id)).toEqual(['deleted-on-server']));

    rerender(TOKEN);
    await waitFor(() => expect(result.current.chats?.map((one) => one.id)).toEqual(['general']));
  });
});
