import { FORMS_LEVEL } from './appForms.js';
import type { CommandResponse } from './botCommands.js';
import { photoUploadOf, type DriveUpload } from './driveUpload.js';
import { formFilesWriteStore, type WriteKind } from './formFilesWrite.js';
import { AREA_FIELD_METHODS, AREA_METHOD_LABELS, type AreaDraftPoint, type AreaFigures, type AreaMethod } from './areaMeasure.js';
import type { ObservationSource } from './observationWrite.js';
import { ENLACE_DE_DESCARGA } from './invitacion.js';
import type { NearStreet } from './fieldAutofill.js';
import { stationLabel } from './workMap.js';

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
export const AREAS_OPEN_HERE = true;

/**
 * The phone PWA no longer measures (José 15/11, to cut the margin of error; design la-11): a banner sends
 * the measuring to the APK, and the sheet is still read and edited here.
 */
export const MEASURE_IN_APK = {
  kicker: 'Medición',
  title: 'Se mide en el APK',
  why: 'Con la cámara (AR) y un lado medido con wincha hay menos error que midiendo sobre una foto.',
  open: 'Abrir en el APK',
  install: '¿No tienes el APK? Instalar Lilachat',
  iphone: 'Mide desde un teléfono Android con el APK de Lilachat.',
} as const;

const APK_PACKAGE = 'com.lilachat.app';

/** Android opens the APK (LilaStore if it is missing); an iPhone can neither open nor install an APK. */
export function measureInApkLinks(iphone: boolean): { open: string | null; install: string | null } {
  if (iphone) return { open: null, install: null };
  const fallback = encodeURIComponent(ENLACE_DE_DESCARGA);
  return { open: `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${APK_PACKAGE};S.browser_fallback_url=${fallback};end`, install: ENLACE_DE_DESCARGA };
}

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
const METHODS: readonly AreaMethod[] = ['medidas-iphone', 'a-mano', 'ar-app', 'ar', 'foto-medida'];
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
  return reportId && areaId ? { reportId, areaId, ...kept('code', code), upload: response.upload ?? photoUploadOf(data.upload) } : null;
}

export const AREA_WRITE_FAILED = 'No se pudo guardar el área. Revisa tu señal y vuelve a intentarlo.';

/** «Quitar área» (Portal's `quitar`): only the area; Portal takes it off the table and trashes its photos. */
export type AreaRemoveRequest = { kind: 'area_remove'; area_id: string; forms: number };
export const areaRemoveRequest = (areaId: string): AreaRemoveRequest => ({ kind: 'area_remove', area_id: areaId, forms: FORMS_LEVEL });
export const AREA_REMOVED = 'Área quitada.';
export const AREA_REMOVE_FAILED = 'No se pudo quitar el área. Revisa tu señal y vuelve a intentarlo.';
/**
 * «Guardar cambios» on a zone (design la-06, Portal's `editar`). Portal rewrites the whole
 * measure, GPS included, so the zone's own figures go again with the new thickness; the
 * office's areas (measured on their photos) are not edited from the field.
 */
export type AreaEditRequest = {
  kind: 'area_edit'; area_id: string; length_m?: number; width_m?: number; area_m2: number; thickness_cm?: number;
  method: AreaMethod; lat?: number; lng?: number; precision_m?: number; source: ObservationSource; report_id?: string; forms: number;
};
export function areaEditRequest(report: Pick<AreaDocument, 'id' | 'type'> | null, area: AdditionalArea, thicknessCm: number | null): AreaEditRequest | null {
  if (!isRemovableArea(area) || !area.method) return null;
  const located = area.lat !== null && area.lng !== null;
  return {
    kind: 'area_edit', area_id: area.id,
    ...kept('length_m', area.lengthM), ...kept('width_m', area.widthM), area_m2: area.areaM2, ...kept('thickness_cm', thicknessCm ?? undefined),
    method: area.method, ...(located ? { lat: area.lat!, lng: area.lng!, ...kept('precision_m', area.precisionM) } : {}),
    source: 'apk', ...(report?.id && report.type === AREA_TYPE ? { report_id: report.id } : {}), forms: FORMS_LEVEL,
  };
}
export const AREA_EDITED = 'Zona corregida.';
export const AREA_EDIT_FAILED = 'No se pudo guardar la zona. Revisa tu señal y vuelve a intentarlo.';

export const areaRemoveAsk = (item?: string): { title: string; hint: string } => ({ title: item ? `¿Quitar el área ${item}?` : '¿Quitar esta área?', hint: 'Sale del cuadro y sus fotos van a la papelera de Portal.' });
/** Portal only lets the field remove what the field measured: an area measured on its photos is the office's. */
export const isRemovableArea = (area: Pick<AdditionalArea, 'method'>): boolean => area.method !== null && AREA_FIELD_METHODS.includes(area.method);
const AREA_WRITE: WriteKind<AreaAnswer> = { failed: AREA_WRITE_FAILED, answerOf: areaAnswerOf, who: 'El área' };

/** One screen's write of an area: the area, then its photos (the Medición capture marked). */
export const areaWriteStore = () => formFilesWriteStore(AREA_WRITE, areaPlaceValues, AREA_WRITE_FAILED);

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LONG_DAY = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The report's day for la-01's header: Portal's date-only `fecha` read in UTC, so it never shows the day before. */
export function areaReportDay(date: string | undefined): string | null {
  const match = date ? DAY_ONLY.exec(date) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day) return null;
  return LONG_DAY.format(instant).replace(/,/g, '');
}

/**
 * Where a zone is (José 15/11: «la zona o tramo lo debe sacar de mi GPS»): the
 * work-map street the engineer stands on with its station, else the street of
 * the address under the GPS.
 */
export function zonePlaceLine(near: NearStreet | null, street: string | null): string | null {
  if (near) return `${near.name} ${stationLabel(near.measureM)}`;
  const written = street?.trim();
  return written ? written : null;
}
