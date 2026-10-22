import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ClientWorkspace } from '@lilachat/shared';
import { mySpaces } from './spacesApi';

/** Which space the list shows (E1): `null` is the personal account. Remembered in this browser. */
const CURRENT_SPACE_KEY = 'lilachat.espacio';

const readStored = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_SPACE_KEY) || null;
  } catch {
    return null;
  }
};

let currentId: string | null = readStored();
let spaces: ClientWorkspace[] | null = null;
/** Only the latest request writes: an older answer arriving late would bring back a list without a space just created. */
let latestRequest = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useCurrentSpaceId = () => useSyncExternalStore(subscribe, () => currentId);

export function setCurrentSpaceId(spaceId: string | null): void {
  currentId = spaceId;
  try {
    if (spaceId) localStorage.setItem(CURRENT_SPACE_KEY, spaceId);
    else localStorage.removeItem(CURRENT_SPACE_KEY);
  } catch {
    // Private window or blocked storage: the space stays chosen until the tab closes.
  }
  notify();
}

/**
 * The spaces this browser last saw, per person (22/10): with a space chosen,
 * its list paints in the first frame instead of the personal one and then the
 * space. Another person signing in here sees none of them.
 */
const SAVED_SPACES_KEY = 'lilachat.espacios';
function readSavedSpaces(userId: string): ClientWorkspace[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_SPACES_KEY) ?? 'null') as { userId?: string; spaces?: ClientWorkspace[] } | null;
    return saved?.userId === userId && Array.isArray(saved.spaces) ? saved.spaces : null;
  } catch {
    return null;
  }
}
function saveSpaces(userId: string, list: ClientWorkspace[]): void {
  try {
    localStorage.setItem(SAVED_SPACES_KEY, JSON.stringify({ userId, spaces: list }));
  } catch {
    // Blocked storage: the list lives until the tab closes.
  }
}
/** Whether this tab already asked the server: what came from storage still gets confirmed. */
let askedThisSession = false;

/** Logout: memory and storage forget the spaces. */
export function forgetMySpaces(): void {
  spaces = null;
  askedThisSession = false;
  latestRequest += 1;
  try {
    localStorage.removeItem(SAVED_SPACES_KEY);
  } catch {
    // Nothing to remove.
  }
  notify();
}

/** My spaces, shared by the rail, the header and the switcher. */
export function useMySpaces(jwt: string, userId?: string): { spaces: ClientWorkspace[] | null; reload: () => Promise<void> } {
  // The first frame paints what this browser saw (a lazy, idempotent start of the module's list).
  if (spaces === null && userId) spaces = readSavedSpaces(userId);
  const current = useSyncExternalStore(subscribe, () => spaces);
  const reload = useCallback(async () => {
    if (!jwt) return;
    const turn = ++latestRequest;
    askedThisSession = true;
    const response = await mySpaces(jwt);
    if (!response.ok || turn !== latestRequest) return;
    spaces = response.data.workspaces;
    if (userId) saveSpaces(userId, spaces);
    notify();
  }, [jwt, userId]);
  useEffect(() => {
    if (!askedThisSession) void reload();
  }, [reload]);
  return { spaces: current, reload };
}
