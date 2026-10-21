import { createPrefStore } from '../ui/prefStore';

/**
 * The spaces whose «te agregaron» (design `e1-13`) was already shown on this
 * phone. `undefined` = not read from the phone yet (wait); `null` = never
 * written: the first list seeds it, so updating the app does not greet spaces
 * the person already had.
 */
const seenStore = createPrefStore<string[] | null | undefined>(
  'lilachat.pref.seenSpaces',
  (stored) => {
    if (stored === null) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  },
  undefined,
  (value) => JSON.stringify(value ?? [])
);
export const useSeenSpaces = seenStore.use;
export const markSpacesSeen = (ids: readonly string[]) => seenStore.set([...new Set([...(seenStore.get() ?? []), ...ids])]);
