import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { withLiveUnread, withoutClosedIncognito, workspacesOf, type ClientWorkspace } from '@lilachat/shared';
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

/** The open space's logo from the spaces already read: the camera shows it top right (José 13/11). */
export function useCurrentSpaceLogo(): string | null {
  const id = useSyncExternalStore(subscribe, () => currentId);
  const list = useSyncExternalStore(subscribe, () => spaces);
  return list?.find((space) => space.id === id)?.logoUrl ?? null;
}

export function setCurrentSpaceId(spaceId: string | null): void {
  currentId = spaceId;
  // Leaving an incognito space takes it out of the switcher at once (José 13/11).
  if (spaces) spaces = withoutClosedIncognito(spaces, spaceId);
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
    return saved?.userId === userId && Array.isArray(saved.spaces) ? withoutClosedIncognito(saved.spaces, currentId) : null;
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

/**
 * The count a space's live list shows becomes the space's count (José 11/11):
 * the server's list is from before reading, so a space read and then left
 * kept its old badge on the rail. No change, no notify.
 */
export function keepLiveUnread(spaceId: string, chats: readonly { unread: number }[], userId?: string): void {
  const next = withLiveUnread(spaces, spaceId, chats);
  if (!next || next === spaces) return;
  spaces = next;
  if (userId) saveSpaces(userId, next);
  notify();
}

/** My spaces, shared by the rail, the header and the switcher. */
export function useMySpaces(jwt: string, userId?: string): { spaces: ClientWorkspace[] | null; reload: (openId?: string | null) => Promise<void> } {
  // The first frame paints what this browser saw (a lazy, idempotent start of the module's list).
  if (spaces === null && userId) spaces = readSavedSpaces(userId);
  const current = useSyncExternalStore(subscribe, () => spaces);
  // `openId`: the space about to open, so a hidden one entered from Ajustes is in the answer (José 13/11).
  const reload = useCallback(async (openId?: string | null) => {
    if (!jwt) return;
    const turn = ++latestRequest;
    askedThisSession = true;
    const response = await mySpaces(jwt, openId ?? currentId);
    const list = response.ok ? workspacesOf(response.data) : null;
    if (!list || turn !== latestRequest) return;
    spaces = list;
    if (userId) saveSpaces(userId, spaces);
    notify();
  }, [jwt, userId]);
  useEffect(() => {
    if (!askedThisSession) void reload();
  }, [reload]);
  return { spaces: current, reload };
}
