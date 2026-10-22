import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ClientWorkspace } from '@lilachat/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/**
 * The spaces this phone last saw, per person (22/10): with a space chosen,
 * its list paints at once instead of the personal one and then the space.
 * Another person signing in here sees none of them; logout erases them.
 */
const SAVED_SPACES_KEY = 'lilachat:my-spaces';
/** Whether this run already asked the server: what came from the phone still gets confirmed. */
let askedThisRun = false;
const announce = () => listeners.forEach((listener) => listener());

async function restoreSaved(userId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(SAVED_SPACES_KEY).catch(() => null);
  if (!raw || spaces !== null) return;
  try {
    const saved = JSON.parse(raw) as { userId?: string; spaces?: ClientWorkspace[] };
    if (saved.userId !== userId || !Array.isArray(saved.spaces) || spaces !== null) return;
    spaces = saved.spaces;
    announce();
  } catch {
    // A broken copy is just not used: the server answers anyway.
  }
}

export async function forgetMySpaces(): Promise<void> {
  spaces = null;
  askedThisRun = false;
  latestRequest += 1;
  announce();
  await AsyncStorage.removeItem(SAVED_SPACES_KEY).catch(() => undefined);
}

export function useMySpaces(jwt: string, userId?: string): { spaces: ClientWorkspace[] | null; reload: () => Promise<void> } {
  const current = useSyncExternalStore(subscribe, () => spaces);
  const reload = useCallback(async () => {
    const turn = ++latestRequest;
    askedThisRun = true;
    const response = await mySpaces(jwt);
    if (!response.ok || turn !== latestRequest) return;
    spaces = response.data.workspaces;
    if (userId) AsyncStorage.setItem(SAVED_SPACES_KEY, JSON.stringify({ userId, spaces })).catch(() => undefined);
    announce();
  }, [jwt, userId]);
  useEffect(() => {
    if (userId && spaces === null) void restoreSaved(userId);
    if (!askedThisRun) void reload();
  }, [reload, userId]);
  return { spaces: current, reload };
}
