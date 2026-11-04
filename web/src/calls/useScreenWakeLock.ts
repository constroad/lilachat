import { useEffect } from 'react';

/**
 * The screen stays on while `active`: the app's keep-awake, for the web (José,
 * 04/11: a video call let the phone lock). The browser drops the lock whenever
 * the tab hides, so coming back asks again. Without Wake Lock in the browser
 * the call goes on, with a screen that locks.
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = navigator.wakeLock;
    if (!active || !wakeLock) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      wakeLock.request('screen').then(
        (granted) => {
          if (stopped) void granted.release();
          else lock = granted;
        },
        (error: unknown) => console.warn('[llamada] wake lock:', error instanceof Error ? error.message : error)
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [active]);
}
