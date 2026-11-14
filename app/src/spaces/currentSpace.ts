import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { withoutClosedIncognito, workspacesOf, type ClientWorkspace } from '@lilachat/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPrefStore } from '../ui/prefStore';
import { mySpaces } from './spacesApi';

/** Which space the Chats tab shows (E1): `null` is the personal account. Remembered on the device. */
const currentSpaceStore = createPrefStore<string | null>('lilachat.pref.space', (stored) => stored || null, null, (value) => value ?? '');
export const useCurrentSpaceId = currentSpaceStore.use;
/** The space the Chats tab shows right now, outside React (what «Compartir en» lists first). */
export const getCurrentSpaceId = currentSpaceStore.get;

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

/** Changing the open space; leaving an incognito one takes it out of the switcher at once (José 13/11). */
export function setCurrentSpaceId(spaceId: string | null): void {
  currentSpaceStore.set(spaceId);
  if (!spaces) return;
  const kept = withoutClosedIncognito(spaces, spaceId);
  if (kept === spaces) return;
  spaces = kept;
  announce();
}

async function restoreSaved(userId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(SAVED_SPACES_KEY).catch(() => null);
  if (!raw || spaces !== null) return;
  try {
    const saved = JSON.parse(raw) as { userId?: string; spaces?: ClientWorkspace[] };
    if (saved.userId !== userId || !Array.isArray(saved.spaces) || spaces !== null) return;
    // The open space is read from the phone too: without waiting, an incognito space entered before closing the app would look closed.
    const open = await currentSpaceStore.ready();
    if (spaces !== null) return;
    spaces = withoutClosedIncognito(saved.spaces, open);
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

export function useMySpaces(jwt: string, userId?: string): { spaces: ClientWorkspace[] | null; reload: (openId?: string | null) => Promise<void> } {
  const current = useSyncExternalStore(subscribe, () => spaces);
  // `openId`: the space about to open, so a hidden one entered from Ajustes is in the answer (José 13/11).
  const reload = useCallback(async (openId?: string | null) => {
    const turn = ++latestRequest;
    askedThisRun = true;
    const response = await mySpaces(jwt, openId ?? (await currentSpaceStore.ready()));
    const list = response.ok ? workspacesOf(response.data) : null;
    if (!list || turn !== latestRequest) return;
    spaces = list;
    if (userId) AsyncStorage.setItem(SAVED_SPACES_KEY, JSON.stringify({ userId, spaces })).catch(() => undefined);
    announce();
  }, [jwt, userId]);
  useEffect(() => {
    if (userId && spaces === null) void restoreSaved(userId);
    if (!askedThisRun) void reload();
  }, [reload, userId]);
  return { spaces: current, reload };
}

/** A space's name from the spaces already read (the head of a 1:1 with an app says where it lives). */
export function useSpaceName(spaceId: string | undefined): string {
  const current = useSyncExternalStore(subscribe, () => spaces);
  return current?.find((space) => space.id === spaceId)?.name ?? '';
}

/** A space's logo from the spaces already read: the report camera's stamp shows it (José 12/11). */
export function useSpaceLogo(spaceId: string | null | undefined): string | null {
  const current = useSyncExternalStore(subscribe, () => spaces);
  return current?.find((space) => space.id === spaceId)?.logoUrl ?? null;
}
