import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetalleDelChat } from './useDetalleDelChat';
import { useMentionCandidatesWeb } from './useMentionCandidatesWeb';

afterEach(() => vi.unstubAllGlobals());

const detail = {
  miembros: new Map([
    ['u-me', { id: 'u-me', nombre: 'Tú', rol: 'admin', esYo: true }],
    ['u-ana', { id: 'u-ana', nombre: 'Ana', rol: 'member', esYo: false }],
  ]),
} as unknown as DetalleDelChat;

const SPACE = '6a90cf90d2dbc98541f59aaa';

function stubDirectory() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ members: [
      { id: 'm1', userId: 'u-me', name: 'Yo', status: 'active', role: 'admin' },
      { id: 'm2', userId: 'u-ana', name: 'Ana', status: 'active', role: 'member' },
      { id: 'm3', userId: 'u-carla', name: 'Carla', status: 'active', role: 'member' },
    ] }), { status: 200 }))
  );
}

/** José 25/10: «@» in a channel lists the people of the space too. */
describe('useMentionCandidatesWeb', () => {
  it('a chat that is not a group offers nothing', () => {
    const { result } = renderHook(() => useMentionCandidatesWeb({ jwt: 'jwt', isGroup: false, detail, myUserId: 'u-me' }));
    expect(result.current).toBeUndefined();
  });

  it('while the chat detail is loading it offers nothing', () => {
    const { result } = renderHook(() => useMentionCandidatesWeb({ jwt: 'jwt', isGroup: true, detail: null, myUserId: 'u-me' }));
    expect(result.current).toBeUndefined();
  });

  it('a group outside a space offers just its people, without me', () => {
    const { result } = renderHook(() => useMentionCandidatesWeb({ jwt: 'jwt', isGroup: true, detail, myUserId: 'u-me' }));
    expect(result.current).toEqual([{ id: 'u-ana', nombre: 'Ana', foto: undefined }]);
  });

  it('a channel adds the rest of its space, marked as outside', async () => {
    stubDirectory();
    const { result } = renderHook(() => useMentionCandidatesWeb({ jwt: 'jwt', workspaceId: SPACE, isGroup: true, detail, myUserId: 'u-me' }));
    await waitFor(() => expect(result.current?.map((one) => one.id)).toEqual(['u-ana', 'u-carla']));
    expect(result.current?.[1]).toMatchObject({ nombre: 'Carla', outsideChat: true });
    expect(result.current?.[0]?.outsideChat).toBeUndefined();
  });
});
