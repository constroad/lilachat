import type { WorkMapPoint as GeoPoint } from './workMap.js';

/**
 * «Buscar lugar o pegar enlace» over the work map (José 08/11, same as Portal): a place name, a
 * «lat,lng», or the Google Maps link the client sends (long or short). PURE: the server resolves
 * short links and names; the APK and the web read coordinates here, without a round trip.
 */
export type PlaceResult = { name: string; lat: number; lng: number };
export type PlaceQuery = { kind: 'point'; point: GeoPoint } | { kind: 'short_link'; url: string } | { kind: 'name'; text: string } | { kind: 'too_short' };

export const PLACE_RESULTS_MAX = 6;
export const PLACE_QUERY_MIN = 3;
export const PLACE_QUERY_MAX = 200;
/** Close enough to tell one side of the street from the other (Portal opens the search at 17). */
export const PLACE_ZOOM = 17;
export const SHORT_MAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'] as const;

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
/** In Portal's order: the exact marker first, the camera center last (José 08/11). */
const COORD_PATTERNS = [
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`[?&]q=${NUMBER}%2C${NUMBER}`, 'i'),
  new RegExp(`[?&]q=${NUMBER},${NUMBER}`),
  new RegExp(`[?&](?:ll|sll|daddr)=${NUMBER},${NUMBER}`),
  new RegExp(`/@${NUMBER},${NUMBER}`),
  new RegExp(`^\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*$`),
];

const onEarth = (lat: number, lng: number): boolean => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function coordsFromText(text: string): GeoPoint | null {
  for (const pattern of COORD_PATTERNS) {
    const found = pattern.exec(text);
    if (!found) continue;
    const [lat, lng] = [Number(found[1]), Number(found[2])];
    if (onEarth(lat, lng)) return { lat, lng };
  }
  return null;
}

/** Only the short links of Google Maps are followed: the server is no proxy for any address. */
export function isShortMapsLink(text: string): boolean {
  try {
    const url = new URL(text.trim());
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'maps.app.goo.gl') return true;
    if (url.hostname === 'goo.gl') return url.pathname.startsWith('/maps/');
    return url.hostname === 'g.co' && url.pathname.startsWith('/kgs/');
  } catch {
    // Not a link: it is a name or coordinates.
    return false;
  }
}

/** How a Peruvian address is written, spelled out: OpenStreetMap has «Jirón Lampa», not «Jr. Lampa». */
const STREET_ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bjr\.?(?=\s)/gi, 'Jirón'],
  [/\bav\.?(?=\s)/gi, 'Avenida'],
  [/\bpsje\.?(?=\s)/gi, 'Pasaje'],
  [/\bca\.(?=\s)/gi, 'Calle'],
  [/\bcl\.(?=\s)/gi, 'Calle'],
  [/\burb\.?(?=\s)/gi, 'Urbanización'],
];

const spelledOut = (text: string): string => STREET_ABBREVIATIONS.reduce((written, [pattern, word]) => written.replace(pattern, word), text);

export function placeQueryOf(raw: string): PlaceQuery {
  const text = raw.trim().slice(0, PLACE_QUERY_MAX);
  const point = coordsFromText(text);
  if (point) return { kind: 'point', point };
  if (isShortMapsLink(text)) return { kind: 'short_link', url: text };
  return text.length < PLACE_QUERY_MIN ? { kind: 'too_short' } : { kind: 'name', text: spelledOut(text) };
}

/** Nominatim's `search` answer, by a whitelist. */
export function placeResultsOf(raw: unknown): PlaceResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    const { display_name: name, lat, lon } = (row ?? {}) as { display_name?: unknown; lat?: unknown; lon?: unknown };
    const [latitude, longitude] = [Number(lat), Number(lon)];
    return typeof name === 'string' && Number.isFinite(latitude) && Number.isFinite(longitude) && onEarth(latitude, longitude) ? [{ name, lat: latitude, lng: longitude }] : [];
  }).slice(0, PLACE_RESULTS_MAX);
}

export const PLACE_NOT_FOUND = 'No encontramos ese lugar. Prueba con la calle y el distrito, o pega el enlace de Google Maps.';
export const PLACE_LINK_FAILED = 'No se pudo abrir ese enlace. Pega el enlace largo o las coordenadas.';

export type PlaceAnswer = { ok: true; results: PlaceResult[] } | { ok: false; message: string };
/** The server's `POST /api/places`; `near` is the middle of what is on screen. */
export type PlaceAsk = (text: string, near?: GeoPoint) => Promise<PlaceAnswer>;
export const PLACE_SEARCH_FAILED = 'No se pudo buscar. Revisa tu señal y vuelve a intentar.';

/** Coordinates answer here, without a round trip; the rest asks the server. Never throws. */
export async function findPlace(raw: string, ask: PlaceAsk, near?: GeoPoint): Promise<PlaceAnswer> {
  const query = placeQueryOf(raw);
  if (query.kind === 'point') return { ok: true, results: [{ name: `${query.point.lat}, ${query.point.lng}`, ...query.point }] };
  if (query.kind === 'too_short') return { ok: false, message: PLACE_NOT_FOUND };
  try {
    return await ask(query.kind === 'name' ? query.text : raw.trim(), near);
  } catch {
    // The server never answered: the person tries again.
    return { ok: false, message: PLACE_SEARCH_FAILED };
  }
}
