import { Router } from 'express';
import { placeKeyOf, weatherLabelOf, type FieldConditions, type GeoPoint } from '@lilachat/shared';
import { asyncRoute, requireSession } from './requireSession.js';
import { placeNameOf } from './placeName.js';

/**
 * The street and the weather where the engineer stands, for a report's «Información de control»
 * (José 12/11: «el clima del distrito donde está el ing; el tramo, la calle del GPS»). Nominatim for
 * the street (as the signing's camera), Open-Meteo for the sky: both free and keyless. A nicety:
 * whatever fails comes back null and the person types it.
 */
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_BUDGET_MS = 3000;
const REMEMBER_MS = 15 * 60_000;
const MAX_PLACES = 500;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type Lookup = (point: GeoPoint) => Promise<string | null>;

async function askWeather(point: GeoPoint, fetcher: Fetcher): Promise<string | null> {
  const query = new URLSearchParams({ latitude: String(point.lat), longitude: String(point.lng), current: 'weather_code,temperature_2m', timezone: 'auto' });
  try {
    const reply = await fetcher(`${WEATHER_URL}?${query}`, { signal: AbortSignal.timeout(WEATHER_BUDGET_MS) });
    if (!reply.ok) return null;
    const current = ((await reply.json()) as { current?: { weather_code?: unknown; temperature_2m?: unknown } }).current;
    if (typeof current?.weather_code !== 'number') return null;
    return weatherLabelOf(current.weather_code, typeof current.temperature_2m === 'number' ? current.temperature_2m : undefined) || null;
  } catch (error) {
    console.warn('[clima] sin respuesta:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The weather of a block, asked once every quarter of an hour; a failure is not remembered. */
export function createWeatherLookup(deps: { fetcher?: Fetcher; now?: () => number } = {}): Lookup {
  const { fetcher = fetch, now = Date.now } = deps;
  const known = new Map<string, { label: string; until: number }>();
  return async (point) => {
    const key = placeKeyOf(point);
    const hit = known.get(key);
    if (hit && hit.until > now()) return hit.label;
    const label = await askWeather(point, fetcher);
    if (!label) return null;
    known.delete(key);
    known.set(key, { label, until: now() + REMEMBER_MS });
    if (known.size > MAX_PLACES) known.delete(known.keys().next().value!);
    return label;
  };
}

const LAT_LIMIT = 90;
const LNG_LIMIT = 180;
const pointOfQuery = (query: Record<string, unknown>): GeoPoint | null => {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > LAT_LIMIT || Math.abs(lng) > LNG_LIMIT) return null;
  return { lat, lng, precision: 0 };
};

/** `GET /api/field-conditions?lat=&lng=`: both asked at once, each null when it does not arrive. */
export function buildFieldConditionsRouter(deps: { street?: Lookup; weather?: Lookup } = {}): Router {
  const street = deps.street ?? placeNameOf;
  const weather = deps.weather ?? createWeatherLookup();
  const router = Router();
  router.use(requireSession);
  router.get('/', asyncRoute(async (req, res) => {
    const point = pointOfQuery(req.query);
    if (!point) return res.status(400).json({ message: 'Falta la ubicación.' });
    const [place, sky] = await Promise.all([street(point), weather(point)]);
    const answer: FieldConditions = { street: place, weather: sky };
    return res.set('Cache-Control', 'no-store').json(answer);
  }));
  return router;
}
