import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { alConectar, reconnectNow } from './socketClient';
import { networkCameBack, shouldRehydrate } from './networkReturn';

/** The network came back in front: every queue drains now (José 26/11, a site with patches of signal). */
export function useReconnectWhenNetworkReturns(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    let online: boolean | null = null;
    const subscription = Network.addNetworkStateListener((reading) => {
      const step = networkCameBack(online, reading);
      online = step.online;
      if (step.cameBack && AppState.currentState === 'active') reconnectNow();
    });
    return () => subscription.remove();
  }, [active]);
}

type HydrateRun = (jwt: string, alive: () => boolean) => Promise<void>;

/**
 * The once-per-session hydrator, after `delayMs`, and again on each reconnect
 * (at most every 10 min): a boot without signal left it with nothing. The token
 * is read at each run, so a rerun after a renewal never uses the old one.
 */
export function useRehydrateOnConnect(active: boolean, jwtNow: () => string | null, run: HydrateRun, delayMs: number): void {
  const latest = useRef({ jwtNow, run });
  latest.current = { jwtNow, run };
  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    let lastRun: number | null = null;
    let running = false;
    const hydrate = () => {
      const jwt = latest.current.jwtNow();
      if (!jwt || running || !shouldRehydrate(lastRun, Date.now())) return;
      running = true;
      lastRun = Date.now();
      void latest.current.run(jwt, () => alive).finally(() => {
        running = false;
      });
    };
    const timer = setTimeout(hydrate, delayMs);
    const stopListening = alConectar(() => {
      if (lastRun !== null) hydrate();
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      stopListening();
    };
  }, [active, delayMs]);
}
