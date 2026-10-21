import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMySpaces } from './currentSpace';

/**
 * My spaces, asked from several places (the first load, the switcher, a space
 * just created). E2E 21/10: the first load answered AFTER the reload of a
 * space just created, the empty old list won, and the screen went back to
 * personal. The answer of the latest request is the one that stays.
 */
describe('useMySpaces', () => {
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
});
