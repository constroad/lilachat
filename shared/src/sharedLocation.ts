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
/** A coordinate's pixel in the whole world at a zoom (Web Mercator, 256-px tiles). */
function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = TILE * 2 ** zoom;
  const sine = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world };
}

/** The OpenStreetMap tiles that cover a box whose top-left corner sits at a world pixel. */
function tilesCovering(corner: { left: number; top: number }, box: { width: number; height: number }, zoom: number): MapTile[] {
  const tiles: MapTile[] = [];
  const count = 2 ** zoom;
  for (let row = Math.floor(corner.top / TILE); row <= Math.floor((corner.top + box.height - 1) / TILE); row += 1) {
    if (row < 0 || row >= count) continue;
    for (let column = Math.floor(corner.left / TILE); column <= Math.floor((corner.left + box.width - 1) / TILE); column += 1) {
      const wrapped = ((column % count) + count) % count;
      tiles.push({ url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`, left: column * TILE - corner.left, top: row * TILE - corner.top });
    }
  }
  return tiles;
}

export function mapTilesFor(location: SharedLocation, box: { width: number; height: number }, zoom = 16): { tiles: MapTile[]; pin: { left: number; top: number }; accuracyRadius: number } {
  const point = worldPixel(location.lat, location.lng, zoom);
  const corner = { left: Math.round(point.x - box.width / 2), top: Math.round(point.y - box.height / 2) };
  const metersPerPixel = (EQUATOR_M_PER_PX * Math.cos((location.lat * Math.PI) / 180)) / 2 ** zoom;
  return {
    tiles: tilesCovering(corner, box, zoom),
    pin: { left: Math.round(point.x - corner.left), top: Math.round(point.y - corner.top) },
    accuracyRadius: location.accuracy ? Math.round(location.accuracy / metersPerPixel) : 0,
  };
}

export type RoutePoint = { lat: number; lng: number; label?: string };
export const ROUTE_MAX_ZOOM = 18;
const ROUTE_MIN_ZOOM = 3;
/** Room around the outer points, so a pin and its label never touch the edge. */
export const ROUTE_PADDING_PX = 28;

/** The closest zoom at which every point fits the box with its padding. */
function routeZoom(points: readonly RoutePoint[], box: { width: number; height: number }): number {
  for (let zoom = ROUTE_MAX_ZOOM; zoom > ROUTE_MIN_ZOOM; zoom -= 1) {
    const pixels = points.map((point) => worldPixel(point.lat, point.lng, zoom));
    const spanX = Math.max(...pixels.map((pixel) => pixel.x)) - Math.min(...pixels.map((pixel) => pixel.x));
    const spanY = Math.max(...pixels.map((pixel) => pixel.y)) - Math.min(...pixels.map((pixel) => pixel.y));
    if (spanX <= box.width - 2 * ROUTE_PADDING_PX && spanY <= box.height - 2 * ROUTE_PADDING_PX) return zoom;
  }
  return ROUTE_MIN_ZOOM;
}

/**
 * A still map that fits every point of a route (Portal 13/11, visits: lv01 joins the visit's
 * points with a dotted line). The tiles and where each point lands, in the box's pixels.
 */
export function routeTilesFor(points: readonly RoutePoint[], box: { width: number; height: number }): { tiles: MapTile[]; points: { left: number; top: number; label?: string }[]; zoom: number } {
  const zoom = routeZoom(points, box);
  const pixels = points.map((point) => worldPixel(point.lat, point.lng, zoom));
  const middleX = (Math.max(...pixels.map((pixel) => pixel.x)) + Math.min(...pixels.map((pixel) => pixel.x))) / 2;
  const middleY = (Math.max(...pixels.map((pixel) => pixel.y)) + Math.min(...pixels.map((pixel) => pixel.y))) / 2;
  const corner = { left: Math.round(middleX - box.width / 2), top: Math.round(middleY - box.height / 2) };
  return {
    tiles: tilesCovering(corner, box, zoom),
    points: pixels.map((pixel, index) => ({ left: Math.round(pixel.x - corner.left), top: Math.round(pixel.y - corner.top), ...(points[index]?.label ? { label: points[index].label } : {}) })),
    zoom,
  };
}
