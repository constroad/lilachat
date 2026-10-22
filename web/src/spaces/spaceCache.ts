import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createSessionCache, type ActivityItem, type ActivityType, type CacheEntry, type ClientChannel, type ClientWorkspaceMember, type SessionCache } from '@lilachat/shared';
import type { ApiResult } from '../api';
import type { BaseLocal } from '../local/baseLocal';
import { spaceActivity, spaceChannels, spaceMembers } from './spacesApi';

/**
 * What a company space's screens already saw, painted at once and refreshed
 * behind (José, 22/10: Directorio, Menciones, Canales and Miembros showed
 * «cargando» each time). The engine is `shared/sessionCache.ts`; here go the
 * browser's disk (the session's IndexedDB `meta` table, deleted with the
 * logout), the prefetch when a space opens, and forgetting a space whose
 * access was removed. Keys are `<spaceId>:<what>`.
 */
const MAX_AGE_MS = 30_000;
const DISK_PREFIX = 'space-cache:';
const SAVE_DELAY_MS = 800;

export type ActivityPage = { items: ActivityItem[]; unread: { mentions: number; threads: number } };
export type MemberLists = Record<'active' | 'pending' | 'invited' | 'deactivated', ClientWorkspaceMember[]>;

let disk: BaseLocal | null = null;
/** The signed-in person's local base (`Shell`): without it the cache lives only in memory. */
export function setSpaceCacheDisk(base: BaseLocal | null): void {
  disk = base;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function saveLater(key: string, value: unknown, fetchedAt: number): void {
  const timer = saveTimers.get(key);
  if (timer) clearTimeout(timer);
  saveTimers.set(key, setTimeout(() => {
    saveTimers.delete(key);
    void disk?.meta.put({ clave: `${DISK_PREFIX}${key}`, valor: { value, fetchedAt } }).catch(() => undefined);
  }, SAVE_DELAY_MS));
}

const cacheOf = <T,>() => createSessionCache<T>({ maxAgeMs: MAX_AGE_MS, onSave: saveLater });
export const membersCache = cacheOf<ClientWorkspaceMember[]>();
export const memberListsCache = cacheOf<MemberLists>();
export const activityCache = cacheOf<ActivityPage>();
export const channelsCache = cacheOf<ClientChannel[]>();
const ALL: SessionCache<unknown>[] = [membersCache, memberListsCache, activityCache, channelsCache] as SessionCache<unknown>[];

/** A refusal becomes an error the cache keeps apart from what it shows. */
export function dataOf<T>(response: ApiResult<T>): T {
  if (!response.ok) throw new Error(response.message);
  return response.data;
}

export const fetchMembers = (jwt: string, spaceId: string) => async () => dataOf(await spaceMembers(jwt, spaceId)).members;
export const fetchChannels = (jwt: string, spaceId: string) => async () => dataOf(await spaceChannels(jwt, spaceId)).channels;
export const fetchActivity = (jwt: string, spaceId: string, type: ActivityType) => async () => dataOf(await spaceActivity(jwt, spaceId, { type }));

const fromDisk = new Set<string>();
async function hydrateFromDisk<T>(cache: SessionCache<T>, key: string): Promise<void> {
  if (fromDisk.has(key) || !disk) return;
  fromDisk.add(key);
  const row = await disk.meta.get(`${DISK_PREFIX}${key}`).catch(() => undefined);
  const saved = row?.valor as { value?: T; fetchedAt?: number } | undefined;
  if (saved?.value !== undefined && typeof saved.fetchedAt === 'number') cache.hydrate(key, saved.value, saved.fetchedAt);
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

const whenIdle = (work: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(work) : window.setTimeout(work, 1));

/** Entering a space: its directory, mentions and channels are asked for once the screen is drawn. */
export function prefetchSpace(jwt: string, spaceId: string): void {
  whenIdle(() => {
    void hydrateFromDisk(membersCache, `${spaceId}:members`).then(() => membersCache.revalidate(`${spaceId}:members`, fetchMembers(jwt, spaceId)));
    void hydrateFromDisk(activityCache, `${spaceId}:activity:mentions`).then(() => activityCache.revalidate(`${spaceId}:activity:mentions`, fetchActivity(jwt, spaceId, 'mentions')));
    void hydrateFromDisk(channelsCache, `${spaceId}:channels`).then(() => channelsCache.revalidate(`${spaceId}:channels`, fetchChannels(jwt, spaceId)));
  });
}

/** Access removed or the space left: nothing of it stays, in memory or on disk. */
export function forgetSpace(spaceId: string): void {
  for (const cache of ALL) cache.drop(`${spaceId}:`);
  for (const key of [...fromDisk]) if (key.startsWith(`${spaceId}:`)) fromDisk.delete(key);
  void disk?.meta.where('clave').startsWith(`${DISK_PREFIX}${spaceId}:`).delete().catch(() => undefined);
}

/** Another person signs in on this browser: memory starts empty (their base is another one). */
export function forgetAllSpaces(): void {
  for (const cache of ALL) cache.clear();
  fromDisk.clear();
}
