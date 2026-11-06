import { placeKeyOf, type GeoPoint } from '@lilachat/shared';

/**
 * The address of a reading, for a signing's camera and its stamp (José 06/11:
 * «se muestran coordenadas en la cámara, ¿por qué?»). Nominatim, like Portal: free,
 * one request per second at most, so a block is asked once and remembered. It
 * is a nicety on top of the evidence: when it fails, the coordinates stay.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CLIENT_NAME = 'lilachat/1.0 (reverse-geocode)';
const LOOKUP_BUDGET_MS = 3200;
const REMEMBER_MS = 10 * 60_000;
const MAX_PLACES = 500;
const NAME_PARTS = 3;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type Address = Record<string, string | undefined>;
type Reply = { address?: Address; display_name?: string } | null;

const firstOf = (address: Address, keys: readonly string[]): string | undefined => keys.map((key) => address[key]?.trim()).find(Boolean);

/** «Avenida Alfonso Ugarte 123, Breña, Lima»; a place with no street, the start of its long name. */
export function addressOf(reply: unknown): string | null {
  const { address = {}, display_name: longName } = (reply ?? {}) as NonNullable<Reply>;
  const road = firstOf(address, ['road', 'pedestrian', 'footway', 'path', 'cycleway']);
  if (road) {
    const street = [road, address.house_number?.trim()].filter(Boolean).join(' ');
    const parts = [street, firstOf(address, ['suburb', 'city_district', 'district', 'neighbourhood']), firstOf(address, ['city', 'town', 'village', 'municipality'])];
    return parts.filter(Boolean).join(', ');
  }
  const parts = new Set(longName?.split(',').map((part) => part.trim()).filter((part) => !/^\d+$/.test(part)));
  return [...parts].slice(0, NAME_PARTS).join(', ') || null;
}

async function askProvider(point: GeoPoint, fetcher: Fetcher): Promise<string | null> {
  const query = new URLSearchParams({ format: 'jsonv2', lat: String(point.lat), lon: String(point.lng), zoom: '19', addressdetails: '1', 'accept-language': 'es' });
  try {
    const reply = await fetcher(`${NOMINATIM_URL}?${query}`, { headers: { 'User-Agent': CLIENT_NAME }, signal: AbortSignal.timeout(LOOKUP_BUDGET_MS) });
    return reply.ok ? addressOf(await reply.json()) : null;
  } catch (error) {
    console.warn('[lugar] sin dirección:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** A failure is not remembered: the next reading asks again. */
export function createPlaceLookup(deps: { fetcher?: Fetcher; now?: () => number; maxPlaces?: number } = {}) {
  const { fetcher = fetch, now = Date.now, maxPlaces = MAX_PLACES } = deps;
  const known = new Map<string, { name: string; until: number }>();
  return async (point: GeoPoint): Promise<string | null> => {
    const key = placeKeyOf(point);
    const hit = known.get(key);
    if (hit && hit.until > now()) return hit.name;
    const name = await askProvider(point, fetcher);
    if (!name) return null;
    known.delete(key);
    known.set(key, { name, until: now() + REMEMBER_MS });
    if (known.size > maxPlaces) known.delete(known.keys().next().value!);
    return name;
  };
}

export const placeNameOf = createPlaceLookup();
