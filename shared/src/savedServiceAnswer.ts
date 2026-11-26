import type { ClientServiceStatus } from './clientChannels.js';
import type { ServiceAskKind, ServiceAskResult } from './serviceAsk.js';
import { dayAndTimeOf } from './serviceDetail.js';

/**
 * A service's answer kept on the phone, so a site without signal still opens
 * the service (José 26/11, Aucallama: «no me cargaba los chats ni servicios»).
 * It replaces the 30/10 rule «the detail is never stored»: the copy is only
 * what the server already sent THIS person (money is stripped server side for
 * whoever does not see it), it lives under the space's cache prefix so leaving
 * the space or logging out drops it, and any refusal from the server deletes it.
 * PURE.
 */
export type SavedAnswer<T> = { value: T; savedAt: number };

/** What the screen shows: a fresh answer, or a saved copy with `savedAt` (and `offline` when the refresh failed). */
export type ShownServiceAnswer<T> = ServiceAskResult<T> | { ok: true; value: T; savedAt: number; offline?: true };

/** A copy younger than this is not asked again just to have it offline. */
export const DETAIL_PREFETCH_MAX_AGE_MS = 6 * 3_600_000;
/** Bigger copies are not written: AsyncStorage reads and writes a value whole. */
export const SAVED_ANSWER_MAX_CHARS = 1_500_000;

const OPEN_STATUSES: ReadonlySet<ClientServiceStatus> = new Set(['pending', 'in_progress']);

/** Under `<spaceId>:` like the rest of the space cache: `forgetSpace` and logout take it too. */
export const savedAnswerKey = (spaceId: string, kind: ServiceAskKind, clientId: string, serviceId: string): string =>
  `${spaceId}:service-${kind}:${clientId}:${serviceId}`;

/** The first paint: the saved copy at once, or `null` (loading) without one. */
export function firstShownAnswer<T>(saved: SavedAnswer<T> | null): ShownServiceAnswer<T> | null {
  return saved ? { ok: true, value: saved.value, savedAt: saved.savedAt } : null;
}

export type SettledAnswer<T> = { shown: ShownServiceAnswer<T>; write: SavedAnswer<T> | null; drop: boolean };

/**
 * The server's answer against the copy: fresh wins and is written; without
 * signal the copy stays on screen; a refusal (no access, not found, Portal's
 * own message) wins and deletes the copy, so lost access never lingers here.
 */
export function settleServiceAnswer<T>(fresh: ServiceAskResult<T>, saved: SavedAnswer<T> | null, now: number): SettledAnswer<T> {
  if (fresh.ok) return { shown: fresh, write: { value: fresh.value, savedAt: now }, drop: false };
  if (fresh.offline) return { shown: saved ? { ok: true, value: saved.value, savedAt: saved.savedAt, offline: true } : fresh, write: null, drop: false };
  return { shown: fresh, write: null, drop: saved !== null };
}

/** A copy read from disk, or `null` when missing or broken (never throws). */
export function readSavedAnswer<T>(raw: string | null): SavedAnswer<T> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const { value, savedAt } = parsed as { value?: unknown; savedAt?: unknown };
    if (typeof savedAt !== 'number' || !value || typeof value !== 'object') return null;
    return { value: value as T, savedAt };
  } catch {
    return null;
  }
}

/** Open services are kept ready for the field; closed ones and fresh copies are not asked again. */
export function shouldPrefetchDetail(input: { status: ClientServiceStatus; savedAt: number | null; now: number }): boolean {
  if (!OPEN_STATUSES.has(input.status)) return false;
  return input.savedAt === null || input.now - input.savedAt > DETAIL_PREFETCH_MAX_AGE_MS;
}

/** The line over a saved copy: offline says why it is old; otherwise it is being refreshed behind. */
export function savedAnswerLine(shown: { savedAt: number; offline?: true }): string {
  const when = dayAndTimeOf(new Date(shown.savedAt).toISOString());
  return shown.offline ? `Sin señal · datos guardados el ${when}` : `Datos guardados el ${when} · actualizando…`;
}
