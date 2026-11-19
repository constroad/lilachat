/**
 * Portal's drawings on a work map (`MapMark`: a giba, a manhole, a bocacalle… José 19/11, El Almirante:
 * Portal showed 33 and Lilachat «Todavía no hay calles»). Read as Portal sends them in the client
 * detail (`workMapMarks`) and turned into what MapLibre draws, on the web and in the app. PURE.
 */
export type MarkPoint = { lat: number; lng: number };
export type WorkMapMarkShape =
  | { kind: 'rect'; corners: [MarkPoint, MarkPoint] }
  | { kind: 'circle'; center: MarkPoint; radiusM: number }
  | { kind: 'arrow'; from: MarkPoint; to: MarkPoint }
  | { kind: 'polygon'; points: MarkPoint[] }
  | { kind: 'symbol'; at: MarkPoint };
export type WorkMapMark = { id: string; type: string; note?: string; shape: WorkMapMarkShape };

const MARK_LABELS: Record<string, string> = {
  giba: 'Giba', buzon: 'Buzón', sumidero: 'Sumidero', poste: 'Poste', arbol: 'Árbol',
  bocacalle: 'Bocacalle', sardinel: 'Sardinel', tapa: 'Tapa', cono: 'Cono', otro: 'Otro',
};
/** MapLibre paints with plain colors: a CSS variable does not reach its canvas. */
export const WORK_MAP_MARK_COLOR = '#f59e0b';
const MAX_MARKS = 300;
const MAX_POLYGON_POINTS = 200;
const CIRCLE_STEPS = 32;
const METERS_PER_DEGREE = 111_320;
const MAX_NOTE = 160;

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function pointOf(raw: unknown): MarkPoint | null {
  if (!isFields(raw) || !finite(raw.lat) || !finite(raw.lng)) return null;
  return Math.abs(raw.lat) <= 90 && Math.abs(raw.lng) <= 180 ? { lat: raw.lat, lng: raw.lng } : null;
}

function polygonOf(raw: unknown): WorkMapMarkShape | null {
  if (!Array.isArray(raw)) return null;
  const points = raw.slice(0, MAX_POLYGON_POINTS).map(pointOf);
  return points.length >= 3 && points.every((point): point is MarkPoint => point !== null) ? { kind: 'polygon', points } : null;
}

function rectOf(raw: unknown): WorkMapMarkShape | null {
  if (!Array.isArray(raw)) return null;
  const [a, b] = [pointOf(raw[0]), pointOf(raw[1])];
  return a && b ? { kind: 'rect', corners: [a, b] } : null;
}

function circleOf(raw: Fields): WorkMapMarkShape | null {
  const center = pointOf(raw.center);
  return center && finite(raw.radiusM) && raw.radiusM > 0 ? { kind: 'circle', center, radiusM: raw.radiusM } : null;
}

function arrowOf(raw: Fields): WorkMapMarkShape | null {
  const [from, to] = [pointOf(raw.from), pointOf(raw.to)];
  return from && to ? { kind: 'arrow', from, to } : null;
}

function symbolOf(raw: Fields): WorkMapMarkShape | null {
  const at = pointOf(raw.at);
  return at ? { kind: 'symbol', at } : null;
}

const SHAPE_READERS: Record<WorkMapMarkShape['kind'], (raw: Fields) => WorkMapMarkShape | null> = {
  symbol: symbolOf,
  circle: circleOf,
  arrow: arrowOf,
  rect: (raw) => rectOf(raw.corners),
  polygon: (raw) => polygonOf(raw.points),
};

function shapeOf(raw: unknown): WorkMapMarkShape | null {
  if (!isFields(raw) || typeof raw.kind !== 'string' || !(raw.kind in SHAPE_READERS)) return null;
  return SHAPE_READERS[raw.kind as WorkMapMarkShape['kind']](raw);
}

function markOf(raw: unknown): WorkMapMark | null {
  if (!isFields(raw) || raw.hidden === true || typeof raw.id !== 'string' || typeof raw.type !== 'string') return null;
  const shape = shapeOf(raw.shape);
  if (!shape) return null;
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE) : '';
  return { id: raw.id, type: raw.type, ...(note ? { note } : {}), shape };
}

/** Portal's `workMapMarks`, each one checked; a hidden or broken drawing stays out. */
export const workMapMarksOf = (raw: unknown): WorkMapMark[] =>
  (Array.isArray(raw) ? raw.slice(0, MAX_MARKS).map(markOf).filter((mark): mark is WorkMapMark => mark !== null) : []);

export const markLabel = (type: string): string => MARK_LABELS[type] ?? MARK_LABELS.otro!;

const lngLat = (point: MarkPoint): [number, number] => [point.lng, point.lat];
const closed = (ring: Array<[number, number]>) => [...ring, ring[0]!];

function circleRing(center: MarkPoint, radiusM: number): Array<[number, number]> {
  const dLat = radiusM / METERS_PER_DEGREE;
  const dLng = radiusM / (METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return Array.from({ length: CIRCLE_STEPS }, (_unused, step): [number, number] => {
    const angle = (2 * Math.PI * step) / CIRCLE_STEPS;
    return [center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)];
  });
}

type MarkGeometry = { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: Array<[number, number]> } | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };

function geometryOf(shape: WorkMapMarkShape): MarkGeometry {
  if (shape.kind === 'symbol') return { type: 'Point', coordinates: lngLat(shape.at) };
  if (shape.kind === 'arrow') return { type: 'LineString', coordinates: [lngLat(shape.from), lngLat(shape.to)] };
  if (shape.kind === 'circle') return { type: 'Polygon', coordinates: [closed(circleRing(shape.center, shape.radiusM))] };
  if (shape.kind === 'polygon') return { type: 'Polygon', coordinates: [closed(shape.points.map(lngLat))] };
  const [a, b] = shape.corners;
  return { type: 'Polygon', coordinates: [closed([lngLat(a), [b.lng, a.lat], lngLat(b), [a.lng, b.lat]])] };
}

/** The drawings as MapLibre reads them: areas as polygons, the arrow as a line, an element as a point. */
export const mapMarkCollection = (marks: readonly WorkMapMark[]) => ({
  type: 'FeatureCollection' as const,
  features: marks.map((mark) => ({ type: 'Feature' as const, id: mark.id, geometry: geometryOf(mark.shape), properties: { id: mark.id, label: markLabel(mark.type), note: mark.note ?? '' } })),
});

function pointsOf(shape: WorkMapMarkShape): MarkPoint[] {
  if (shape.kind === 'symbol') return [shape.at];
  if (shape.kind === 'arrow') return [shape.from, shape.to];
  if (shape.kind === 'circle') return [shape.center];
  return shape.kind === 'rect' ? [...shape.corners] : shape.points;
}

/** Where the drawings are, to frame a map without streets. */
export function mapMarksBounds(marks: readonly WorkMapMark[]): [[number, number], [number, number]] | null {
  const points = marks.flatMap((mark) => pointsOf(mark.shape));
  if (!points.length) return null;
  const [lngs, lats] = [points.map((point) => point.lng), points.map((point) => point.lat)];
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

/** Paint of the drawings: a translucent area with its outline, the arrow and the element dot, and the label. */
export const MARK_FILL_PAINT = { 'fill-color': WORK_MAP_MARK_COLOR, 'fill-opacity': 0.25 };
export const MARK_LINE_PAINT = { 'line-color': WORK_MAP_MARK_COLOR, 'line-width': 2.5 };
export const MARK_DOT_PAINT = { 'circle-radius': 6, 'circle-color': WORK_MAP_MARK_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 };
/** The basemap's glyphs only have its own fonts (like the stations' labels). */
export const MARK_TEXT_LAYOUT = { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-allow-overlap': false };
export const MARK_TEXT_PAINT = { 'text-color': '#78350f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 };
