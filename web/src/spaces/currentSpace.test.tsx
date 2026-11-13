import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { forgetMySpaces, keepLiveUnread, setCurrentSpaceId, useCurrentSpaceLogo, useMySpaces } from './currentSpace';

/**
 * My spaces, asked from several places (the first load, the switcher, a space
 * just created). E2E 21/10: the first load answered AFTER the reload of a
 * space just created, the empty old list won, and the screen went back to
 * personal. The answer of the latest request is the one that stays.
 */
describe('useMySpaces', () => {
  afterEach(() => {
    forgetMySpaces();
    localStorage.clear();
  });

  it('a late answer of an older request does not overwrite the newer one', async () => {
    const resolvers: ((body: unknown) => void)[] = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => resolvers.push((body) => resolve(new Response(JSON.stringify(body), { status: 200 }))))));
    const { result } = renderHook(() => useMySpaces('t'));
    await waitFor(() => expect(resolvers).toHaveLength(1));
    let second: Promise<void> = Promise.resolve();
    act(() => {
      second = result.current.reload();
    });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => {
      resolvers[1]!({ workspaces: [{ id: 'w1', name: 'QA Obra', status: 'active' }] });
      await second;
    });
    await act(async () => {
      resolvers[0]!({ workspaces: [] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.spaces?.map((space) => space.id)).toEqual(['w1']);
  });

  it('the spaces this browser saw for this person paint at once (22/10), then the server answers; another person sees none', async () => {
    localStorage.setItem('lilachat.espacios', JSON.stringify({ userId: 'u1', spaces: [{ id: 'w1', name: 'Constroad', status: 'active' }] }));
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const mine = renderHook(() => useMySpaces('t', 'u1'));
    expect(mine.result.current.spaces?.map((space) => space.name)).toEqual(['Constroad']);
    mine.unmount();
    forgetMySpaces();
    localStorage.setItem('lilachat.espacios', JSON.stringify({ userId: 'u1', spaces: [{ id: 'w1', name: 'Constroad', status: 'active' }] }));
    const other = renderHook(() => useMySpaces('t', 'u2'));
    expect(other.result.current.spaces).toBeNull();
  });

  /** José 11/11: read in Constroad, then in Inframaq: the rail kept Constroad's old count, and Inframaq's after going back. */
  it('the count a space showed live stays after leaving it, and nothing changes when it is the same', async () => {
    localStorage.setItem('lilachat.espacios', JSON.stringify({ userId: 'u1', spaces: [{ id: 'w1', name: 'Constroad', status: 'active', unreadChats: 1 }, { id: 'w2', name: 'Inframaq', status: 'active', unreadChats: 1 }] }));
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const { result } = renderHook(() => useMySpaces('t', 'u1'));
    const before = result.current.spaces;

    act(() => keepLiveUnread('w1', [{ unread: 0 }, { unread: 0 }], 'u1'));
    act(() => keepLiveUnread('w1', [{ unread: 0 }], 'u1'));
    act(() => keepLiveUnread('w9', [{ unread: 3 }], 'u1'));

    expect(result.current.spaces?.map((space) => space.unreadChats)).toEqual([0, 1]);
    expect(result.current.spaces?.[1]).toBe(before?.[1]);
    expect(JSON.parse(localStorage.getItem('lilachat.espacios') ?? '{}').spaces[0].unreadChats).toBe(0);
  });
});

describe('useCurrentSpaceLogo', () => {
  afterEach(() => {
    forgetMySpaces();
    setCurrentSpaceId(null);
    localStorage.clear();
  });

  it('gives the open space\'s logo for the camera, and nothing in the personal account (José 13/11)', () => {
    // Arrange
    localStorage.setItem('lilachat.espacios', JSON.stringify({ userId: 'u1', spaces: [{ id: 'w1', name: 'Constroad', status: 'active', logoUrl: 'https://x/logo.png' }] }));
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderHook(() => useMySpaces('t', 'u1'));
    const logo = renderHook(() => useCurrentSpaceLogo());
    // Act
    act(() => setCurrentSpaceId('w1'));
    // Assert
    expect(logo.result.current).toBe('https://x/logo.png');
    act(() => setCurrentSpaceId(null));
    expect(logo.result.current).toBeNull();
  });
});
