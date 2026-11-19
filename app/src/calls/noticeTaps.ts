import type { AccionDeAviso, CallNoticeTap } from '../../modules/llamada-entrante/src';

/** The taps that belong to a call; `chat` is a message notice and keeps its own pending. */
const CALL_ACTIONS: ReadonlySet<string> = new Set(['abrir', 'contestar', 'rechazar', 'colgar', 'answering']);

/**
 * Each call notice tap is applied ONCE (José 19/11). The native bridge keeps a tap as
 * «pending» for 40 s and also delivers it live; the provider read that pending copy on
 * every render, so a «Colgar» tapped for one call could hang up the next call to the same
 * chat. Now the pending copy is read only for a cold start, and a live tap consumes it.
 * PURE: the bridge's `accionPendiente` comes in.
 */
export function createNoticeTapInbox(takePending: () => AccionDeAviso | null) {
  let coldStartRead = false;
  return {
    /** The tap that opened the app cold: once per session, never on a re-render. */
    coldStart: (): AccionDeAviso | null => {
      if (coldStartRead) return null;
      coldStartRead = true;
      return takePending();
    },
    /** A tap delivered live: its pending copy goes, so no later read applies it again. */
    delivered: <T extends CallNoticeTap>(tap: T): T => {
      if (CALL_ACTIONS.has(tap.accion)) takePending();
      return tap;
    },
  };
}
