import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ClientWorkspace } from '@lilachat/shared';
import { createPrefStore } from '../ui/prefStore';
import { mySpaces } from './spacesApi';

/** Which space the Chats tab shows (E1): `null` is the personal account. Remembered on the device. */
const currentSpaceStore = createPrefStore<string | null>('lilachat.pref.space', (stored) => stored || null, null, (value) => value ?? '');
export const useCurrentSpaceId = currentSpaceStore.use;
export const setCurrentSpaceId = currentSpaceStore.set;

/** My spaces, shared by the header and the switcher; asked again when the switcher opens. */
let spaces: ClientWorkspace[] | null = null;
/** Only the latest request writes: an older answer arriving late would bring back a list without a space just created. */
let latestRequest = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useMySpaces(jwt: string): { spaces: ClientWorkspace[] | null; reload: () => Promise<void> } {
  const current = useSyncExternalStore(subscribe, () => spaces);
  const reload = useCallback(async () => {
    const turn = ++latestRequest;
    const response = await mySpaces(jwt);
    if (!response.ok || turn !== latestRequest) return;
    spaces = response.data.workspaces;
    listeners.forEach((listener) => listener());
  }, [jwt]);
  useEffect(() => {
    if (spaces === null) void reload();
  }, [reload]);
  return { spaces: current, reload };
}
