/**
 * A location shared in the chat (pending 11), like WhatsApp: a card with a
 * small map, the accuracy and «Abrir en el mapa». The message's `body` says
 * «Ubicación», so the list, the notification and the search read it as text.
 * Live location comes later. PURE: the server validates with this, the app
 * and the web draw it.
 */
export type SharedLocation = { lat: number; lng: number; accuracy?: number };
export const SHARED_LOCATION_BODY = 'Ubicación';

const COORDINATE_DECIMALS = 1e6;
/** Beyond this the fix says nothing useful about where the person is (m). */
const ACCURACY_MAX_M = 20_000;
const TILE = 256;
/** Meters per pixel at the equator at zoom 0 (Web Mercator, 256 px tiles). */
const EQUATOR_M_PER_PX = 156_543.03392;

const toNumber = (value: unknown): number => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN);
const round = (value: number) => Math.round(value * COORDINATE_DECIMALS) / COORDINATE_DECIMALS;

export function cleanSharedLocation(raw: { lat?: unknown; lng?: unknown; accuracy?: unknown }): { ok: true; location: SharedLocation } | { ok: false; message: string } {
  const lat = toNumber(raw.lat);
  const lng = toNumber(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, message: 'Esa ubicación no es válida.' };
  const accuracy = toNumber(raw.accuracy);
  const usable = Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= ACCURACY_MAX_M;
  return { ok: true, location: { lat: round(lat), lng: round(lng), ...(usable ? { accuracy: Math.round(accuracy) } : {}) } };
}

/** «Precisión 12 m», «Precisión 1,5 km»; nothing without an accuracy. */
export function accuracyLabel(accuracy: number | undefined): string {
  if (accuracy === undefined) return '';
  return accuracy < 1000 ? `Precisión ${Math.round(accuracy)} m` : `Precisión ${(accuracy / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Opens the Maps app on a phone and Google Maps on a computer. */
export const locationMapLink = (location: SharedLocation): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;

export type MapTile = { url: string; left: number; top: number };

/** The OpenStreetMap tiles that cover a box with the point in its middle, where the pin goes and how big the accuracy circle is (px). */
export function mapTilesFor(location: SharedLocation, box: { width: number; height: number }, zoom = 16): { tiles: MapTile[]; pin: { left: number; top: number }; accuracyRadius: number } {
  const world = TILE * 2 ** zoom;
  const sin = Math.sin((location.lat * Math.PI) / 180);
  const pointX = ((location.lng + 180) / 360) * world;
  const pointY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
  const left = Math.round(pointX - box.width / 2);
  const top = Math.round(pointY - box.height / 2);
  const tiles: MapTile[] = [];
  const count = 2 ** zoom;
  for (let row = Math.floor(top / TILE); row <= Math.floor((top + box.height - 1) / TILE); row += 1) {
    if (row < 0 || row >= count) continue;
    for (let column = Math.floor(left / TILE); column <= Math.floor((left + box.width - 1) / TILE); column += 1) {
      const wrapped = ((column % count) + count) % count;
      tiles.push({ url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`, left: column * TILE - left, top: row * TILE - top });
    }
  }
  const metersPerPixel = (EQUATOR_M_PER_PX * Math.cos((location.lat * Math.PI) / 180)) / 2 ** zoom;
  return { tiles, pin: { left: Math.round(pointX - left), top: Math.round(pointY - top) }, accuracyRadius: location.accuracy ? Math.round(location.accuracy / metersPerPixel) : 0 };
}
