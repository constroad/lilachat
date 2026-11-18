/**
 * Where a field read from a KML sits (fase 3, agentes 17/11): its points and the lot's outline, in WGS84. The value
 * stays the text («3 200 m² según el KML»); the geo only draws it in the ficha. A bad geo drops itself, never the field.
 */
import { routeTilesFor, type MapTile } from './sharedLocation.js';
export type FieldGeoPoint = { lat: number; lng: number; label?: string };
export type FieldGeo = { points?: FieldGeoPoint[]; polygon?: { lat: number; lng: number }[] };

/** agentes simplifies the outline before sending it. */
export const GEO_VERTICES_MAX = 500;
const POLYGON_MIN = 3;
const LABEL_MAX = 60;
const MAX_LAT = 90;
const MAX_LNG = 180;
export const GEO_SHAPE = `geo va como { points?: [{ lat, lng, label? }], polygon?: [{ lat, lng }] de ${POLYGON_MIN} a ${GEO_VERTICES_MAX} vértices } en WGS84.`;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const coordinate = (value: unknown, max: number): number | null => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max ? value : null);

function pointOf(raw: unknown, withLabel: boolean): FieldGeoPoint | null {
  const body = record(raw);
  const [lat, lng] = [coordinate(body.lat, MAX_LAT), coordinate(body.lng, MAX_LNG)];
  if (lat === null || lng === null) return null;
  const label = withLabel && typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, LABEL_MAX) : undefined;
  return label ? { lat, lng, label } : { lat, lng };
}

function listOf(raw: unknown, withLabel: boolean, min: number): FieldGeoPoint[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > GEO_VERTICES_MAX) return null;
  const points = raw.map((one) => pointOf(one, withLabel));
  return points.every((point): point is FieldGeoPoint => point !== null) ? points : null;
}

/** A field's geo, or null when it is not one (then only the geo is dropped). */
export function fieldGeoOf(raw: unknown): FieldGeo | null {
  const body = record(raw);
  if (body.points === undefined && body.polygon === undefined) return null;
  const points = body.points === undefined ? undefined : listOf(body.points, true, 1);
  const polygon = body.polygon === undefined ? undefined : listOf(body.polygon, false, POLYGON_MIN);
  if (points === null || polygon === null) return null;
  return { ...(points ? { points } : {}), ...(polygon ? { polygon } : {}) };
}

/** The fields of a PUT whose geo came wrong, to tell agentes back in `ignored`. */
export function droppedGeoOf(rawFields: unknown): { field: string; message: string }[] {
  if (!Array.isArray(rawFields)) return [];
  return rawFields.flatMap((raw) => {
    const body = record(raw);
    return body.geo !== undefined && typeof body.key === 'string' && !fieldGeoOf(body.geo) ? [{ field: `fields.${body.key}.geo`, message: GEO_SHAPE }] : [];
  });
}

const BOX_PADDING = 0.85;

/** The ficha's map of a field: tiles that fit everything, the lot's outline and the named points, in pixels. */
export function fieldGeoMapOf(geo: FieldGeo, box: { width: number; height: number }): { tiles: MapTile[]; outline: { left: number; top: number }[]; pins: { left: number; top: number; label?: string }[] } {
  const outline = geo.polygon ?? [];
  const pins = geo.points ?? [];
  // A little smaller box to fit, so the outline does not touch the edge; the pixels are moved back to the real box.
  const inner = { width: Math.round(box.width * BOX_PADDING), height: Math.round(box.height * BOX_PADDING) };
  const shift = { left: Math.round((box.width - inner.width) / 2), top: Math.round((box.height - inner.height) / 2) };
  const fitted = routeTilesFor([...outline, ...pins], inner);
  const moved = fitted.points.map((point) => ({ ...point, left: point.left + shift.left, top: point.top + shift.top }));
  const tiles = fitted.tiles.map((tile) => ({ ...tile, left: tile.left + shift.left, top: tile.top + shift.top }));
  return { tiles, outline: moved.slice(0, outline.length).map(({ left, top }) => ({ left, top })), pins: moved.slice(outline.length) };
}
