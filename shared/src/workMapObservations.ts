/**
 * The observations of a service as Portal sends them in the client detail (`workObservations`,
 * José 19/11): what was seen on the work, where, and whether it was solved, with its photos.
 * Read tolerantly: a broken one stays out, only https photos reach a screen. PURE.
 */
export type WorkMapObservationStatus = 'open' | 'resolved';
export type WorkMapObservationPhoto = { url: string; thumbnailUrl?: string; stage?: 'before' | 'after' };
export type WorkMapObservation = {
  id: string;
  text: string;
  status: WorkMapObservationStatus;
  point?: { lat: number; lng: number };
  streetId?: string;
  fromM?: number;
  toM?: number;
  resolutionNote?: string;
  createdAt?: string;
  resolvedAt?: string;
  photos: WorkMapObservationPhoto[];
};

/** Portal caps them at 200 (José 19/11). */
const MAX_OBSERVATIONS = 200;
const MAX_PHOTOS = 12;
const MAX_TEXT = 600;
const MAX_ID = 64;
const MAX_DATE = 40;
const MAX_URL = 2048;
const STATUSES: readonly WorkMapObservationStatus[] = ['open', 'resolved'];
const STAGES = ['before', 'after'] as const;

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const textOf = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const httpsOf = (value: unknown): string => (typeof value === 'string' && value.length <= MAX_URL && value.startsWith('https://') ? value : '');

function pointOf(raw: unknown): WorkMapObservation['point'] {
  if (!isFields(raw) || !finite(raw.lat) || !finite(raw.lng)) return undefined;
  return Math.abs(raw.lat) <= 90 && Math.abs(raw.lng) <= 180 ? { lat: raw.lat, lng: raw.lng } : undefined;
}

function photoOf(raw: unknown): WorkMapObservationPhoto | null {
  if (!isFields(raw)) return null;
  const url = httpsOf(raw.url);
  if (!url) return null;
  const thumbnailUrl = httpsOf(raw.thumbnailUrl);
  const stage = STAGES.find((one) => one === raw.stage);
  return { url, ...(thumbnailUrl ? { thumbnailUrl } : {}), ...(stage ? { stage } : {}) };
}

const photosOf = (raw: unknown): WorkMapObservationPhoto[] =>
  (Array.isArray(raw) ? raw.map(photoOf).filter((photo): photo is WorkMapObservationPhoto => photo !== null).slice(0, MAX_PHOTOS) : []);

/** The optional fields: each one only when it is what it says. */
function extrasOf(raw: Fields): Partial<WorkMapObservation> {
  const extras: Partial<WorkMapObservation> = {};
  const point = pointOf(raw.point);
  if (point) extras.point = point;
  const streetId = textOf(raw.streetId, MAX_ID);
  if (streetId) extras.streetId = streetId;
  if (finite(raw.fromM)) extras.fromM = raw.fromM;
  if (finite(raw.toM)) extras.toM = raw.toM;
  const resolutionNote = textOf(raw.resolutionNote, MAX_TEXT);
  if (resolutionNote) extras.resolutionNote = resolutionNote;
  const createdAt = textOf(raw.createdAt, MAX_DATE);
  if (createdAt) extras.createdAt = createdAt;
  const resolvedAt = textOf(raw.resolvedAt, MAX_DATE);
  if (resolvedAt) extras.resolvedAt = resolvedAt;
  return extras;
}

function observationOf(raw: unknown): WorkMapObservation | null {
  if (!isFields(raw)) return null;
  const id = textOf(raw._id, MAX_ID);
  const text = textOf(raw.text, MAX_TEXT);
  const status = STATUSES.find((one) => one === raw.status);
  if (!id || !text || !status) return null;
  return { id, text, status, ...extrasOf(raw), photos: photosOf(raw.photos) };
}

/** Portal's `workObservations`, each one checked; the open ones first, as Portal lists them. */
export function workMapObservationsOf(raw: unknown): WorkMapObservation[] {
  if (!Array.isArray(raw)) return [];
  const observations = raw.slice(0, MAX_OBSERVATIONS).map(observationOf).filter((one): one is WorkMapObservation => one !== null);
  return [...observations.filter((one) => one.status === 'open'), ...observations.filter((one) => one.status === 'resolved')];
}

/** Where the placed observations are, to frame a map without streets. */
export function observationsBounds(observations: readonly WorkMapObservation[]): [[number, number], [number, number]] | null {
  const points = observations.flatMap((one) => (one.point ? [one.point] : []));
  if (!points.length) return null;
  const [lngs, lats] = [points.map((point) => point.lng), points.map((point) => point.lat)];
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}
