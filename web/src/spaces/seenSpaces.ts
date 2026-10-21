/**
 * The spaces whose «te agregaron» (design `e1-13`) was already shown in this
 * browser. `null` = never written: the first list seeds it, so the spaces the
 * person already had are not greeted.
 */
const SEEN_KEY = 'lilachat.espacios-vistos';

export function readSeenSpaces(): string[] | null {
  try {
    const stored = localStorage.getItem(SEEN_KEY);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return null;
  }
}

export function markSpacesSeen(ids: readonly string[]): string[] {
  const next = [...new Set([...(readSeenSpaces() ?? []), ...ids])];
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: the welcome may show again next time, nothing breaks.
  }
  return next;
}
