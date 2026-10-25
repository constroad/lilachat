/**
 * Where a place goes in each navigation app (José 25/10: tapping the location of a reminder asks
 * «Maps o Waze»). Pure. The text is an address, coordinates or a Google Maps link; only a Google
 * Maps link is opened as it is, anything else is searched.
 */
export type PlaceLinks = { maps: string; waze: string };

const COORDINATES = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;
const AT_POINT = /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

const point = (latitude: string, longitude: string): string | null =>
  Math.abs(Number(latitude)) <= MAX_LATITUDE && Math.abs(Number(longitude)) <= MAX_LONGITUDE ? `${latitude},${longitude}` : null;

const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const wazeAt = (coordinates: string) => `https://waze.com/ul?ll=${encodeURIComponent(coordinates)}&navigate=yes`;
const wazeSearch = (query: string) => `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;

function googleMapsUrl(text: string): URL | null {
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    const google = /(^|\.)google\.[a-z.]+$/.test(host) && (url.pathname.startsWith('/maps') || host.startsWith('maps.'));
    return google || host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps')) ? url : null;
  } catch {
    return null;
  }
}

/** The point a Google Maps link carries: after «@», or in its `q`, `ll` or `query`. */
function pointOfLink(url: URL): string | null {
  const after = AT_POINT.exec(url.pathname);
  if (after) return point(after[1]!, after[2]!);
  for (const key of ['q', 'll', 'query']) {
    const match = COORDINATES.exec(url.searchParams.get(key) ?? '');
    if (match) return point(match[1]!, match[2]!);
  }
  return null;
}

export function placeLinks(location: string | undefined): PlaceLinks | null {
  const text = location?.trim();
  if (!text) return null;
  const direct = COORDINATES.exec(text);
  const coordinates = direct ? point(direct[1]!, direct[2]!) : null;
  if (coordinates) return { maps: mapsSearch(coordinates), waze: wazeAt(coordinates) };
  const link = googleMapsUrl(text);
  if (link) {
    const linked = pointOfLink(link);
    return { maps: text, waze: linked ? wazeAt(linked) : wazeSearch(text) };
  }
  return { maps: mapsSearch(text), waze: wazeSearch(text) };
}
