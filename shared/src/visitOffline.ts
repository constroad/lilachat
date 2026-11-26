import { newFieldJob, type FieldJob, type FieldJobFile, type FieldJobScope } from './fieldQueue.js';
import { VISIT_POINT_TYPES, type OpenVisitRow, type VisitDocument, type VisitPoint, type VisitPointDraft, type VisitSection } from './siteVisit.js';
import type { VisitDraftResult, VisitPhotoPlace, VisitSectionId } from './visitFlow.js';

/**
 * The technical visit without signal (José 26/11, Aucallama: he could not make
 * the visit's report at a site without data). Every write of the visit is a job of the field
 * queue; the screen draws the visit Portal last sent (or the space's template
 * for a new one) with the queued work on top. A new visit is `local-<key>`,
 * `key` being the `entradaId` its «Datos» carries: Portal dedupes the creation
 * by it (verified 26/11), so a resend after a lost answer is the same visit.
 * The rest waits for Portal's id; «Terminar» goes last. PURE.
 */
export type VisitJobPayload =
  | { kind: 'visit_section'; visit: string; section: VisitSectionId; values: Record<string, string>; /** Only «Datos» of a new visit: it creates it. */ creates?: true; place?: { lat: number; lng: number; precisionM?: number } }
  | { kind: 'visit_point'; visit: string; point: VisitPointDraft; takenAt: string }
  | { kind: 'visit_photo'; visit: string; place: VisitPhotoPlace }
  | { kind: 'visit_finish'; visit: string };
export type VisitJobKind = VisitJobPayload['kind'];
/** A local visit's real id once its «Datos» landed: `local-…` → Portal's. */
export type ResolvedVisits = Readonly<Record<string, string>>;

export const VISIT_JOB_KINDS: readonly VisitJobKind[] = ['visit_section', 'visit_point', 'visit_photo', 'visit_finish'];
const LOCAL_PREFIX = 'local-';
export const LOCAL_VISIT_CODE = 'Sin enviar';
export const VISIT_NEVER_OPENED = 'Sin señal. Abre una visita técnica una vez con señal en este teléfono para poder hacerla sin ella.';
const VISIT_NOT_SAVED = 'Sin señal. Esta visita no está guardada en el teléfono: ábrela una vez con señal.';
const SUMMARY_LINES = 2;

export const localVisitId = (key: string): string => `${LOCAL_PREFIX}${key}`;
export const isLocalVisitId = (id: string): boolean => id.startsWith(LOCAL_PREFIX);
export const isVisitJob = (job: FieldJob): boolean => (VISIT_JOB_KINDS as readonly string[]).includes(job.kind);
const payloadOf = (job: FieldJob): VisitJobPayload => job.payload as unknown as VisitJobPayload;

/** Visit jobs hang from the visit as their «service»: the visit's strip finds them by it. */
export const visitScopeOf = (spaceId: string, chatId: string, visit: string): FieldJobScope => ({ spaceId, clientId: '', serviceId: `visit:${visit}`, chatId });

const LABELS: Record<VisitJobKind, (payload: VisitJobPayload, files: readonly FieldJobFile[]) => string> = {
  visit_section: (payload) => (payload.kind === 'visit_section' && payload.section === 'entrevista' ? 'Respuestas de la entrevista' : payload.kind === 'visit_section' && payload.creates ? 'Crear la visita' : 'Datos de la visita'),
  visit_point: () => 'Punto de la visita',
  visit_photo: (_payload, files) => (files[0]?.mime.startsWith('video/') ? 'Video de la visita' : 'Foto de la visita'),
  visit_finish: () => 'Terminar la visita',
};

export function visitJobOf(input: { key: string; spaceId: string; chatId: string; payload: VisitJobPayload; files: FieldJobFile[]; now: number }): FieldJob {
  const { payload, files } = input;
  return newFieldJob({ key: input.key, kind: payload.kind, scope: visitScopeOf(input.spaceId, input.chatId, payload.visit), label: LABELS[payload.kind](payload, files), payload: payload as unknown as Record<string, unknown>, files, now: input.now });
}

/** Portal's id for a visit reference, or `null` while a local one is still unsent. */
export const realVisitIdOf = (visit: string, resolved: ResolvedVisits): string | null => (isLocalVisitId(visit) ? resolved[visit] ?? null : visit);

/** The ids one visit is known by: its local one and, once resolved, Portal's. */
function idsOf(visit: string, resolved: ResolvedVisits): string[] {
  const local = Object.entries(resolved).find(([, real]) => real === visit)?.[0];
  const real = realVisitIdOf(visit, resolved);
  return [...new Set([visit, ...(local ? [local] : []), ...(real ? [real] : [])])];
}

/** The creation goes first and alone; the rest of a new visit waits for Portal's id; «Terminar» waits for everything else. */
export function visitJobBlocked(job: FieldJob, queue: readonly FieldJob[], resolved: ResolvedVisits): boolean {
  if (!isVisitJob(job)) return false;
  const payload = payloadOf(job);
  if (payload.kind === 'visit_section' && payload.creates) return false;
  if (realVisitIdOf(payload.visit, resolved) === null) return true;
  if (payload.kind !== 'visit_finish') return false;
  const ids = idsOf(payload.visit, resolved);
  return queue.some((other) => other.key !== job.key && isVisitJob(other) && ids.includes(payloadOf(other).visit));
}

const filled = (values: Record<string, string>) => Object.values(values).map((value) => value.trim()).filter(Boolean);

function withSection(document: VisitDocument, payload: Extract<VisitJobPayload, { kind: 'visit_section' }>): VisitDocument {
  const sections = document.sections.map((section): VisitSection => {
    if (section.id !== payload.section) return section;
    const values = { ...section.values, ...payload.values };
    const lines = filled(values);
    return { ...section, values, summary: lines.slice(0, SUMMARY_LINES), state: lines.length ? 'partial' : section.state };
  });
  const interview = sections.find((section) => section.id === 'entrevista');
  const answered = payload.section === 'entrevista' && interview ? Math.min(document.figures.questions, filled(interview.values).length) : document.figures.answered;
  return { ...document, sections, figures: { ...document.figures, answered } };
}

function withPoint(document: VisitDocument, job: FieldJob, payload: Extract<VisitJobPayload, { kind: 'visit_point' }>): VisitDocument {
  const { point } = payload;
  const n = document.points.reduce((top, one) => Math.max(top, one.n), 0) + 1;
  const typeLabel = VISIT_POINT_TYPES.find((option) => option.value === point.type)?.label ?? point.type;
  const added: VisitPoint = {
    id: job.key, n, type: point.type, typeLabel, lat: point.lat, lng: point.lng, at: payload.takenAt, media: [], pending: true,
    ...(point.note ? { note: point.note } : {}), ...(point.measure !== undefined && point.unit ? { measure: { value: point.measure, unit: point.unit } } : {}), ...(point.precisionM !== undefined ? { precisionM: point.precisionM } : {}),
  };
  const photos = document.figures.photos + (job.files.length ? 1 : 0);
  return { ...document, points: [...document.points, added], map: { points: [...document.map.points, { pointId: job.key, n, type: point.type, lat: point.lat, lng: point.lng }] }, figures: { ...document.figures, points: document.figures.points + 1, photos } };
}

function withPhoto(document: VisitDocument, job: FieldJob): VisitDocument {
  const video = job.files[0]?.mime.startsWith('video/') ?? false;
  const { figures } = document;
  return { ...document, figures: video ? { ...figures, videos: figures.videos + 1 } : { ...figures, photos: figures.photos + 1 } };
}

/**
 * The visit as it will be once its queue lands: each pending job of THIS visit drawn on top, in order.
 * Portal's «Falta: …» is dropped while anything waits: only Portal can say it again (E2E 26/11: it still
 * asked for Datos already filled), and «Terminar» goes last and hears Portal's own refusal.
 */
export function projectVisit(base: VisitDocument, queue: readonly FieldJob[], visitIds: readonly string[]): VisitDocument {
  const pending = queue.filter((job) => isVisitJob(job) && visitIds.includes(payloadOf(job).visit));
  if (!pending.length) return base;
  return pending.reduce<VisitDocument>((document, job) => {
    const payload = payloadOf(job);
    if (payload.kind === 'visit_section') return withSection(document, payload);
    if (payload.kind === 'visit_point') return withPoint(document, job, payload);
    if (payload.kind === 'visit_photo') return withPhoto(document, job);
    return document;
  }, { ...base, publish: { ...base.publish, missing: [] } });
}

/** A new visit before Portal has it: the template's forms and questions, nothing filled. */
function blankFromTemplate(template: VisitDocument, id: string): VisitDocument {
  const sections = template.sections.map((section): VisitSection => ({ ...section, values: {}, summary: [], state: 'empty' }));
  return { ...template, id, code: LOCAL_VISIT_CODE, title: 'Nueva visita', finished: false, stage: 'draft', stageLabel: LOCAL_VISIT_CODE, details: null, sections, points: [], loosePhotos: [], map: { points: [] }, figures: { ...template.figures, points: 0, photos: 0, videos: 0, answered: 0 } };
}

type OfflineInput = { visitId: string | null; saved: VisitDocument | null; template: VisitDocument | null; jobs: readonly FieldJob[]; resolved: ResolvedVisits };

/** What the visit's screen reads without signal: the saved visit (or the template) with its queue on top. */
export function visitOfflineDraft(input: OfflineInput): VisitDraftResult {
  const { visitId, saved, template, jobs, resolved } = input;
  if (visitId === null) return template ? { ok: true, document: { ...template, id: null }, visits: localVisitRows(jobs, resolved) } : { ok: false, message: VISIT_NEVER_OPENED };
  const real = realVisitIdOf(visitId, resolved);
  const ids = idsOf(visitId, resolved);
  if (real && saved) return { ok: true, document: projectVisit(saved, jobs, ids), visits: [] };
  if (isLocalVisitId(visitId) && template) return { ok: true, document: projectVisit(blankFromTemplate(template, real ?? visitId), jobs, ids), visits: [] };
  return { ok: false, message: template ? VISIT_NOT_SAVED : VISIT_NEVER_OPENED };
}

/** A visit created without signal shows among the open ones until Portal has it. */
export function localVisitRows(queue: readonly FieldJob[], resolved: ResolvedVisits): OpenVisitRow[] {
  return queue.flatMap((job): OpenVisitRow[] => {
    const payload = payloadOf(job);
    if (!isVisitJob(job) || payload.kind !== 'visit_section' || !payload.creates || resolved[payload.visit]) return [];
    const points = queue.filter((other) => other.kind === 'visit_point' && payloadOf(other).visit === payload.visit).length;
    return [{ id: payload.visit, code: LOCAL_VISIT_CODE, prospect: filled(payload.values)[0] ?? '', place: LOCAL_VISIT_CODE, visitedAt: new Date(job.createdAt).toISOString(), engineer: '', stage: 'draft', stageLabel: LOCAL_VISIT_CODE, points }];
  });
}

/** Discarding a new visit's creation takes all its work with it: nothing of it could ever land. */
export function keysGoingWith(job: FieldJob, queue: readonly FieldJob[]): string[] {
  const payload = payloadOf(job);
  if (!isVisitJob(job) || payload.kind !== 'visit_section' || !payload.creates) return [job.key];
  return queue.filter((other) => other.key === job.key || (isVisitJob(other) && payloadOf(other).visit === payload.visit)).map((other) => other.key);
}
