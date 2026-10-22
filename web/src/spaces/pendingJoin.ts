import { normalizeJoinCode } from '@lilachat/shared';

/**
 * A join link opened on the web (pending 47, José 22/10: `/unirse/<code>`).
 * On a phone with the app, Android opens the app instead; here the code waits
 * in this tab through the sign-in, and then «Unirme a un espacio» opens with
 * it already written.
 */
const KEY = 'lilachat.pendingJoin';
const JOIN_PATH = /^\/unirse\/([^/?#]+)/;

export function catchJoinLink(location: Pick<Location, 'pathname'> = window.location, history: Pick<History, 'replaceState'> = window.history): string | null {
  const match = JOIN_PATH.exec(location.pathname);
  const code = match ? normalizeJoinCode(decodeURIComponent(match[1]!)) : null;
  if (!code) return null;
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Without storage the code is lost after the sign-in; the person can still type it.
  }
  history.replaceState(null, '', '/');
  return code;
}

export function peekPendingJoin(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function takePendingJoin(): string | null {
  const code = peekPendingJoin();
  try {
    if (code) sessionStorage.removeItem(KEY);
  } catch {
    // Read once is enough: a dialog that opens again is harmless.
  }
  return code;
}
