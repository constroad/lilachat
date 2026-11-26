/**
 * The phone's network came back (José 26/11, a site with patches of signal):
 * the socket reconnects NOW instead of waiting up to 30 s of socket.io's
 * backoff, and with it every queue drains (`alConectar`). PURE.
 */
export type NetworkReading = { isConnected?: boolean; isInternetReachable?: boolean | null };

/** Online = connected and not known to be without internet (`null` = not measured yet). */
export const isOnline = (reading: NetworkReading): boolean => reading.isConnected === true && reading.isInternetReachable !== false;

/** Only the step from offline to online counts; the first reading is not a return. */
export function networkCameBack(before: boolean | null, now: NetworkReading): { online: boolean; cameBack: boolean } {
  const online = isOnline(now);
  return { online, cameBack: before === false && online };
}

/** The once-per-session hydrator runs again on a reconnect, at most this often: a boot without signal left it empty. */
export const REHYDRATE_EVERY_MS = 10 * 60_000;
export const shouldRehydrate = (last: number | null, now: number): boolean => last === null || now - last >= REHYDRATE_EVERY_MS;
