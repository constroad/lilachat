import { basemapStreetWidthPx } from './workMapStyle.js';

/**
 * The work's lines as wide as the street on the ground (José 28/11: «no ocupan el ancho de la calle»).
 * MapLibre paints `line-width` in screen pixels; with an exponential interpolation of base 2 over the
 * zoom, a width of N meters stays N meters at every zoom, never thinner than a readable minimum.
 * The meters math is right (512 px tiles, latitude of Lima), but the base map draws its streets
 * wider than their real width up to zoom 18 (a 6 m street: 17 px at 17.5 against 14.5 px of ground),
 * so the line also covers at least the drawn street (emulator QA 28/11: 13 px over 18-20 px).
 * PURE: the web and the APK paint what this returns.
 */

/** A street with no width written: a two-lane urban street. */
export const DEFAULT_STREET_WIDTH_M = 6;
/** The works are in Peru (0° to 18° S): the width is computed at Lima, a few % off at the ends. */
export const WORK_MAP_REFERENCE_LATITUDE = -12;
/** Meters of one screen pixel at zoom 0 on the equator, with MapLibre's 512 px tiles. */
const EQUATOR_METERS_PER_PIXEL = 78271.517;
const DEGREES_TO_RADIANS = Math.PI / 180;
const FIRST_STOP_ZOOM = 12;
const LAST_STOP_ZOOM = 22;
const ZOOM_BASE = 2;

/** Meters covered by one screen pixel at `zoom` and `latitude`. */
export const metersPerPixel = (zoom: number, latitude: number): number =>
  (EQUATOR_METERS_PER_PIXEL * Math.cos(latitude * DEGREES_TO_RADIANS)) / ZOOM_BASE ** zoom;

/** Pixels a street of `widthM` takes on screen, never under `minPx` (zoomed out it would vanish). */
export const groundWidthPx = (widthM: number, zoom: number, latitude: number, minPx: number): number =>
  Math.max(minPx, widthM / metersPerPixel(zoom, latitude));

/** What one line takes on screen: its ground width, never under the drawn street nor `minPx`. */
export const workLineWidthPx = (widthM: number, zoom: number, latitude: number, minPx: number): number =>
  Math.max(basemapStreetWidthPx(zoom), groundWidthPx(widthM, zoom, latitude, minPx));

const stopZooms = (): number[] => Array.from({ length: LAST_STOP_ZOOM - FIRST_STOP_ZOOM + 1 }, (_, index) => FIRST_STOP_ZOOM + index);

/**
 * `line-width` that reads each line's `widthM` property: one stop per zoom, each clamped to `minPx` and the drawn street,
 * joined by base-2 interpolation (exact between two unclamped stops). Under zoom 12 it holds the minimum.
 */
export function streetWidthExpression(minPx: number, latitude: number = WORK_MAP_REFERENCE_LATITUDE): unknown[] {
  const widthM = ['coalesce', ['get', 'widthM'], DEFAULT_STREET_WIDTH_M];
  const stops = stopZooms().flatMap((zoom) => [zoom, ['max', Math.max(minPx, basemapStreetWidthPx(zoom)), ['*', widthM, 1 / metersPerPixel(zoom, latitude)]]]);
  return ['interpolate', ['exponential', ZOOM_BASE], ['zoom'], ...stops];
}

/** The base map's first label layer: our lines go under it, so the street names read on top. */
export const firstSymbolLayerId = (style: { layers: ReadonlyArray<{ id: string; type: string }> }): string | undefined =>
  style.layers.find((layer) => layer.type === 'symbol')?.id;

/** Our lines and fills go under this layer of the work map style (José 28/11: «el nombre de la calle siempre por encima»). */
export const WORK_MAP_LABELS_LAYER = 'street-name';
