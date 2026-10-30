import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { pendingFilesCount } from '../chat/colaDeArchivos';
import { pendingOutboxCount } from '../chat/outboxStore';
import { CHECK_EVERY_MS, shouldApplyUpdateNow, shouldCheckForUpdate } from './applyPolicy';

/**
 * OTA updates with no screen of their own (agentes 25/10/2026). Checks and
 * downloads quietly; applies ONLY when the app returns to the foreground after
 * a real absence with nothing in flight (`applyPolicy`). It never reloads in
 * the background and never says anything: a person finds the new code the next
 * time they come back, like WhatsApp Web.
 *
 * Off in development (Metro serves the code) and when the build has no
 * updates (`Updates.isEnabled`).
 */
export function useActualizacionSilenciosa(callInProgress: boolean): void {
  const { isUpdatePending } = Updates.useUpdates();
  const latest = useRef({ isUpdatePending, callInProgress });
  latest.current = { isUpdatePending, callInProgress };
  const lastCheckAt = useRef<number | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const reloading = useRef(false);

  const checkQuietly = useCallback(async () => {
    if (!shouldCheckForUpdate(lastCheckAt.current, Date.now())) return;
    lastCheckAt.current = Date.now();
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) await Updates.fetchUpdateAsync();
    } catch (error) {
      // No signal or the server is down: nothing to tell anyone, the next check tries again.
      console.warn('[ota] check failed:', error instanceof Error ? error.message : String(error));
    }
  }, []);

  const applyIfIdle = useCallback(async (backgroundMs: number | null) => {
    const decision = shouldApplyUpdateNow({
      updatePending: latest.current.isUpdatePending,
      backgroundMs,
      callInProgress: latest.current.callInProgress,
      unsentMessages: pendingOutboxCount(),
      unsentFiles: pendingFilesCount(),
    });
    if (decision !== 'apply' || reloading.current) return false;
    reloading.current = true;
    // Nothing runs after this line: the JavaScript restarts.
    await Updates.reloadAsync();
    return true;
  }, []);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    void checkQuietly();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void checkQuietly();
    }, CHECK_EVERY_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const away = backgroundedAt.current === null ? null : Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      void applyIfIdle(away).then((applied) => {
        if (!applied) void checkQuietly();
      });
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [applyIfIdle, checkQuietly]);
}
