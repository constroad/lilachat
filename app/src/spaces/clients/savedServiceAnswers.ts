import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSavedAnswer, readServiceAsk, savedAnswerKey, SAVED_ANSWER_MAX_CHARS, serviceAskPath, shouldPrefetchDetail, isUnreachable, type SavedAnswer, type ServiceAskBody, type ServiceAskKind, type ServiceAskResult, type ServiceAskValue, type SpaceClientService } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import { spaceDiskKey } from '../spaceCache';
import type { ServiceAskTarget } from './useServiceAsk';

/**
 * The phone's copy of a service's detail (José 26/11, offline at the site).
 * Only `detail` and `files` are kept: what the field needs (orders, reports,
 * map, Drive); never the money asks (`account`, `billing`). The engine is `shared/savedServiceAnswer.ts`; here go the disk and
 * the request. Keys live under the space's cache prefix, so `forgetSpace` and
 * logout (`forgetAllSpaces`) remove them with the rest.
 */
export const KEPT_KINDS: ReadonlySet<ServiceAskKind> = new Set(['detail', 'files']);
/** How many details one visit to «Servicios» keeps ready, one after the other. */
const PREFETCH_MAX = 8;

const diskKeyOf = (target: ServiceAskTarget, kind: ServiceAskKind, serviceId: string) => spaceDiskKey(savedAnswerKey(target.spaceId, kind, target.clientId, serviceId));

export async function readSavedServiceAnswer<T>(target: ServiceAskTarget, kind: ServiceAskKind, serviceId: string): Promise<SavedAnswer<T> | null> {
  const raw = await AsyncStorage.getItem(diskKeyOf(target, kind, serviceId)).catch(() => null);
  return readSavedAnswer<T>(raw);
}

export function writeSavedServiceAnswer<T>(target: ServiceAskTarget, kind: ServiceAskKind, serviceId: string, saved: SavedAnswer<T>): void {
  const raw = JSON.stringify(saved);
  // Too big to keep whole: the screen still works online, it just won't open offline.
  if (raw.length > SAVED_ANSWER_MAX_CHARS) return;
  AsyncStorage.setItem(diskKeyOf(target, kind, serviceId), raw).catch(() => undefined);
}

export function dropSavedServiceAnswer(target: ServiceAskTarget, kind: ServiceAskKind, serviceId: string): void {
  AsyncStorage.removeItem(diskKeyOf(target, kind, serviceId)).catch(() => undefined);
}

/** One ask to the server, read as the screen reads it; `offline` when it never reached the server. */
export async function askService<K extends ServiceAskKind>(kind: K, target: ServiceAskTarget, serviceId: string): Promise<ServiceAskResult<ServiceAskValue<K>>> {
  const response = await jsonCall<ServiceAskBody>(`${BASE_URL}/api${serviceAskPath(target.spaceId, target.clientId, serviceId, kind)}`, target.jwt);
  const read = readServiceAsk(kind, response.ok ? response.data : { message: response.message });
  return !response.ok && !read.ok && isUnreachable(response) ? { ...read, offline: true } : read;
}

const prefetching = new Set<string>();

/**
 * Opening «Servicios» with signal keeps the open services' details on the
 * phone, so the next site without signal can pick any of them. One at a time,
 * capped, and skipping copies younger than 6 h: it must not load Portal.
 */
export async function prefetchServiceDetails(target: ServiceAskTarget, services: readonly SpaceClientService[]): Promise<void> {
  let asked = 0;
  for (const service of services) {
    if (asked >= PREFETCH_MAX) return;
    const key = diskKeyOf(target, 'detail', service.id);
    if (prefetching.has(key)) continue;
    const saved = await readSavedServiceAnswer(target, 'detail', service.id);
    if (!shouldPrefetchDetail({ status: service.status, savedAt: saved?.savedAt ?? null, now: Date.now() })) continue;
    prefetching.add(key);
    asked += 1;
    try {
      const fresh = await askService('detail', target, service.id);
      // Without signal the rest would fail too: stop and try on the next visit.
      if (!fresh.ok && fresh.offline) return;
      if (fresh.ok) writeSavedServiceAnswer(target, 'detail', service.id, { value: fresh.value, savedAt: Date.now() });
    } finally {
      prefetching.delete(key);
    }
  }
}
