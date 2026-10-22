import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSessionCache, type ActivityItem, type ActivityType, type CacheEntry, type ClientChannel, type ClientWorkspaceMember, type SessionCache } from '@lilachat/shared';
import type { JsonResult } from '../api/jsonCall';
import { spaceActivity, spaceChannels, spaceMembers } from './spacesApi';

/**
 * What a company space's screens already saw, painted at once and refreshed
 * behind (José, 22/10: Directorio, Menciones, Canales and Miembros showed
 * «cargando» each time). The engine is `shared/sessionCache.ts`; here go the
 * phone's disk (AsyncStorage, writes gathered per key), the prefetch when a
 * space opens, and forgetting a space (logout, or access removed: its
 * directory must not stay on the phone). Keys are `<spaceId>:<what>`.
 */
const MAX_AGE_MS = 30_000;
const DISK_PREFIX = 'lilachat:space-cache:';
const SAVE_DELAY_MS = 800;

export type ActivityPage = { items: ActivityItem[]; unread: { mentions: number; threads: number } };
export type MemberLists = Record<'active' | 'pending' | 'invited' | 'deactivated', ClientWorkspaceMember[]>;

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function saveLater(key: string, value: unknown, fetchedAt: number): void {
  const timer = saveTimers.get(key);
  if (timer) clearTimeout(timer);
  saveTimers.set(key, setTimeout(() => {
    saveTimers.delete(key);
    AsyncStorage.setItem(`${DISK_PREFIX}${key}`, JSON.stringify({ value, fetchedAt })).catch(() => undefined);
  }, SAVE_DELAY_MS));
}

const cacheOf = <T,>() => createSessionCache<T>({ maxAgeMs: MAX_AGE_MS, onSave: saveLater });
export const membersCache = cacheOf<ClientWorkspaceMember[]>();
export const memberListsCache = cacheOf<MemberLists>();
export const activityCache = cacheOf<ActivityPage>();
export const channelsCache = cacheOf<ClientChannel[]>();
const ALL: SessionCache<unknown>[] = [membersCache, memberListsCache, activityCache, channelsCache] as SessionCache<unknown>[];

/** A refusal becomes an error the cache keeps apart from what it shows. */
export function dataOf<T>(response: JsonResult<T>, fallback: string): T {
  if (!response.ok) throw new Error(response.message ?? fallback);
  return response.data;
}

export const fetchMembers = (jwt: string, spaceId: string) => async () => dataOf(await spaceMembers(jwt, spaceId), 'No se pudo cargar el directorio.').members;
export const fetchChannels = (jwt: string, spaceId: string) => async () => dataOf(await spaceChannels(jwt, spaceId), 'No se pudieron cargar los canales.').channels;
export const fetchActivity = (jwt: string, spaceId: string, type: ActivityType) => async () => dataOf(await spaceActivity(jwt, spaceId, { type }), 'No se pudo cargar la actividad.');

const fromDisk = new Set<string>();
async function hydrateFromDisk<T>(cache: SessionCache<T>, key: string): Promise<void> {
  if (fromDisk.has(key)) return;
  fromDisk.add(key);
  const raw = await AsyncStorage.getItem(`${DISK_PREFIX}${key}`).catch(() => null);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as { value: T; fetchedAt: number };
    cache.hydrate(key, saved.value, saved.fetchedAt);
  } catch {
    // A broken copy on disk is just not used: the server answers anyway.
    AsyncStorage.removeItem(`${DISK_PREFIX}${key}`).catch(() => undefined);
  }
}

const NONE: CacheEntry<never> = Object.freeze({ loading: false });

/** The screen's data: what is cached at once, refreshed behind when old; `refresh` asks again now. */
export function useCached<T>(cache: SessionCache<T>, key: string | null, fetcher: () => Promise<T>, active = true): CacheEntry<T> & { refresh: () => void } {
  const latest = useRef(fetcher);
  latest.current = fetcher;
  const subscribe = useCallback((listener: () => void) => (key ? cache.subscribe(key, listener) : () => undefined), [cache, key]);
  const entry = useSyncExternalStore(subscribe, () => (key ? cache.get(key) : (NONE as CacheEntry<T>)));
  useEffect(() => {
    if (!key || !active) return;
    void hydrateFromDisk(cache, key).then(() => cache.revalidate(key, () => latest.current()));
  }, [cache, key, active]);
  const refresh = useCallback(() => {
    if (key) void cache.revalidate(key, () => latest.current(), { force: true });
  }, [cache, key]);
  return { ...entry, refresh };
}

/** Entering a space: its directory, mentions and channels are asked for once the screen is drawn. */
export function prefetchSpace(jwt: string, spaceId: string): void {
  InteractionManager.runAfterInteractions(() => {
    void hydrateFromDisk(membersCache, `${spaceId}:members`).then(() => membersCache.revalidate(`${spaceId}:members`, fetchMembers(jwt, spaceId)));
    void hydrateFromDisk(activityCache, `${spaceId}:activity:mentions`).then(() => activityCache.revalidate(`${spaceId}:activity:mentions`, fetchActivity(jwt, spaceId, 'mentions')));
    void hydrateFromDisk(channelsCache, `${spaceId}:channels`).then(() => channelsCache.revalidate(`${spaceId}:channels`, fetchChannels(jwt, spaceId)));
  });
}

async function removeFromDisk(prefix: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((key) => key.startsWith(`${DISK_PREFIX}${prefix}`));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
}

/** Access removed or the space left: nothing of it stays, in memory or on disk. */
export function forgetSpace(spaceId: string): void {
  for (const cache of ALL) cache.drop(`${spaceId}:`);
  for (const key of [...fromDisk]) if (key.startsWith(`${spaceId}:`)) fromDisk.delete(key);
  void removeFromDisk(`${spaceId}:`);
}

/** Logout: whoever signs in next on this phone inherits no space. */
export async function forgetAllSpaces(): Promise<void> {
  for (const cache of ALL) cache.clear();
  fromDisk.clear();
  await removeFromDisk('');
}
