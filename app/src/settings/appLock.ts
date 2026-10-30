import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_APP_LOCK_DELAY_MS, appLockDelayOf, appLockDue } from '@lilachat/shared';
import { createPrefStore } from '../ui/prefStore';
import { confirmarQueEresTu } from './desbloqueo';

export type AppLockPref = { enabled: boolean; delayMs: number };

/** Stored as the delay in ms while it is on, empty while off (pending 9). `undefined` while it reads. */
const appLockStore = createPrefStore<AppLockPref | undefined>(
  'lilachat.pref.appLock',
  (stored) => (stored ? { enabled: true, delayMs: appLockDelayOf(Number(stored)) } : { enabled: false, delayMs: DEFAULT_APP_LOCK_DELAY_MS }),
  undefined,
  (value) => (value?.enabled ? String(value.delayMs) : '')
);
export const useAppLockPref = appLockStore.use;
export const setAppLockPref = (value: AppLockPref) => appLockStore.set(value);

/**
 * «Bloqueo de la app» (pending 9), like WhatsApp's fingerprint lock: a cold
 * start with it on asks, and so does coming back after the chosen delay. The
 * system prompt itself can send the app to the background, so nothing counts
 * while it is open.
 */
export function useAppLock(): { locked: boolean; unlock: () => Promise<void> } {
  const pref = useAppLockPref();
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const coldStartChecked = useRef(false);
  const authenticating = useRef(false);

  useEffect(() => {
    if (!pref || coldStartChecked.current) return;
    coldStartChecked.current = true;
    if (appLockDue({ ...pref, hiddenAt: null, now: Date.now(), coldStart: true })) setLocked(true);
  }, [pref]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (authenticating.current) return;
      if (state === 'background') {
        hiddenAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const current = appLockStore.get();
      if (current && appLockDue({ ...current, hiddenAt: hiddenAt.current, now: Date.now() })) setLocked(true);
      hiddenAt.current = null;
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    const ok = await confirmarQueEresTu('Desbloquea Lilachat');
    authenticating.current = false;
    if (!ok) return;
    hiddenAt.current = null;
    setLocked(false);
  }, []);

  return { locked, unlock };
}
