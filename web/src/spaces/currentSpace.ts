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

/** My spaces, shared by the rail, the header and the switcher. */
export function useMySpaces(jwt: string): { spaces: ClientWorkspace[] | null; reload: () => Promise<void> } {
  const current = useSyncExternalStore(subscribe, () => spaces);
  const reload = useCallback(async () => {
    if (!jwt) return;
    const turn = ++latestRequest;
    const response = await mySpaces(jwt);
    if (!response.ok || turn !== latestRequest) return;
    spaces = response.data.workspaces;
    notify();
  }, [jwt]);
  useEffect(() => {
    if (spaces === null) void reload();
  }, [reload]);
  return { spaces: current, reload };
}
