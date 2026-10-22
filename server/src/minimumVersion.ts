import type { RequestHandler } from 'express';

/**
 * The server turns away an app below the minimum version (backlog 32). The
 * app's own lock screen (§97) is skipped by an old build that never had it, so
 * the server has to say no too: 426, which the app reads as «update».
 *
 * - The minimum is the one José sets in LilaStore when publishing (never
 *   automatic); it is read from there and kept for a while.
 * - The app sends its build (`x-lilachat-build`, and `build` in the socket's
 *   auth) since 0.1.144. Only a request that says its build is judged: an app
 *   from before is not guessed by its `okhttp` user agent, because the new app
 *   also has paths without the header (media and backup downloads) and the
 *   guess would lock out a current phone.
 * - The web, bots and scripts never send it: the web reloads itself on a new
 *   version, and the rest are not the app.
 * - Without an answer from LilaStore the last known minimum stays; with none,
 *   nobody is turned away (an outage must not lock everyone out).
 */
export const BUILD_HEADER = 'x-lilachat-build';
const STORE_MIN_VERSION_URL = 'https://lilastore.constroad.com/api/v1/apps/lilachat/min-version';
const STORE_TIMEOUT_MS = 8_000;
const MINIMUM_MAX_AGE_MS = 10 * 60_000;
/** Paths an old app may still reach: its crash reports are how a broken old build gets noticed. */
const ALWAYS_OPEN = ['/crash', '/health'];

export type ClientIdentity = { build?: string | string[] };

function buildOf(client: ClientIdentity): number | null {
  const raw = Array.isArray(client.build) ? client.build[0] : client.build;
  if (raw === undefined) return null;
  const build = Number(raw);
  return Number.isInteger(build) && build > 0 ? build : null;
}

export function appBelowMinimum(client: ClientIdentity, minimum: number): boolean {
  if (minimum <= 0) return false;
  const build = buildOf(client);
  return build !== null && build < minimum;
}

export type MinimumSource = { current: () => number; refresh: () => void };

export function createMinimumSource(options: { fetchMinimum: () => Promise<number>; maxAgeMs: number; now?: () => number }): MinimumSource {
  const now = options.now ?? Date.now;
  let minimum = 0;
  let askedAt: number | null = null;
  return {
    current: () => minimum,
    refresh() {
      if (askedAt !== null && now() - askedAt < options.maxAgeMs) return;
      askedAt = now();
      options.fetchMinimum().then(
        (value) => {
          minimum = value;
        },
        (error: unknown) => console.warn('[min-version] LilaStore no respondió; queda la mínima anterior:', error instanceof Error ? error.message : error)
      );
    },
  };
}

async function fetchStoreMinimum(): Promise<number> {
  const response = await fetch(STORE_MIN_VERSION_URL, { signal: AbortSignal.timeout(STORE_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`LilaStore ${response.status}`);
  const body = (await response.json()) as { minVersionCode?: unknown };
  return typeof body.minVersionCode === 'number' ? body.minVersionCode : 0;
}

export const lilaStoreMinimum = (): MinimumSource => createMinimumSource({ fetchMinimum: fetchStoreMinimum, maxAgeMs: MINIMUM_MAX_AGE_MS });

export const UPDATE_REQUIRED_MESSAGE = 'Actualiza Lilachat para seguir usándola.';

/** Mounted on `/api`: an old app gets 426 and the minimum it needs. */
export function requireMinimumBuild(source: MinimumSource): RequestHandler {
  return (req, res, next) => {
    source.refresh();
    if (ALWAYS_OPEN.some((path) => req.path.startsWith(path))) return next();
    const minimum = source.current();
    if (!appBelowMinimum({ build: req.headers[BUILD_HEADER] }, minimum)) return next();
    res.status(426).json({ message: UPDATE_REQUIRED_MESSAGE, code: 'update_required', minVersionCode: minimum });
  };
}
