/**
 * A call link opened on the web (pending 42: `/llamada/<token>`). On a phone
 * with the app, Android opens the app; here the token waits in this tab
 * through the sign-in, and then the call is offered.
 */
const KEY = 'lilachat.pendingCallLink';
const CALL_PATH = /^\/llamada\/([A-Za-z0-9_-]+)/;

export function catchCallLink(location: Pick<Location, 'pathname'> = window.location, history: Pick<History, 'replaceState'> = window.history): string | null {
  const token = CALL_PATH.exec(location.pathname)?.[1] ?? null;
  if (!token) return null;
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // Without storage the link is lost after the sign-in; it can be opened again.
  }
  history.replaceState(null, '', '/');
  return token;
}

export function peekPendingCallLink(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function takePendingCallLink(): string | null {
  const token = peekPendingCallLink();
  try {
    if (token) sessionStorage.removeItem(KEY);
  } catch {
    // Read once is enough: offering the call again is harmless.
  }
  return token;
}
