import { Router } from 'express';
import { asyncRoute, requireSession } from './requireSession.js';
import { coordsFromText, isShortMapsLink, PLACE_LINK_FAILED, PLACE_NOT_FOUND, PLACE_RESULTS_MAX, placeQueryOf, placeResultsOf, type PlaceAnswer, type PlaceResult, type WorkMapPoint } from '@lilachat/shared';

/**
 * «Buscar lugar o pegar enlace» over the work map (José 08/11, the same as Portal). Short links of
 * Google Maps are followed by their `Location` only, never fetched beyond, and only for their three
 * hosts: this is no proxy. Names go to Nominatim, like `placeName.ts`: free, little volume, so the
 * answers are remembered and each person has a budget.
 */
const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const CLIENT_NAME = 'lilachat/1.0 (work-map-search)';
const LINK_BUDGET_MS = 3500;
const SEARCH_BUDGET_MS = 3500;
const LINK_MEMORY_MS = 24 * 3_600_000;
const NAME_MEMORY_MS = 10 * 60_000;
const MEMORY_MAX = 500;
const HOPS_MAX = 3;
const PER_MINUTE = 20;
const MINUTE_MS = 60_000;
/** Half a degree around what is on screen: a city, for the bias; results outside still come. */
const VIEW_HALF_DEG = 0.25;
/** Every work is in Peru: «Plaza San Martín» is the one in Lima, never Buenos Aires or México (E2E 12/11). */
const WORK_COUNTRIES = 'pe';
const LINK_NAME = 'Ubicación del enlace';
const TOO_MANY = 'Muchas búsquedas seguidas. Espera un minuto.';

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

function memory<T>(now: () => number, keepMs: number) {
  const kept = new Map<string, { value: T; until: number }>();
  return {
    get: (key: string): T | undefined => { const hit = kept.get(key); return hit && hit.until > now() ? hit.value : undefined; },
    set: (key: string, value: T) => {
      kept.delete(key);
      kept.set(key, { value, until: now() + keepMs });
      if (kept.size > MEMORY_MAX) kept.delete(kept.keys().next().value!);
    },
  };
}

/** `/maps/place/Plaza+Dos+de+Mayo,+Lima/…` or `?q=Plaza…`: the name a link points at. */
function placeNameIn(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromPath = /\/maps\/place\/([^/]+)/.exec(parsed.pathname)?.[1];
    const name = fromPath ? decodeURIComponent(fromPath.replace(/\+/g, ' ')) : parsed.searchParams.get('q');
    return name?.trim() || null;
  } catch {
    // The Location was not a URL: nothing to read in it.
    return null;
  }
}

/** The long URL behind a short link, following only short links (at most three hops). */
async function longUrlOf(url: string, fetcher: Fetcher): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < HOPS_MAX; hop += 1) {
    const answer = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(LINK_BUDGET_MS), headers: { 'User-Agent': CLIENT_NAME } });
    const location = answer.headers.get('location');
    if (!location) return null;
    if (!isShortMapsLink(location)) return location;
    current = location;
  }
  return null;
}

async function askNominatim(text: string, near: WorkMapPoint | undefined, fetcher: Fetcher): Promise<PlaceResult[] | null> {
  const query = new URLSearchParams({ q: text, format: 'jsonv2', limit: String(PLACE_RESULTS_MAX), 'accept-language': 'es', countrycodes: WORK_COUNTRIES });
  if (near) {
    query.set('viewbox', [near.lng - VIEW_HALF_DEG, near.lat + VIEW_HALF_DEG, near.lng + VIEW_HALF_DEG, near.lat - VIEW_HALF_DEG].join(','));
    query.set('bounded', '0');
  }
  const answer = await fetcher(`${SEARCH_URL}?${query}`, { headers: { 'User-Agent': CLIENT_NAME }, signal: AbortSignal.timeout(SEARCH_BUDGET_MS) });
  return answer.ok ? placeResultsOf(await answer.json()) : null;
}

export function createPlaceSearch(deps: { fetcher?: Fetcher; now?: () => number } = {}) {
  const { fetcher = fetch, now = Date.now } = deps;
  const links = memory<string | null>(now, LINK_MEMORY_MS);
  const names = memory<PlaceResult[]>(now, NAME_MEMORY_MS);
  const asked = new Map<string, number[]>();
  const withinBudget = (who: string): boolean => {
    const recent = (asked.get(who) ?? []).filter((at) => now() - at < MINUTE_MS);
    if (recent.length >= PER_MINUTE) return false;
    asked.set(who, [...recent, now()]);
    return true;
  };
  const byName = async (text: string, near?: WorkMapPoint): Promise<PlaceAnswer> => {
    const key = `${text.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`;
    const known = names.get(key) ?? (await askNominatim(text, near, fetcher));
    if (!known) return { ok: false, message: PLACE_NOT_FOUND };
    names.set(key, known);
    return known.length ? { ok: true, results: known } : { ok: false, message: PLACE_NOT_FOUND };
  };
  const byLink = async (url: string, near?: WorkMapPoint): Promise<PlaceAnswer> => {
    const long = links.get(url) ?? (await longUrlOf(url, fetcher));
    if (!long) return { ok: false, message: PLACE_LINK_FAILED };
    links.set(url, long);
    const point = coordsFromText(long);
    if (point) return { ok: true, results: [{ name: LINK_NAME, ...point }] };
    const name = placeNameIn(long);
    return name ? byName(name, near) : { ok: false, message: PLACE_LINK_FAILED };
  };
  return async (raw: string, who: string, near?: WorkMapPoint): Promise<PlaceAnswer> => {
    const query = placeQueryOf(raw);
    if (query.kind === 'point') return { ok: true, results: [{ name: `${query.point.lat}, ${query.point.lng}`, ...query.point }] };
    if (query.kind === 'too_short') return { ok: false, message: PLACE_NOT_FOUND };
    if (!withinBudget(who)) return { ok: false, message: TOO_MANY };
    try {
      return query.kind === 'short_link' ? await byLink(query.url, near) : await byName(query.text, near);
    } catch (failure) {
      console.warn('[lugar] búsqueda sin respuesta:', failure instanceof Error ? failure.name : 'unknown');
      return { ok: false, message: query.kind === 'short_link' ? PLACE_LINK_FAILED : PLACE_NOT_FOUND };
    }
  };
}

const pointOf = (value: unknown): WorkMapPoint | undefined => {
  const { lat, lng } = (value ?? {}) as { lat?: unknown; lng?: unknown };
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
};

/** `POST /api/places { q, near? }`: only a person with a session searches; the budget is theirs. */
export function buildPlaceRouter(search = createPlaceSearch()): Router {
  const router = Router();
  router.use(requireSession);
  router.post('/', asyncRoute(async (req, res) => {
    const { q, near } = (req.body ?? {}) as { q?: unknown; near?: unknown };
    if (typeof q !== 'string') return res.status(400).json({ message: PLACE_NOT_FOUND });
    const answer = await search(q, String(req.session!.userId), pointOf(near));
    return answer.ok ? res.json({ results: answer.results }) : res.status(422).json({ message: answer.message });
  }));
  return router;
}
