import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { refreshSession } from '../api/client';
import { onSessionRejected } from '../chat/socketClient';
import { registrarPerf } from '../diagnostico/diagnostico';
import { withRefreshedSession } from './arranque';
import { loadCredential, saveCredential, type Credential } from './credentialStore';
import { createSessionRenewer, type RenewalResult, type SessionRenewer } from './sessionRenewal';

type RenewalOptions = {
  hasSession: boolean;
  /** «Conexión permanente»: the socket stays up in the background, so a refusal is answered there too. */
  alwaysConnected: boolean;
  onRenewed: (credential: Credential) => void;
  onRevoked: () => void;
};

async function refreshStoredSession(): Promise<RenewalResult<Credential> | null> {
  const stored = await loadCredential();
  if (!stored) return null;
  const startedAt = Date.now();
  const session = await refreshSession({ deviceId: stored.deviceId, deviceSecret: stored.deviceSecret });
  if (!session.ok) return { ok: false, revoked: session.status === 401 };
  void registrarPerf('sesion-renovada', Date.now() - startedAt);
  return { ok: true, session: withRefreshedSession(stored, session.data) };
}

/** Renews the JWT while the process lives: when the app comes back and when the server refuses the socket. */
export function useSessionRenewal(options: RenewalOptions): SessionRenewer {
  const { hasSession, alwaysConnected } = options;
  const latest = useRef(options);
  latest.current = options;
  const [renewer] = useState(() =>
    createSessionRenewer<Credential>({
      refresh: refreshStoredSession,
      // Saved here and not in `refresh`: an answer dropped by a sign-out must not write the credential back.
      onRenewed: (credential) => {
        void saveCredential(credential);
        latest.current.onRenewed(credential);
      },
      onRevoked: () => latest.current.onRevoked(),
      now: Date.now,
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    })
  );

  useEffect(() => {
    const unsubscribe = onSessionRejected(renewer.renewRejected);
    return () => {
      unsubscribe();
    };
  }, [renewer]);

  useEffect(() => {
    if (!hasSession) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') renewer.renewIfDue();
      else if (!alwaysConnected) renewer.pause();
    });
    return () => subscription.remove();
  }, [renewer, hasSession, alwaysConnected]);

  return renewer;
}
