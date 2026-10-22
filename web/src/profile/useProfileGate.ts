import { useCallback, useEffect, useMemo, useState } from 'react';
import { PROFILE_CHECK_LIMIT_MS, profileCompleteKey, profileGateAfter, profileGateNow, type MyProfile, type ProfileGateState } from '@lilachat/shared';
import { getProfile } from './profileApi';

function rememberedComplete(userId: string): boolean {
  try {
    return localStorage.getItem(profileCompleteKey(userId)) === '1';
  } catch {
    return false;
  }
}

function rememberComplete(userId: string, complete: boolean): void {
  try {
    if (complete) localStorage.setItem(profileCompleteKey(userId), '1');
    else localStorage.removeItem(profileCompleteKey(userId));
  } catch {
    // A private window without storage asks the server again next time: nothing is lost.
  }
}

/**
 * Whether «Completa tu perfil» covers the web, like the app (backlog 17;
 * `shared/profile.ts › profileGateNow`). While the answer is pending the
 * page shows nothing instead of the chats: they used to flash and the form
 * jumped in (22/10).
 */
export function useProfileGate(params: { jwt: string | null; userId: string | null; sessionSettled: boolean }): { checking: boolean; incomplete: MyProfile | null; done: () => void } {
  const { jwt, userId, sessionSettled } = params;
  const [answer, setAnswer] = useState<ProfileGateState | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const knownComplete = useMemo(() => (userId ? rememberedComplete(userId) : false), [userId]);
  useEffect(() => {
    setAnswer(null);
    if (!jwt || !userId) return;
    let alive = true;
    void getProfile(jwt).then((result) => {
      if (!alive) return;
      const next = profileGateAfter(result.ok ? { ok: true, profile: result.data?.profile } : { ok: false });
      setAnswer(next);
      // Only a real answer is remembered; a failure (no network) says nothing about the profile.
      if (result.ok) rememberComplete(userId, next.status === 'open');
    });
    return () => {
      alive = false;
    };
  }, [jwt, userId]);
  useEffect(() => {
    const timer = window.setTimeout(() => setGaveUp(true), PROFILE_CHECK_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const done = useCallback(() => {
    setAnswer({ status: 'open' });
    if (userId) rememberComplete(userId, true);
  }, [userId]);
  const state = profileGateNow({ answer, knownComplete, offline: !userId || (sessionSettled && !jwt), gaveUp });
  return { checking: state.status === 'checking', incomplete: state.status === 'blocked' ? state.profile : null, done };
}
