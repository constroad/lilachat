import { FORMS_LEVEL } from './appForms.js';
import type { CommandResponse } from './botCommands.js';
import type { DriveUpload } from './driveUpload.js';
import { formFilesWriteStore, type WriteKind } from './formFilesWrite.js';
import { AREA_METHOD_LABELS, type AreaDraftPoint, type AreaFigures, type AreaMethod } from './areaMeasure.js';
import type { ObservationSource } from './observationWrite.js';

/**
 * The additional-area report (IAA) filled from the client's channel (José
 * 12/11, option B; Portal's proposed contract of the same day). Portal reads it
 * with `informe_area_adicional` and writes each area with
 * `registrar_area_adicional`; every area typed here is `manual: true` for
 * Portal, so its photos never reset it to 0. `verificar` and `aproximada` are
 * Portal's marks: read, never sent. PURE.
 */
export const AREA_TYPE = 'IAA';
/** Off until Portal publishes its tools (after the Lilachat embed, the order José approved 12/11). */
export const AREAS_OPEN_HERE = false;

export type AreaPhoto = { url: string; thumbUrl?: string; mime: string; capture?: true };
export type AdditionalArea = {
  id: string; item?: string; place?: string; description?: string;
  lengthM?: number; widthM?: number; thicknessCm?: number; areaM2: number; volumeM3?: number;
  method: AreaMethod | null; lat: number | null; lng: number | null; precisionM?: number; approximate?: true; photos: AreaPhoto[];
};
export type AreaTotals = { areaM2: number; volumeM3: number };
/** `loosePhotos`: Portal's photos with no area (`fotosSinArea`), shown under the report so none stays only in Portal. */
export type AreaDocument = { id: string; code?: string; type: typeof AREA_TYPE; status: string; date?: string; areas: AdditionalArea[]; loosePhotos: AreaPhoto[]; totals: AreaTotals };

type Raw = Record<string, unknown>;
const AREAS_MAX = 300;
/** Portal's real reports have an area with 85 photos (agentes 3006ed9 lets 100 through). */
const PHOTOS_MAX = 100;
const METHODS: readonly AreaMethod[] = ['medidas-iphone', 'a-mano', 'ar-app', 'foto-medida'];
const record = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});
const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const numeric = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
/** Portal's Spanish key, or this module's own English one when it reads its own output. */
const either = (raw: Raw, spanish: string, english: string): unknown => raw[spanish] ?? raw[english];
const kept = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined || value === '' ? {} : ({ [key]: value } as Record<K, V>));

function photoOf(raw: unknown): AreaPhoto | null {
  const photo = record(raw);
  const url = trimmed(photo.url);
  if (!url.startsWith('https://')) return null;
  const mime = trimmed(photo.mime) || (/\.(mp4|mov)(\?|$)/i.test(url) ? 'video/mp4' : 'image/jpeg');
  const capture = photo.captura === true || photo.capture === true;
  return { url, ...kept('thumbUrl', trimmed(either(photo, 'thumbnailUrl', 'thumbUrl'))), mime, ...(capture ? { capture: true as const } : {}) };
}

const photosOf = (raw: unknown): AreaPhoto[] => (Array.isArray(raw) ? raw : []).flatMap((one) => photoOf(one) ?? []).slice(0, PHOTOS_MAX);

function pointOf(raw: Raw): Pick<AdditionalArea, 'lat' | 'lng'> {
  const [lat, lng] = [numeric(raw.lat), numeric(raw.lng)];
  return lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : { lat: null, lng: null };
}

function figuresOf(raw: Raw): Omit<AdditionalArea, 'id' | 'areaM2' | 'method' | 'lat' | 'lng' | 'photos'> {
  return {
    ...kept('lengthM', numeric(either(raw, 'largoM', 'lengthM'))),
    ...kept('widthM', numeric(either(raw, 'anchoM', 'widthM'))),
    ...kept('thicknessCm', numeric(either(raw, 'espesorCm', 'thicknessCm'))),
  };
}

function areaOf(raw: unknown): AdditionalArea | null {
  const area = record(raw);
  const id = trimmed(area.id);
  const areaM2 = numeric(area.areaM2);
  if (!id || areaM2 === undefined) return null;
  const method = METHODS.find((one) => one === either(area, 'metodo', 'method')) ?? null;
  const precisionM = numeric(area.precisionM);
  const approximate = area.aproximada === true || area.approximate === true;
  return {
    id, ...kept('item', trimmed(area.item)), ...kept('place', trimmed(either(area, 'ubicacion', 'place'))), ...kept('description', trimmed(either(area, 'descripcion', 'description'))),
    ...figuresOf(area), areaM2, ...kept('volumeM3', numeric(either(area, 'volumenM3', 'volumeM3'))),
    method, ...pointOf(area), ...kept('precisionM', precisionM), ...(approximate ? { approximate: true as const } : {}),
    photos: photosOf(either(area, 'fotos', 'photos')),
  };
}

const hundredths = (value: number) => Math.round(value * 100) / 100;
const thousandths = (value: number) => Math.round(value * 1000) / 1000;

function totalsOf(raw: unknown, areas: readonly AdditionalArea[]): AreaTotals {
  const totals = record(raw);
  const [areaM2, volumeM3] = [numeric(totals.areaM2), numeric(either(totals, 'volumenM3', 'volumeM3'))];
  if (areaM2 !== undefined) return { areaM2, volumeM3: volumeM3 ?? 0 };
  return { areaM2: hundredths(areas.reduce((sum, area) => sum + area.areaM2, 0)), volumeM3: thousandths(areas.reduce((sum, area) => sum + (area.volumeM3 ?? 0), 0)) };
}

/** Portal's report, or null when the answer is not this report (no areas list). Reads its own output too. */
export function areaDocumentOf(raw: unknown): AreaDocument | null {
  const document = record(raw);
  const list = either(document, 'areas', 'areas');
  if (!Array.isArray(list)) return null;
  const areas = list.flatMap((one) => areaOf(one) ?? []).slice(0, AREAS_MAX);
  return {
    id: trimmed(document.id), ...kept('code', trimmed(either(document, 'codigo', 'code'))), type: AREA_TYPE, status: trimmed(either(document, 'estado', 'status')) || 'draft',
    ...kept('date', trimmed(either(document, 'fecha', 'date'))), areas, loosePhotos: photosOf(either(document, 'fotosSinArea', 'loosePhotos')), totals: totalsOf(either(document, 'totales', 'totals'), areas),
  };
}

const decimals = (value: number, places: number) => value.toFixed(places).replace('.', ',').replace(/\B(?=(\d{3})+,)/g, ' ');

/** «2 áreas · 17,30 m²», and the volume only when there is one. */
export function areaTotalsLine(view: { count: number; totals: AreaTotals }): string {
  const volume = view.totals.volumeM3 > 0 ? ` · ${decimals(view.totals.volumeM3, 3)} m³` : '';
  return `${view.count} ${view.count === 1 ? 'área' : 'áreas'} · ${decimals(view.totals.areaM2, 2)} m²${volume}`;
}

/** What an area's card says: «4,80 m²», «3,20 × 1,50 m», «0,240 m³» and how it was measured. */
export function areaCardLines(area: AdditionalArea): { size: string; sides: string | null; volume: string | null; method: string | null } {
  return {
    size: `${decimals(area.areaM2, 2)} m²`,
    sides: area.lengthM !== undefined && area.widthM !== undefined ? `${decimals(area.lengthM, 2)} × ${decimals(area.widthM, 2)} m` : null,
    volume: area.volumeM3 ? `${decimals(area.volumeM3, 3)} m³` : null,
    method: area.method ? AREA_METHOD_LABELS[area.method] : null,
  };
}

export type AreaCreateRequest = {
  kind: 'area_create'; entry_id: string; length_m?: number; width_m?: number; area_m2: number; thickness_cm?: number;
  method: AreaMethod; lat?: number; lng?: number; precision_m?: number; source: ObservationSource; report_id?: string; forms: number;
};
const PRECISION_MAX_M = 5000;

/** One area as the phone measured it; the place goes only when the phone gave one, the report's id only from the report itself. */
export function areaCreateRequest(report: Pick<AreaDocument, 'id' | 'type'> | null, entryId: string, figures: AreaFigures, point: AreaDraftPoint | null, method: AreaMethod, source: ObservationSource): AreaCreateRequest {
  const precision = point?.precision;
  return {
    kind: 'area_create', entry_id: entryId,
    ...kept('length_m', figures.lengthM), ...kept('width_m', figures.widthM), area_m2: figures.areaM2, ...kept('thickness_cm', figures.thicknessCm),
    method, ...(point ? { lat: point.lat, lng: point.lng } : {}),
    ...(precision !== undefined && Number.isFinite(precision) && precision >= 0 && precision <= PRECISION_MAX_M ? { precision_m: Math.round(precision) } : {}),
    source, ...(report?.id && report.type === AREA_TYPE ? { report_id: report.id } : {}), forms: FORMS_LEVEL,
  };
}

/** The two optional texts; blank goes as nothing (Portal fills the street and «Bacheo localizado»). */
export function areaPlaceValues(input: { place: string; note: string }): Record<string, string> {
  return { ...kept('ubicacion', input.place.trim()), ...kept('descripcion', input.note.trim()) };
}

export type AreaAnswer = { reportId: string; areaId: string; code?: string; upload: DriveUpload | null };

export function areaAnswerOf(response: CommandResponse): AreaAnswer | null {
  const data = response.data ?? {};
  const [reportId, areaId, code] = [trimmed(data.informeId), trimmed(data.areaId), trimmed(data.codigo)];
  return reportId && areaId ? { reportId, areaId, ...kept('code', code), upload: response.upload ?? null } : null;
}

export const AREA_WRITE_FAILED = 'No se pudo guardar el área. Revisa tu señal y vuelve a intentarlo.';
const AREA_WRITE: WriteKind<AreaAnswer> = { failed: AREA_WRITE_FAILED, answerOf: areaAnswerOf, who: 'El área' };

/** One screen's write of an area: the area, then its photos (the Medición capture marked). */
export const areaWriteStore = () => formFilesWriteStore(AREA_WRITE, areaPlaceValues, AREA_WRITE_FAILED);
