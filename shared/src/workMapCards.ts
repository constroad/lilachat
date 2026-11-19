import type { ViewableFile } from './fileViewer.js';
import { distanceMeters } from './liveLocation.js';
import { OBSERVATION_COLORS, registeredLine, STATUS_PILLS } from './observations.js';
import { markLabel, markName, type MarkPoint, type WorkMapMark, type WorkMapMarkShape } from './workMapMarks.js';
import type { WorkMapObservation, WorkMapObservationPhoto } from './workMapObservations.js';

/**
 * The small card of a drawing or an observation on the work map (José 19/11: no measuring
 * button): its name, its size and how far the nearest drawings are, all from the coordinates;
 * and the lists of the panel. PURE: the web and the APK draw from here.
 */
export type MapPick = { kind: 'mark' | 'observation'; id: string };
export type MapCardStatus = { label: string; tone: 'error' | 'ok' };
export type MapCard = {
  id: string;
  kind: MapPick['kind'];
  title: string;
  /** The type, when the name is not it already («Parche 12» is an «Otro»). */
  type?: string;
  note?: string;
  size?: string;
  status?: MapCardStatus;
  dates: string[];
  near: string[];
  photos: ViewableFile[];
};

const KM = 1000;
const NEAR_COUNT = 3;
/** Closer than this is the same spot: «junto a». */
const SAME_SPOT_M = 1;
const METERS_PER_DEGREE = 111_195;
const PHOTO_NAME_MAX = 60;
const STAGE_NAMES = { before: 'Antes', after: 'Después' } as const;

const comma = (value: number, decimals: number) => value.toFixed(decimals).replace('.', ',');
const grouped = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+$)/g, ' ');

/** «35 m» under a kilometre, «1,2 km» from there (José 19/11). */
export const distanceLabel = (meters: number): string => (Math.round(meters) < KM ? `${Math.round(meters)} m` : `${comma(meters / KM, 1)} km`);

/** A size: under a metre with its decimal (a manhole cover is not «0 m»), else whole metres. */
const sizeNumber = (meters: number): string => (meters < 1 ? comma(meters, 1) : grouped(meters));
const sizeLength = (meters: number): string => (meters < KM ? `${sizeNumber(meters)} m` : distanceLabel(meters));

const midpoint = (a: MarkPoint, b: MarkPoint): MarkPoint => ({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });

/** Where a drawing is, to measure from it and to fly to it. */
export function markCenter(shape: WorkMapMarkShape): MarkPoint {
  if (shape.kind === 'symbol') return shape.at;
  if (shape.kind === 'circle') return shape.center;
  if (shape.kind === 'arrow') return midpoint(shape.from, shape.to);
  if (shape.kind === 'rect') return midpoint(...shape.corners);
  const count = shape.points.length;
  return { lat: shape.points.reduce((sum, point) => sum + point.lat, 0) / count, lng: shape.points.reduce((sum, point) => sum + point.lng, 0) / count };
}

/** A polygon's area on a plane around its first corner: a block is flat enough (shoelace). */
function polygonAreaM2(points: readonly MarkPoint[]): number {
  const origin = points[0]!;
  const scaleLng = METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180);
  const flat = points.map((point) => ({ x: (point.lng - origin.lng) * scaleLng, y: (point.lat - origin.lat) * METERS_PER_DEGREE }));
  const twice = flat.reduce((sum, point, index) => {
    const next = flat[(index + 1) % flat.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(twice) / 2;
}

function rectSides(corners: readonly [MarkPoint, MarkPoint]): string {
  const [a, b] = corners;
  const width = distanceMeters(a, { lat: a.lat, lng: b.lng });
  const height = distanceMeters(a, { lat: b.lat, lng: a.lng });
  return `${sizeNumber(width)} × ${sizeNumber(height)} m`;
}

/** The size the shape has: a circle's diameter, a rect's sides, a polygon's area, an arrow's length. */
export function markSizeLabel(shape: WorkMapMarkShape): string | null {
  if (shape.kind === 'circle') return `Ø ${sizeLength(shape.radiusM * 2)}`;
  if (shape.kind === 'rect') return rectSides(shape.corners);
  if (shape.kind === 'polygon') return `Área ${sizeNumber(polygonAreaM2(shape.points))} m²`;
  if (shape.kind === 'arrow') return `Largo ${sizeLength(distanceMeters(shape.from, shape.to))}`;
  return null;
}

export type NearMark = { mark: WorkMapMark; meters: number; line: string };

const nearLine = (meters: number, name: string): string => (meters < SAME_SPOT_M ? `junto a ${name}` : `a ${distanceLabel(meters)} de ${name}`);

function nearPoint(point: MarkPoint, marks: readonly WorkMapMark[], skipId?: string): NearMark[] {
  return marks
    .filter((mark) => mark.id !== skipId)
    .map((mark) => ({ mark, meters: distanceMeters(point, markCenter(mark.shape)) }))
    .sort((left, right) => left.meters - right.meters)
    .slice(0, NEAR_COUNT)
    .map((near) => ({ ...near, line: nearLine(near.meters, markName(near.mark)) }));
}

/** The nearest drawings to one, closest first: «a 35 m de Parche 12». */
export const nearestMarks = (mark: WorkMapMark, marks: readonly WorkMapMark[]): NearMark[] => nearPoint(markCenter(mark.shape), marks, mark.id);

export function markCard(mark: WorkMapMark, marks: readonly WorkMapMark[]): MapCard {
  const title = markName(mark);
  const type = markLabel(mark.type);
  const size = markSizeLabel(mark.shape);
  return {
    id: mark.id,
    kind: 'mark',
    title,
    ...(type !== title ? { type } : {}),
    ...(mark.note && mark.note !== title ? { note: mark.note } : {}),
    ...(size ? { size } : {}),
    dates: [],
    near: nearestMarks(mark, marks).map((near) => near.line),
    photos: [],
  };
}

export const observationStatus = (observation: Pick<WorkMapObservation, 'status'>): MapCardStatus => STATUS_PILLS[observation.status === 'resolved' ? 'lifted' : 'open'];
export const observationColor = (observation: Pick<WorkMapObservation, 'status'>): string => OBSERVATION_COLORS[observation.status === 'resolved' ? 'lifted' : 'open'];

const photoName = (photo: WorkMapObservationPhoto, text: string) => `${photo.stage ? STAGE_NAMES[photo.stage] : 'Foto'} · ${text}`.slice(0, PHOTO_NAME_MAX);

/** The observation's photos as every viewer opens them. */
export const observationPhotos = (observation: Pick<WorkMapObservation, 'photos' | 'text'>): ViewableFile[] =>
  observation.photos.map((photo) => ({ url: photo.url, ...(photo.thumbnailUrl ? { thumbUrl: photo.thumbnailUrl } : {}), mime: 'image/jpeg', name: photoName(photo, observation.text) }));

function observationDates(observation: WorkMapObservation): string[] {
  const created = observation.createdAt ? [registeredLine({ at: observation.createdAt })] : [];
  const resolved = observation.resolvedAt ? [registeredLine({ at: observation.resolvedAt }, 'Levantada')] : [];
  return [...created, ...resolved];
}

export function observationCard(observation: WorkMapObservation, marks: readonly WorkMapMark[]): MapCard {
  return {
    id: observation.id,
    kind: 'observation',
    title: observation.text,
    status: observationStatus(observation),
    ...(observation.resolutionNote ? { note: observation.resolutionNote } : {}),
    dates: observationDates(observation),
    near: observation.point ? nearPoint(observation.point, marks).map((near) => near.line) : [],
    photos: observationPhotos(observation),
  };
}

/** The card of what was picked; null when it is no longer on the map. */
export function mapCardOf(pick: MapPick, marks: readonly WorkMapMark[], observations: readonly WorkMapObservation[]): MapCard | null {
  if (pick.kind === 'mark') {
    const mark = marks.find((one) => one.id === pick.id);
    return mark ? markCard(mark, marks) : null;
  }
  const observation = observations.find((one) => one.id === pick.id);
  return observation ? observationCard(observation, marks) : null;
}

/** Where the card stands and the map flies: the drawing's centre or the observation's point. */
export function mapPickAnchor(pick: MapPick, marks: readonly WorkMapMark[], observations: readonly WorkMapObservation[]): MarkPoint | null {
  if (pick.kind === 'mark') {
    const mark = marks.find((one) => one.id === pick.id);
    return mark ? markCenter(mark.shape) : null;
  }
  return observations.find((one) => one.id === pick.id)?.point ?? null;
}

export type MarkGroup = { type: string; label: string; count: number; items: Array<{ id: string; name: string; note?: string }> };

/** «Dibujos» of the panel: by type, the most numerous first, each one by its name. */
export function markGroupsOf(marks: readonly WorkMapMark[]): MarkGroup[] {
  const groups = new Map<string, MarkGroup>();
  marks.forEach((mark) => {
    const group = groups.get(mark.type) ?? { type: mark.type, label: markLabel(mark.type), count: 0, items: [] };
    const name = markName(mark);
    group.items.push({ id: mark.id, name, ...(mark.note && mark.note !== name ? { note: mark.note } : {}) });
    group.count += 1;
    groups.set(mark.type, group);
  });
  return [...groups.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'es'));
}

export type ObservationRow = { id: string; text: string; status: MapCardStatus; photos: string; placed: boolean };

const photoCount = (count: number) => (count === 0 ? 'Sin fotos' : count === 1 ? '1 foto' : `${count} fotos`);

/** «Observaciones» of the panel: the open ones first. */
export const observationRowsOf = (observations: readonly WorkMapObservation[]): ObservationRow[] =>
  [...observations].sort((left, right) => Number(left.status === 'resolved') - Number(right.status === 'resolved'))
    .map((one) => ({ id: one.id, text: one.text, status: observationStatus(one), photos: photoCount(one.photos.length), placed: Boolean(one.point) }));

/** The placed observations as MapLibre reads them: a pin in the color of its state. */
export const observationMapCollection = (observations: readonly WorkMapObservation[]) => ({
  type: 'FeatureCollection' as const,
  features: observations.flatMap((one) => (one.point ? [{ type: 'Feature' as const, id: one.id, geometry: { type: 'Point' as const, coordinates: [one.point.lng, one.point.lat] as [number, number] }, properties: { id: one.id, color: observationColor(one) } }] : [])),
});

/** The observation pin: its state's fill with a white ring, over the drawings. */
export const OBSERVATION_PIN_PAINT = { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 };
