import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROFILE_CHECK_LIMIT_MS, profileCompleteKey, profileGateAfter, profileGateNow, type MyProfile, type ProfileGateState } from '@lilachat/shared';
import { getProfile } from '../api/profileApi';

function rememberComplete(userId: string, complete: boolean): void {
  const key = profileCompleteKey(userId);
  void (complete ? AsyncStorage.setItem(key, '1') : AsyncStorage.removeItem(key)).catch((error: unknown) => console.warn('[perfil] no se pudo recordar:', error instanceof Error ? error.message : error));
}

/**
 * Whether «Completa tu perfil» covers the app (José, 21/10; backlog 17;
 * `shared/profile.ts › profileGateNow`). Someone this phone saw complete opens
 * at once; anyone else waits for the server, so the chats no longer flash
 * before the form (22/10). Without an answer (offline) the app opens as always.
 */
export function useProfileGate(jwt: string | null, userId: string | null): { checking: boolean; incomplete: MyProfile | null; done: (profile: MyProfile) => void } {
  const [answer, setAnswer] = useState<ProfileGateState | null>(null);
  const [knownComplete, setKnownComplete] = useState<boolean | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    setKnownComplete(null);
    if (!userId) return;
    let alive = true;
    AsyncStorage.getItem(profileCompleteKey(userId))
      .then((stored) => alive && setKnownComplete(stored === '1'))
      .catch(() => alive && setKnownComplete(false));
    return () => {
      alive = false;
    };
  }, [userId]);
  useEffect(() => {
    setAnswer(null);
    setGaveUp(false);
    if (!jwt || !userId) return;
    let alive = true;
    void getProfile(jwt).then((result) => {
      if (!alive) return;
      // An answer without a profile (an older server) blocks nothing; a failure says nothing about the profile.
      const next = profileGateAfter(result.ok ? { ok: true, profile: result.data?.profile } : { ok: false });
      setAnswer(next);
      if (result.ok) rememberComplete(userId, next.status === 'open');
    });
    const timer = setTimeout(() => setGaveUp(true), PROFILE_CHECK_LIMIT_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jwt, userId]);
  const done = useCallback(() => {
    setAnswer({ status: 'open' });
    if (userId) rememberComplete(userId, true);
  }, [userId]);
  const state = profileGateNow({ answer, knownComplete: knownComplete === true, offline: !jwt, gaveUp });
  return { checking: state.status === 'checking', incomplete: state.status === 'blocked' ? state.profile : null, done };
}
