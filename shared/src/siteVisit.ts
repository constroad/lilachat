import { validateFormSpec, type AppForm, type FormSchema } from './appForms.js';

/**
 * A technical visit from the phone (José 13/11, Portal `specs/modules/PRIMERA-VISITA.spec.md` §9;
 * designs lv01–lv03). Portal keeps the visit and answers its document through agentes
 * (`visit.draft.requested`); here it is read and turned into what the screens draw: the card's
 * figures, the points, the interview and what is still missing to finish. PURE.
 */

/**
 * The visit is an item of the app (José 14/11: «desde Lilachat yo indico a qué miembros»): the space admin
 * turns it on in «Comandos» and picks the 1:1, the channels and who. Not a command: never offered in the ⚡ or «/».
 */
export const SITE_VISIT_SHORTCUT = 'visita_tecnica';
/** The phone's visit screens follow lv01–lv04 (the card in the chat); until then the door answers closed. */
export const SITE_VISIT_SCREENS_READY: boolean = false;
/** Portal: the place is approximate past 15 m. */
export const VISIT_APPROXIMATE_M = 15;
export const VISIT_POINT_NOTE_MAX = 200;
export const VISIT_MEASURE_MAX = 1_000_000;
export const VISIT_MAX_POINTS = 60;

export type VisitStage = 'draft' | 'toQuote' | 'quoted' | 'won' | 'lost';
export type VisitPointType = 'GIBA' | 'BUZON' | 'TAPA_SERVICIO' | 'REJILLA' | 'BACHE' | 'SARDINEL' | 'ACCESO' | 'CABLE_AEREO' | 'POSTE' | 'ARBOL' | 'TUBERIA_EXPUESTA' | 'OTRO';
export type VisitMeasureUnit = 'm' | 'm2' | 'cm' | 'u';
export type VisitSectionState = 'empty' | 'partial' | 'done';

/** Portal's 12 point types, in its order (the chip grid of lv02, three per row). */
export const VISIT_POINT_TYPES: readonly { value: VisitPointType; label: string; short: string }[] = [
  { value: 'GIBA', label: 'Giba o rompemuelle', short: 'Giba' },
  { value: 'BUZON', label: 'Buzón', short: 'Buzón' },
  { value: 'TAPA_SERVICIO', label: 'Tapa de servicio', short: 'Tapa' },
  { value: 'REJILLA', label: 'Rejilla o sumidero', short: 'Rejilla' },
  { value: 'BACHE', label: 'Bache o falla', short: 'Bache' },
  { value: 'SARDINEL', label: 'Sardinel o vereda', short: 'Sardinel' },
  { value: 'ACCESO', label: 'Acceso o portón', short: 'Acceso' },
  { value: 'CABLE_AEREO', label: 'Cable aéreo', short: 'Cable' },
  { value: 'POSTE', label: 'Poste', short: 'Poste' },
  { value: 'ARBOL', label: 'Árbol', short: 'Árbol' },
  { value: 'TUBERIA_EXPUESTA', label: 'Tubería expuesta', short: 'Tubería' },
  { value: 'OTRO', label: 'Otro', short: 'Otro' },
];
export const VISIT_MEASURE_UNITS: readonly { value: VisitMeasureUnit; label: string }[] = [
  { value: 'm', label: 'm' },
  { value: 'm2', label: 'm²' },
  { value: 'cm', label: 'cm' },
  { value: 'u', label: 'und.' },
];

export type VisitMedia = { url: string; thumbUrl?: string; mime: string };
export type VisitPoint = { id: string; n: number; type: string; typeLabel: string; note?: string; measure?: { value: number; unit: string }; lat: number; lng: number; at: string | null; precisionM?: number; approximate?: true; media: VisitMedia[] };
export type VisitSection = { id: string; title: string; required: boolean; state: VisitSectionState; summary: string[]; form?: string; tool?: string; values: Record<string, string> };
export type VisitDetails = { prospect: string; contact?: string; phone?: string; place: string; lat?: number; lng?: number; precisionM?: number; approximate?: true; date: string | null; engineer: string };
export type VisitFigures = { points: number; photos: number; questions: number; answered: number };
export type VisitMapPoint = { pointId: string; n: number; type: string; lat: number; lng: number };
export type VisitDocument = {
  id: string | null;
  code: string;
  title: string;
  finished: boolean;
  stage: VisitStage;
  stageLabel: string;
  details: VisitDetails | null;
  figures: VisitFigures;
  forms: Record<string, FormSchema>;
  sections: VisitSection[];
  points: VisitPoint[];
  loosePhotos: VisitMedia[];
  map: { points: VisitMapPoint[] };
  publish: { label: string; missing: string[] };
};
export type OpenVisitRow = { id: string; code: string; prospect: string; place: string; visitedAt: string | null; engineer: string; stage: VisitStage; stageLabel: string; points: number };

type Raw = Record<string, unknown>;
const STAGES: readonly VisitStage[] = ['draft', 'toQuote', 'quoted', 'won', 'lost'];
const STATES: readonly VisitSectionState[] = ['empty', 'partial', 'done'];
const record = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const textMap = (value: unknown): Record<string, string> => Object.fromEntries(Object.entries(record(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
const stageOf = (value: unknown): VisitStage => (STAGES.includes(value as VisitStage) ? (value as VisitStage) : 'draft');
const isHttps = (url: string): boolean => url.startsWith('https://');

function mediaOf(raw: unknown): VisitMedia | null {
  const one = record(raw);
  const url = text(one.url);
  if (!isHttps(url)) return null;
  const thumb = text(one.thumbUrl);
  return { url, ...(isHttps(thumb) ? { thumbUrl: thumb } : {}), mime: text(one.mime) || 'image/jpeg' };
}
const mediaList = (raw: unknown): VisitMedia[] => list(raw).map(mediaOf).filter((one): one is VisitMedia => one !== null);

/** Portal sends the measure as `{value, unit}`; a bare number has no unit and is not shown as one. */
function measureOf(raw: unknown): VisitPoint['measure'] {
  const one = record(raw);
  const value = num(one.value);
  const unit = text(one.unit);
  return value !== undefined && unit ? { value, unit } : undefined;
}

function pointOf(raw: unknown): VisitPoint | null {
  const one = record(raw);
  const id = text(one.id);
  const n = num(one.n);
  const lat = num(one.lat);
  const lng = num(one.lng);
  if (!id || n === undefined || lat === undefined || lng === undefined) return null;
  const note = text(one.note);
  const measure = measureOf(one.measure);
  const precisionM = num(one.precisionM);
  return {
    id, n, type: text(one.tipo), typeLabel: text(one.tipoLabel) || text(one.tipo), lat, lng, at: text(one.at) || null, media: mediaList(one.media),
    ...(note ? { note } : {}), ...(measure ? { measure } : {}), ...(precisionM !== undefined ? { precisionM } : {}), ...(one.aproximada === true ? { approximate: true as const } : {}),
  };
}

function sectionOf(raw: unknown): VisitSection | null {
  const one = record(raw);
  const id = text(one.id);
  if (!id) return null;
  const form = text(one.form);
  const tool = text(one.tool);
  return {
    id, title: text(one.title) || id, required: one.required === true, state: STATES.includes(one.state as VisitSectionState) ? (one.state as VisitSectionState) : 'empty',
    summary: list(one.summary).map(text).filter(Boolean), values: textMap(one.values), ...(form ? { form } : {}), ...(tool ? { tool } : {}),
  };
}

function detailsOf(raw: unknown): VisitDetails | null {
  const one = record(raw);
  const prospect = text(one.prospecto);
  if (!prospect) return null;
  const contact = text(one.contacto);
  const phone = text(one.telefono);
  const [lat, lng, precisionM] = [num(one.lat), num(one.lng), num(one.precisionM)];
  return {
    prospect, place: text(one.lugar), date: text(one.fecha) || null, engineer: text(one.ingeniero),
    ...(contact ? { contact } : {}), ...(phone ? { phone } : {}), ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    ...(precisionM !== undefined ? { precisionM } : {}), ...(one.aproximada === true ? { approximate: true as const } : {}),
  };
}

function figuresOf(raw: unknown, points: number, photos: number): VisitFigures {
  const one = record(raw);
  return { points: num(one.puntos) ?? points, photos: num(one.fotos) ?? photos, questions: num(one.preguntas) ?? 0, answered: num(one.respondidas) ?? 0 };
}

const formsOf = (raw: unknown): Record<string, FormSchema> =>
  Object.fromEntries(Object.entries(record(raw)).filter(([, schema]) => record(schema).type === 'object').map(([key, schema]) => [key, schema as FormSchema]));

/** The visit's document as Portal answered it (agentes `visit.draft.requested`); null for anything else. */
export function visitDocumentOf(raw: unknown): VisitDocument | null {
  const doc = record(raw);
  if (doc.type !== 'VIS') return null;
  const sections = list(doc.sections).map(sectionOf).filter((one): one is VisitSection => one !== null);
  const rawSections = list(doc.sections).map(record);
  const points = list(rawSections.find((one) => one.id === 'puntos')?.items).map(pointOf).filter((one): one is VisitPoint => one !== null).sort((a, b) => a.n - b.n);
  const loosePhotos = list(rawSections.find((one) => one.id === 'fotos')?.items).flatMap((item) => mediaList(record(item).media));
  const publish = record(doc.publish);
  const mapPoints = list(record(doc.map).points).map((one) => {
    const point = record(one);
    const [n, lat, lng] = [num(point.n), num(point.lat), num(point.lng)];
    return text(point.pointId) && n !== undefined && lat !== undefined && lng !== undefined ? { pointId: text(point.pointId), n, type: text(point.tipo), lat, lng } : null;
  }).filter((one): one is VisitMapPoint => one !== null);
  const id = text(doc.id) || null;
  return {
    id, code: text(doc.code), title: text(doc.title) || 'Visita técnica', finished: doc.status === 'completed', stage: stageOf(doc.stage), stageLabel: text(doc.stageLabel) || 'Borrador',
    details: detailsOf(doc.datos), figures: figuresOf(doc.cifras, points.length, loosePhotos.length), forms: formsOf(doc.forms), sections, points, loosePhotos,
    map: { points: mapPoints }, publish: { label: text(publish.label) || 'Terminar visita', missing: list(publish.missing).map(text).filter(Boolean) },
  };
}

/** The open visits Portal lists with a new visit (up to 20): continue one or start another. */
export function openVisitRowsOf(raw: unknown): OpenVisitRow[] {
  return list(raw).map((one) => {
    const row = record(one);
    const id = text(row.id);
    return id ? { id, code: text(row.code), prospect: text(row.prospect), place: text(row.place), visitedAt: text(row.visitedAt) || null, engineer: text(row.engineer), stage: stageOf(row.stage), stageLabel: text(row.stageLabel) || 'Borrador', points: num(row.points) ?? 0 } : null;
  }).filter((one): one is OpenVisitRow => one !== null);
}

/** The visit a card stands for: agentes keys it `<integration>:visita:<visitId>` (14/11). */
export function visitIdOfKey(key: string | undefined): string | null {
  const at = key?.lastIndexOf(':visita:') ?? -1;
  const id = at >= 0 ? key!.slice(at + ':visita:'.length) : '';
  return /^[a-f0-9]{24}$/i.test(id) ? id : null;
}

export type VisitNextStep =
  | { kind: 'start'; label: string }
  | { kind: 'point'; label: string }
  | { kind: 'interview'; label: string; unanswered: number }
  | { kind: 'finish'; label: string }
  | { kind: 'missing'; label: string }
  | { kind: 'finished'; label: string };

/**
 * The one button at the bottom (spec §9.3): it does what comes next. A new visit starts; without
 * points it marks one; with questions unanswered it goes on with the interview; with nothing missing,
 * «Terminar»; a finished visit only shows its PDF.
 */
export function visitNextStep(document: VisitDocument): VisitNextStep {
  if (!document.id) return { kind: 'start', label: 'Crear visita' };
  if (document.finished) return { kind: 'finished', label: 'Ver PDF' };
  if (document.figures.points === 0 && document.figures.photos === 0) return { kind: 'point', label: 'Marcar el primer punto' };
  const unanswered = document.figures.questions - document.figures.answered;
  if (unanswered > 0) return { kind: 'interview', label: `Siguiente: ${unanswered} sin responder`, unanswered };
  if (document.publish.missing.length > 0) return { kind: 'missing', label: `Falta: ${document.publish.missing[0]}` };
  return { kind: 'finish', label: document.publish.label };
}

/** The next point's number: «Guardar punto 4». */
export const nextPointNumber = (document: VisitDocument): number => document.points.reduce((top, point) => Math.max(top, point.n), 0) + 1;

/** «Giba · 4 m»: what a point says in its row and on the map. */
export function pointLine(point: VisitPoint): string {
  const short = VISIT_POINT_TYPES.find((option) => option.value === point.type)?.short ?? point.typeLabel;
  const unit = VISIT_MEASURE_UNITS.find((option) => option.value === point.measure?.unit)?.label ?? point.measure?.unit;
  return point.measure ? `${short} · ${String(point.measure.value).replace('.', ',')} ${unit}` : short;
}

export type VisitPointDraft = { type: string; note?: string; measure?: number; unit?: string; lat: number; lng: number; precisionM?: number };

/** Portal asks a measure and its unit together, within its range. */
function measureProblem(draft: VisitPointDraft): string | null {
  if ((draft.measure === undefined) !== (draft.unit === undefined)) return draft.unit === undefined ? 'La medida necesita su unidad.' : 'La unidad necesita su medida.';
  if (draft.measure !== undefined && (draft.measure < 0 || draft.measure > VISIT_MEASURE_MAX)) return 'Esa medida no es posible.';
  if (draft.unit !== undefined && !VISIT_MEASURE_UNITS.some((option) => option.value === draft.unit)) return 'Elige la unidad.';
  return null;
}

/** What «Guardar punto» may send, checked as Portal checks it; the first problem is said in the screen. */
export function pointProblem(draft: VisitPointDraft, document: VisitDocument): string | null {
  if (!VISIT_POINT_TYPES.some((option) => option.value === draft.type)) return 'Elige qué es.';
  if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.lng) || Math.abs(draft.lat) > 90 || Math.abs(draft.lng) > 180) return 'Falta la ubicación del GPS.';
  const measure = measureProblem(draft);
  if (measure) return measure;
  if ((draft.note?.length ?? 0) > VISIT_POINT_NOTE_MAX) return `La nota lleva hasta ${VISIT_POINT_NOTE_MAX} letras.`;
  if (document.points.length >= VISIT_MAX_POINTS) return `Una visita lleva hasta ${VISIT_MAX_POINTS} puntos.`;
  return null;
}

/** A section's form, with its saved values as the starting answers (Portal sends the schema; the phone never invents it). */
export function visitSectionForm(document: VisitDocument, sectionId: 'datos' | 'entrevista' | 'conclusion'): AppForm | null {
  const section = document.sections.find((one) => one.id === sectionId);
  const schema = section?.form ? document.forms[section.form] : undefined;
  if (!section || !schema) return null;
  const properties = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, property]) => [key, section.values[key] !== undefined ? { ...property, default: section.values[key] } : property]));
  const checked = validateFormSpec({ id: 'guardar_visita', title: section.title, schema: { ...schema, properties } });
  return checked.ok ? { ...checked.form, submitLabel: 'Guardar' } : null;
}

/** Portal's ticket for a visit's photos (14/11): sent straight to Portal, never through Lilachat; 30 minutes. */
export type VisitUpload = { url: string; method: 'POST'; fields: Record<string, string>; fileField: string; expiresAt: string; maxBytes: number; mimeTypes: string[] };
const VISIT_TICKET_PATH = /^https:\/\/([a-z0-9-]+\.)*constroad\.com(:\d+)?\/api\/public\/site-visit-upload\/[^/?#]+$/i;
const PHOTO_TYPE = /^image\/(jpeg|png|webp)$/;

/** The ticket as the point's answer carries it (`data.upload`); anything off the contract is no ticket. */
export function visitUploadOf(raw: unknown): VisitUpload | null {
  const one = record(raw);
  const fields = record(one.fields);
  const fieldsOk = Object.values(fields).every((value) => typeof value === 'string');
  const url = text(one.url);
  const fileField = text(one.fileField);
  const expiresAt = text(one.expiresAt);
  const maxBytes = num(one.maxBytes);
  const mimeTypes = list(one.mimeTypes).map(text).filter((type) => PHOTO_TYPE.test(type));
  if (!VISIT_TICKET_PATH.test(url) || one.method !== 'POST' || !fieldsOk || !fileField || Number.isNaN(Date.parse(expiresAt)) || !maxBytes || maxBytes <= 0 || !mimeTypes.length) return null;
  return { url, method: 'POST', fields: fields as Record<string, string>, fileField, expiresAt, maxBytes, mimeTypes };
}

/** What a saved point answers (`marcar_punto_de_visita`): its id and number, and the ticket for its photos. */
export function markedPointOf(data: unknown): { pointId: string; n: number; upload: VisitUpload | null } | null {
  const one = record(data);
  const pointId = text(one.puntoId);
  const n = num(one.n);
  return pointId && n !== undefined ? { pointId, n, upload: visitUploadOf(one.upload) } : null;
}
