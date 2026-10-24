import { appReturnFromLink } from '@lilachat/shared';

/**
 * Back from agentes after installing an app (José, 23/10, like Slack and
 * Bitbucket: the web only signs in and authorizes). `/s/<space>/apps/<client_id>`
 * waits in this tab through the sign-in; then that space opens on the app's detail.
 * With `/chat` at the end (pending 49) it opens the 1:1 with the app instead.
 */
type AppReturn = { spaceId: string; clientId: string; chat?: true };
const KEY = 'lilachat.pendingAppReturn';

export function catchAppReturn(location: Pick<Location, 'pathname'> = window.location, history: Pick<History, 'replaceState'> = window.history): AppReturn | null {
  const caught = appReturnFromLink(location.pathname);
  if (!caught) return null;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(caught));
  } catch {
    // Without storage the return is lost after the sign-in; the app is installed anyway.
  }
  history.replaceState(null, '', '/');
  return caught;
}

export function peekPendingAppReturn(): AppReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<AppReturn>;
    // Read back through the same check: a value edited by hand is not trusted.
    return appReturnFromLink(`/s/${saved.spaceId}/apps/${saved.clientId}${saved.chat ? '/chat' : ''}`);
  } catch {
    return null;
  }
}

export function takePendingAppReturn(): AppReturn | null {
  const caught = peekPendingAppReturn();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Read once is enough: opening the detail again is harmless.
  }
  return caught;
}
