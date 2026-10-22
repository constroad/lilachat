import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { profileCompleteKey, type MyProfile } from '@lilachat/shared';
import { useProfileGate } from './useProfileGate';

const incomplete: MyProfile = { name: 'Ana', phone: '987654321', avatarUrl: null, email: null, emailVerified: false, birthday: null, birthdayVisible: true, missing: ['birthday'] };
const answer = (profile: MyProfile) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ profile }), { status: 200 }));
const mount = (params: { jwt: string | null; sessionSettled?: boolean }) => renderHook(() => useProfileGate({ jwt: params.jwt, userId: 'u1', sessionSettled: params.sessionSettled ?? true }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/** 22/10: the chats flashed and then the form jumped in. */
describe('profile gate (web)', () => {
  it('someone not yet seen complete waits for the answer, then gets the form', async () => {
    answer(incomplete);
    const { result } = mount({ jwt: 'jwt' });
    expect(result.current.checking).toBe(true);
    await waitFor(() => expect(result.current.incomplete).toEqual(incomplete));
    expect(result.current.checking).toBe(false);
  });

  it('someone seen complete opens at once and stays remembered; a server that now says something is missing still blocks', async () => {
    localStorage.setItem(profileCompleteKey('u1'), '1');
    answer(incomplete);
    const { result } = mount({ jwt: 'jwt' });
    expect(result.current.checking).toBe(false);
    await waitFor(() => expect(result.current.incomplete).toEqual(incomplete));
    expect(localStorage.getItem(profileCompleteKey('u1'))).toBeNull();
  });

  it('a complete answer is remembered; finishing the form too', async () => {
    answer({ ...incomplete, missing: [] });
    const { result } = mount({ jwt: 'jwt' });
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(localStorage.getItem(profileCompleteKey('u1'))).toBe('1');
  });

  it('without network nothing is blocked nor remembered; a settled session with no token opens', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const { result } = mount({ jwt: 'jwt' });
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.incomplete).toBeNull();
    expect(localStorage.getItem(profileCompleteKey('u1'))).toBeNull();
    expect(mount({ jwt: null }).result.current.checking).toBe(false);
    expect(mount({ jwt: null, sessionSettled: false }).result.current.checking).toBe(true);
  });
});
