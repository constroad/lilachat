import { useCallback, useEffect, useState } from 'react';
import type { MyProfile } from '@lilachat/shared';
import { getProfile } from '../api/profileApi';

/**
 * Whether «Completa tu perfil» must be shown (José, 21/10; backlog 17): asked
 * once per signed-in session. Only a server that says something is missing
 * blocks; without an answer (offline) the app opens as always.
 */
export function useProfileGate(jwt: string | null): { incomplete: MyProfile | null; done: (profile: MyProfile) => void } {
  const [incomplete, setIncomplete] = useState<MyProfile | null>(null);
  useEffect(() => {
    setIncomplete(null);
    if (!jwt) return;
    let alive = true;
    void getProfile(jwt).then((result) => {
      // An answer without a profile (an older server) blocks nothing.
      if (alive && result.ok && result.data?.profile?.missing?.length) setIncomplete(result.data.profile);
    });
    return () => {
      alive = false;
    };
  }, [jwt]);
  const done = useCallback(() => setIncomplete(null), []);
  return { incomplete, done };
}
