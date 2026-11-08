import { haversineMeters, pointAtMeasure } from '@constroad/shared/obra';
import { projectOntoLine, stationLabel, type WorkMap, type WorkMapPoint } from './workMap.js';
import type { DischargePin } from './workMapProgress.js';
import { reportTypeLabel } from './reportCreation.js';
import type { ViewableFile } from './fileViewer.js';

/**
 * The «Fotos» layer of the work map (José 08/11: if unit 1 worked on street X, the map should have a
 * marker on street X to see its photos and videos). Every field photo is taken with
 * the phone's place: here it lands on its street and chainage, and photos of the same spot share one
 * marker. PURE: the APK and the web draw from here.
 */
export type MapPhoto = WorkMapPoint & {
  id: string;
  at: string;
  kind: 'photo' | 'video';
  url: string;
  thumbnailUrl: string;
  precisionM?: number;
  reportType?: string;
  reportId?: string;
  reportCode?: string;
  dispatchId?: string;
  plate?: string;
};
export type PhotoSpot = WorkMapPoint & { id: string; streetId: string | null; streetName: string | null; atM: number | null; photos: MapPhoto[] };

/** What one service can carry to the phone; the newest stay. */
export const MAP_PHOTOS_MAX = 300;
/** Photos closer than this along a street are one spot: a dump truck empties over a few meters. */
export const PHOTO_SPOT_M = 15;
/** Farther than this from the axis, a photo is not of that street (Portal's search radius). */
export const PHOTO_STREET_REACH_M = 30;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);
const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

function photoOf(raw: unknown): MapPhoto[] {
  if (!raw || typeof raw !== 'object') return [];
  const row = raw as Record<string, unknown>;
  const [id, url, at, lat, lng] = [text(row.id), text(row.url), text(row.at), finite(row.lat), finite(row.lng)];
  if (!id || !url || !at || lat === undefined || lng === undefined) return [];
  const optional = { precisionM: finite(row.precisionM), reportType: text(row.reportType), reportId: text(row.reportId), reportCode: text(row.reportCode), dispatchId: text(row.dispatchId), plate: text(row.plate) };
  const kept = Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined));
  return [{ id, lat, lng, at, kind: row.kind === 'video' ? 'video' : 'photo', url, thumbnailUrl: text(row.thumbnailUrl) ?? url, ...kept }];
}

/** `mapPhotos` of the service detail, by a whitelist: what has no place or no link is not drawn. */
export const mapPhotosOf = (value: unknown): MapPhoto[] => (Array.isArray(value) ? value.flatMap(photoOf).slice(0, MAP_PHOTOS_MAX) : []);

/** A photo on its street and chainage; `streetId` null when it fell off the work. */
export type Placed = { photo: MapPhoto; streetId: string | null; atM: number };

export function placeOnStreets(map: Pick<WorkMap, 'streets'>, photo: MapPhoto): Placed {
  let best: Placed = { photo, streetId: null, atM: 0 };
  let bestDistance = PHOTO_STREET_REACH_M;
  for (const street of map.streets) {
    const foot = projectOntoLine(street.line, photo);
    // A tie keeps the first street: two streets drawn over the same road stay in the map's order.
    if (foot && (best.streetId === null ? foot.distanceM <= bestDistance : foot.distanceM < bestDistance)) {
      best = { photo, streetId: street.id, atM: foot.measureM };
      bestDistance = foot.distanceM;
    }
  }
  return best;
}

/** ISO instants order as text; no collator (Hermes builds one per `localeCompare`). */
const newestFirst = (photos: MapPhoto[]): MapPhoto[] => [...photos].sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0));

function streetSpots(map: Pick<WorkMap, 'streets'>, streetId: string, placed: Placed[]): PhotoSpot[] {
  const street = map.streets.find((one) => one.id === streetId);
  const groups: Placed[][] = [];
  for (const one of [...placed].sort((left, right) => left.atM - right.atM)) {
    const last = groups.at(-1);
    if (last && one.atM - last[0]!.atM <= PHOTO_SPOT_M) last.push(one);
    else groups.push([one]);
  }
  return groups.map((group) => {
    const atM = Math.round(group.reduce((total, one) => total + one.atM, 0) / group.length);
    const point = (street && pointAtMeasure(street.line, atM)) ?? group[0]!.photo;
    return { id: `${streetId}-${atM}`, lat: point.lat, lng: point.lng, streetId, streetName: street?.name ?? null, atM, photos: newestFirst(group.map((one) => one.photo)) };
  });
}

function looseSpots(photos: MapPhoto[]): PhotoSpot[] {
  const groups: MapPhoto[][] = [];
  for (const photo of photos) {
    const near = groups.find((group) => haversineMeters(group[0]!, photo) <= PHOTO_SPOT_M);
    if (near) near.push(photo);
    else groups.push([photo]);
  }
  return groups.map((group) => ({ id: `fuera-${group[0]!.id}`, lat: group[0]!.lat, lng: group[0]!.lng, streetId: null, streetName: null, atM: null, photos: newestFirst(group) }));
}

/** Street by street in the map's order, along each street from 0+000; the loose ones last. */
export function photoSpotsOf(map: Pick<WorkMap, 'streets'>, photos: MapPhoto[]): PhotoSpot[] {
  const placed = photos.map((photo) => placeOnStreets(map, photo));
  const onStreets = map.streets.flatMap((street) => {
    const mine = placed.filter((one) => one.streetId === street.id);
    return mine.length ? streetSpots(map, street.id, mine) : [];
  });
  return [...onStreets, ...looseSpots(placed.filter((one) => one.streetId === null).map((one) => one.photo))];
}

/** «Jr. Los Pinos · 0+044», or that it fell off the work. */
export const photoSpotTitle = (spot: Pick<PhotoSpot, 'streetName' | 'atM'>): string =>
  spot.streetName !== null && spot.atM !== null ? `${spot.streetName} · ${stationLabel(spot.atM)}` : 'Fuera de las calles de la obra';

/** One pin per spot, with how many photos it holds. */
export const photoSpotPins = (spots: PhotoSpot[]): DischargePin[] =>
  spots.map((spot) => ({ id: `fotos-${spot.id}`, label: String(spot.photos.length), lat: spot.lat, lng: spot.lng, outside: spot.streetId === null }));

/** «Control de pista · QAA-001», «Control de imprimación», or a photo of «Registrar avance». */
export function photoSourceLabel(photo: Pick<MapPhoto, 'reportType' | 'plate'>): string {
  if (!photo.reportType) return photo.plate ? `Unidad ${photo.plate}` : 'Avance registrado';
  const report = reportTypeLabel(photo.reportType);
  return photo.plate ? `${report} · ${photo.plate}` : report;
}

/** The spot's photos for the viewer every map already has: newest first, named by where they came from. */
export const photoSpotFiles = (spot: Pick<PhotoSpot, 'photos' | 'streetName' | 'atM'>): ViewableFile[] =>
  spot.photos.map((photo) => ({ url: photo.url, name: `${photoSourceLabel(photo)} · ${photoSpotTitle(spot)}`, mime: photo.kind === 'video' ? 'video/mp4' : 'image/jpeg', thumbUrl: photo.thumbnailUrl, when: photo.at }));
