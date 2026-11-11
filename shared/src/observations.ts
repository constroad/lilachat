import type { DocumentStatus } from './fieldDocument.js';
import { lineLengthM, stationLabel, workMapView, type WorkMapPoint, type WorkMapView } from './workMap.js';
import { EMPTY_WORK_MAP } from './workMapDays.js';
import { placeOnStreets } from './workMapPhotos.js';
import type { ServiceFile } from './serviceFiles.js';
import type { DischargePin } from './workMapProgress.js';

/**
 * Observations registered and lifted from the client's channel (José
 * 11/11/2026, designs `ob-01`…`ob-07b`; contract with Portal ead85b1a and
 * agentes 275fb32 in spec INFORMES-DESDE-LILACHAT §13). Portal keeps them and
 * rebuilds the report from the work map on every write: this reads its
 * document and says what the screens draw. PURE.
 */
export const OBSERVATION_REPORT_TYPES = ['REG-OBS', 'LEV-OBS'] as const;
export type ObservationReportType = (typeof OBSERVATION_REPORT_TYPES)[number];
export const REGISTRY_TYPE: ObservationReportType = 'REG-OBS';
export const LIFTING_TYPE: ObservationReportType = 'LEV-OBS';
/**
 * Off until José approves Portal's three tools in Agentes (until then they
 * answer 502): both types open Portal's page meanwhile (Portal, 11/11).
 */
export const OBSERVATIONS_OPEN_HERE = false;
/** Portal's ticket says it again; the camera stops here. */
export const OBSERVATION_VIDEO_SECONDS = 30;
export const OBSERVATION_NOTE_MAX = 600;

export type ObservationMedia = { url: string; thumbUrl?: string; mime: string; durationS?: number };
export type ObservationStatus = 'open' | 'lifted';
export type ObservationSegment = { streetId: string; fromM: number; toM: number };
/** `lat`/`lng` null: agentes drops a place out of range rather than the observation. */
export type Observation = {
  id: string;
  code: string;
  note: string;
  lat: number | null;
  lng: number | null;
  at: string | null;
  status: ObservationStatus;
  liftedAt?: string;
  liftNote?: string;
  media: ObservationMedia[];
  liftMedia: ObservationMedia[];
  segment?: ObservationSegment;
};
export type ObservationStreet = { id: string; name: string; geometry: WorkMapPoint[] };
export type ObservationMap = { streets: ObservationStreet[]; imageUrl?: string };
export type ObservationDocument = { id: string | null; type: ObservationReportType; title: string; status: DocumentStatus; observations: Observation[]; map: ObservationMap; publish: { label: string; missing: string[] } };

export const isObservationType = (value: unknown): value is ObservationReportType => OBSERVATION_REPORT_TYPES.includes(value as ObservationReportType);

type Raw = Record<string, unknown>;
const OBSERVATIONS_SECTION = 'observaciones';
const ITEMS_MAX = 200;
const MEDIA_MAX = 10;
const recordOf = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const optional = <K extends string, V>(key: K, value: V | null | undefined | ''): Partial<Record<K, V>> => (value === null || value === undefined || value === '' ? {} : ({ [key]: value } as Record<K, V>));

function mediaOf(raw: unknown): ObservationMedia | null {
  const media = recordOf(raw);
  const url = textOf(media.url);
  const mime = textOf(media.mime);
  const seconds = finite(media.durationS);
  if (!url.startsWith('https://') || !/^(image|video)\//.test(mime)) return null;
  return { url, mime, ...optional('thumbUrl', textOf(media.thumbUrl)), ...(seconds && seconds > 0 ? { durationS: seconds } : {}) };
}

const mediaListOf = (raw: unknown): ObservationMedia[] => listOf(raw).flatMap((one) => mediaOf(one) ?? []).slice(0, MEDIA_MAX);

/** A place only when both halves are on the map. */
function placeOf(raw: Raw): { lat: number | null; lng: number | null } {
  const [lat, lng] = [finite(raw.lat), finite(raw.lng)];
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : { lat: null, lng: null };
}

function segmentOf(raw: unknown): ObservationSegment | null {
  const segment = recordOf(raw);
  const [fromM, toM] = [finite(segment.fromM), finite(segment.toM)];
  return textOf(segment.streetId) && fromM !== null && toM !== null ? { streetId: textOf(segment.streetId), fromM, toM } : null;
}

function observationOf(raw: unknown): Observation | null {
  const item = recordOf(raw);
  const [id, code] = [textOf(item.id), textOf(item.code)];
  if (!id || !code || (item.status !== 'open' && item.status !== 'lifted')) return null;
  return {
    id, code, note: textOf(item.note), ...placeOf(item), at: textOf(item.at) || null, status: item.status,
    media: mediaListOf(item.media), liftMedia: mediaListOf(item.liftMedia),
    ...optional('liftedAt', textOf(item.liftedAt)), ...optional('liftNote', textOf(item.liftNote)), ...optional('segment', segmentOf(item.segment)),
  };
}

function streetOf(raw: unknown): ObservationStreet | null {
  const street = recordOf(raw);
  const geometry = listOf(street.geometry).flatMap((point) => { const place = placeOf(recordOf(point)); return place.lat !== null && place.lng !== null ? [{ lat: place.lat, lng: place.lng }] : []; });
  return textOf(street.id) && geometry.length >= 2 ? { id: textOf(street.id), name: textOf(street.name), geometry } : null;
}

function mapOf(raw: unknown): ObservationMap {
  const map = recordOf(raw);
  const image = textOf(map.imageUrl);
  return { streets: listOf(map.streets).flatMap((one) => streetOf(one) ?? []), ...(image.startsWith('https://') ? { imageUrl: image } : {}) };
}

/** Portal's `informe_de_observaciones` document as agentes passes it; anything off the contract is no document. */
export function observationDocumentOf(body: unknown): ObservationDocument | null {
  const raw = recordOf(body);
  const publish = recordOf(raw.publish);
  if (!isObservationType(raw.type) || !raw.publish || !Array.isArray(raw.sections)) return null;
  const section = recordOf(raw.sections.find((one) => recordOf(one).id === OBSERVATIONS_SECTION));
  return {
    id: textOf(raw.id) || null, type: raw.type, title: textOf(raw.title), status: raw.status === 'published' ? 'published' : 'draft',
    observations: listOf(section.items).flatMap((one) => observationOf(one) ?? []).slice(0, ITEMS_MAX),
    map: mapOf(raw.map),
    publish: { label: textOf(publish.label), missing: listOf(publish.missing).map(textOf).filter(Boolean) },
  };
}

export const observationsIn = (observations: readonly Observation[], status: ObservationStatus): Observation[] => observations.filter((one) => one.status === status);

const PERCENT = 100;
/** Total, lifted, pending and the progress (design `ob-07b`). */
export function observationCounts(observations: readonly Observation[]): { total: number; open: number; lifted: number; percent: number } {
  const lifted = observationsIn(observations, 'lifted').length;
  const total = observations.length;
  return { total, open: total - lifted, lifted, percent: total ? Math.round((lifted / total) * PERCENT) : 0 };
}

/** MapLibre paints plain colors: pending in red, lifted in green (design `ob-01`). */
export const OBSERVATION_COLORS: Record<ObservationStatus, string> = { open: '#dc2626', lifted: '#16a34a' };
/** «OBS-003» → «3»: the pin carries the number the list shows. */
export const observationNumber = (code: string): string => code.match(/(\d+)\D*$/)?.[1]?.replace(/^0+(?=\d)/, '') ?? code;

type Placed = Observation & { lat: number; lng: number };
const isPlaced = (one: Observation): one is Placed => one.lat !== null && one.lng !== null;

export const observationPins = (observations: readonly Observation[]): DischargePin[] =>
  observations.filter(isPlaced).map((one) => ({ id: one.id, label: observationNumber(one.code), lat: one.lat, lng: one.lng, outside: false, fill: OBSERVATION_COLORS[one.status] }));

/** The work map of the service's streets; with none, the map frames the observations. */
export function observationWorkMap(map: ObservationMap, observations: readonly Observation[]): WorkMapView {
  const streets = map.streets.map((street) => ({ id: street.id, name: street.name, line: street.geometry, lengthM: lineLengthM(street.geometry) }));
  const view = workMapView({ ...EMPTY_WORK_MAP, streets });
  const placed = observations.filter(isPlaced);
  if (view.bounds || !placed.length) return view;
  const [lngs, lats] = [placed.map((one) => one.lng), placed.map((one) => one.lat)];
  return { ...view, bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] };
}

/** «Av. Los Incas 0+240»: its segment, else the street it lies on (30 m), else that it has a GPS fix. */
export function observationPlace(observation: Observation, map: ObservationMap): string {
  const streets = map.streets.map((street) => ({ id: street.id, name: street.name, line: street.geometry, lengthM: lineLengthM(street.geometry) }));
  const named = (streetId: string | null, atM: number) => { const street = streets.find((one) => one.id === streetId); return street ? `${street.name} ${stationLabel(atM)}`.trim() : null; };
  if (observation.segment) return named(observation.segment.streetId, observation.segment.fromM) ?? 'Ubicación GPS';
  if (!isPlaced(observation)) return 'Sin ubicación';
  const spot = placeOnStreets({ streets }, { id: observation.id, lat: observation.lat, lng: observation.lng, at: observation.at ?? '', kind: 'photo', url: '', thumbnailUrl: '' });
  return named(spot.streetId, spot.atM) ?? 'Ubicación GPS';
}

const SECONDS_PER_MINUTE = 60;
/** «0:18», «1:15». */
export const clipLength = (seconds: number): string => `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(Math.round(seconds % SECONDS_PER_MINUTE)).padStart(2, '0')}`;

/** The card's corner (design `ob-01`): a video with its length, else how many photos. */
export function evidenceBadge(media: readonly ObservationMedia[]): string {
  const video = media.find((one) => one.mime.startsWith('video/'));
  if (video) return video.durationS ? `VIDEO ${clipLength(video.durationS)}` : 'VIDEO';
  if (!media.length) return 'SIN EVIDENCIA';
  return media.length === 1 ? 'FOTO' : `${media.length} FOTOS`;
}

/** Peru has no daylight saving: Lima is always UTC−5. */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const two = (value: number): string => String(value).padStart(2, '0');

/** «Registrada 11/11 · 10:42», in Lima time. */
export function registeredLine(observation: Pick<Observation, 'at'>, word = 'Registrada'): string {
  const at = observation.at ? Date.parse(observation.at) : Number.NaN;
  if (Number.isNaN(at)) return word;
  const lima = new Date(at - LIMA_OFFSET_MS);
  return `${word} ${two(lima.getUTCDate())}/${two(lima.getUTCMonth() + 1)} · ${two(lima.getUTCHours())}:${two(lima.getUTCMinutes())}`;
}

export const STATUS_PILLS: Record<ObservationStatus, { label: string; tone: 'error' | 'ok' }> = { open: { label: 'Pendiente', tone: 'error' }, lifted: { label: 'Levantada', tone: 'ok' } };

/** «Marcar como levantada» waits for the after (design `ob-03`). */
export const liftBlocker = (afterFiles: number): string | null => (afterFiles > 0 ? null : 'Falta una foto o video del después');

/** The evidence as files the viewer opens: «OBS-003 · antes 1». */
export const evidenceFiles = (media: readonly ObservationMedia[], name: string): ServiceFile[] =>
  media.map((one, index) => ({ name: `${name} ${index + 1}`, mime: one.mime, url: one.url, ...(one.thumbUrl ? { thumbUrl: one.thumbUrl } : {}) }));

