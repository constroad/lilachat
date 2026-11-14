import type { CommandNotice, CommandOutcome, CommandResponse } from './botCommands.js';
import type { FormSubmitReply } from './appActions.js';
import { formRunAnswer, uploadFailure } from './driveUpload.js';
import { markedPointOf, visitUploadOf, type OpenVisitRow, type VisitDocument, type VisitPointDraft, type VisitUpload } from './siteVisit.js';

/**
 * What the visit's screens do through Lilachat's server (contract c-visitas, 14/11), the same on the
 * phone and the web: read the visit, mark a point and send its photo to Portal's ticket, add a photo,
 * finish and ask the PDF. Each write is a run of Portal's app, opened and sent at once.
 */
export const visitDraftPath = (spaceId: string): string => `/workspaces/${spaceId}/visits/draft`;
export const visitFormsPath = (spaceId: string): string => `/workspaces/${spaceId}/visits/forms`;

export type VisitSource = 'apk' | 'web';
export type VisitSectionId = 'datos' | 'entrevista' | 'conclusion';
export type VisitFormRequest =
  | { kind: 'section'; section: VisitSectionId; visit_id?: string; lat?: number; lng?: number; precision_m?: number }
  | { kind: 'point'; visit_id: string; entry_id: string; type: string; lat: number; lng: number; precision_m?: number; note?: string; measure?: number; unit?: string; source: VisitSource }
  | { kind: 'photo'; visit_id: string; point_id?: string }
  | { kind: 'finish'; visit_id: string }
  | { kind: 'pdf'; visit_id: string };

export type VisitPointRequest = Extract<VisitFormRequest, { kind: 'point' }>;
export type VisitDraftResult = { ok: true; document: VisitDocument; visits: OpenVisitRow[] } | { ok: false; message: string };
type Reply = { ok: true; data: unknown } | { ok: false; message?: string };

export const VISIT_OPEN_FAILED = 'No se pudo abrir la visita.';
export const VISIT_PHOTO_FAILED = 'No se pudo subir la foto. Revisa tu señal y vuelve a intentarlo.';
const POINT_FAILED = 'No se pudo guardar el punto.';
const FINISH_FAILED = 'No se pudo terminar la visita.';
const PDF_FAILED = 'No se pudo pedir el PDF.';
const PDF_MAKING = 'El PDF se está generando. Vuelve a tocar en un momento.';
const EXPIRED = 410;
const VISIT_ID = /^[a-f0-9]{24}$/i;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** Our server already read Portal's sheet (`visitDocumentOf`): the phone checks its shape, it does not read it again. */
function sentDocumentOf(raw: unknown): VisitDocument | null {
  const one = record(raw);
  const shaped = typeof one.code === 'string' && Array.isArray(one.sections) && Array.isArray(one.points) && typeof one.figures === 'object' && one.figures !== null;
  return shaped ? (one as unknown as VisitDocument) : null;
}

/** What the server answered to «abrir la visita»: its document, or the words that say why not. */
export function visitDraftResultOf(reply: Reply): VisitDraftResult {
  if (!reply.ok) return { ok: false, message: reply.message ?? VISIT_OPEN_FAILED };
  const body = record(reply.data);
  if (typeof body.error === 'string') return { ok: false, message: typeof body.message === 'string' ? body.message : VISIT_OPEN_FAILED };
  const document = sentDocumentOf(body.document);
  const visits = Array.isArray(body.visits) ? (body.visits as OpenVisitRow[]).filter((row) => typeof record(row).id === 'string') : [];
  return document ? { ok: true, document, visits } : { ok: false, message: VISIT_OPEN_FAILED };
}

/** The visit saving its details created (asked to agentes 14/11; `id` read too until it answers). */
export function createdVisitIdOf(data: unknown): string | null {
  const one = record(data);
  const id = one.visitaId ?? one.id;
  return typeof id === 'string' && VISIT_ID.test(id) ? id : null;
}

/** «Guardar punto»: the draft as the server checks it; `entryId` makes a repeat the same point. */
export function visitPointRequest(visitId: string, entryId: string, draft: VisitPointDraft, source: VisitSource): VisitPointRequest {
  const { type, lat, lng, precisionM, note, measure, unit } = draft;
  return { kind: 'point', visit_id: visitId, entry_id: entryId, type, lat, lng, ...(precisionM !== undefined ? { precision_m: precisionM } : {}), ...(measure !== undefined ? { measure } : {}), ...(unit !== undefined ? { unit } : {}), ...(note ? { note } : {}), source };
}

export type VisitFlowDeps<F> = {
  open(request: VisitFormRequest): Promise<{ ok: true; data: CommandOutcome } | { ok: false; message?: string }>;
  /** Most writes have nothing to fill; the interview sends its answers (lv03). */
  submit(commandId: string, values?: Record<string, string>): Promise<FormSubmitReply>;
  notice(commandId: string): Promise<CommandNotice | null>;
  /** Straight to Portal's ticket (or through our server, for a stamped shot). */
  send(upload: VisitUpload, file: F, clientUploadId: string): Promise<{ status?: number; message?: string }>;
  newKey(): string;
};

async function answerOf<F>(deps: VisitFlowDeps<F>, request: VisitFormRequest, failed: string, values?: Record<string, string>): Promise<{ response: CommandResponse } | { message: string }> {
  return formRunAnswer({ open: () => deps.open(request), submit: (commandId: string) => (values ? deps.submit(commandId, values) : deps.submit(commandId)), notice: deps.notice }, failed);
}

const ANSWER_FAILED = 'No se pudo guardar la respuesta.';

/** An interview answer (lv03): the visit's interview opens and only what changed is sent. */
export async function saveVisitAnswers<F>(deps: VisitFlowDeps<F>, visitId: string, values: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const answer = await answerOf(deps, { kind: 'section', section: 'entrevista', visit_id: visitId }, ANSWER_FAILED, values);
  return 'message' in answer ? { ok: false, message: answer.message } : { ok: true, message: answer.response.text ?? 'Guardado.' };
}

/** Where and when a photo was taken (Portal 43a1f701): a loose one with a place is drawn as «F» on the card. */
export type VisitPhotoPlace = { lat?: number; lng?: number; precisionM?: number; takenAt: string };

/** The multipart's text fields: the place only when it is a real one; the hour always. */
export function visitPhotoFields(place: VisitPhotoPlace): Record<string, string> {
  const located = Number.isFinite(place.lat) && Number.isFinite(place.lng);
  const precise = located && place.precisionM !== undefined && Number.isFinite(place.precisionM);
  return { ...(located ? { lat: String(place.lat), lng: String(place.lng) } : {}), ...(precise ? { precisionM: String(place.precisionM) } : {}), takenAt: place.takenAt };
}

/** One send; `null` when the ticket expired and a new one should be asked. */
async function sent<F>(deps: VisitFlowDeps<F>, upload: VisitUpload, file: F, key: string, fields?: Record<string, string>): Promise<{ ok: true } | { ok: false; message: string } | null> {
  // Where and when ride as the ticket's own text fields, so the web, the APK and a stamped shot all send them; the ticket's win.
  const target = fields ? { ...upload, fields: { ...fields, ...upload.fields } } : upload;
  const { status, message } = await deps.send(target, file, key);
  if (status === EXPIRED) return null;
  if (status && status < 300) return { ok: true };
  return { ok: false, message: status ? uploadFailure(status, message) : VISIT_PHOTO_FAILED };
}

async function photoOnce<F>(deps: VisitFlowDeps<F>, request: VisitFormRequest, file: F, key: string, fields?: Record<string, string>) {
  const answer = await answerOf(deps, request, VISIT_PHOTO_FAILED);
  if ('message' in answer) return { ok: false as const, message: answer.message };
  const upload = visitUploadOf(record(answer.response.data).upload);
  return upload ? sent(deps, upload, file, key, fields) : { ok: false as const, message: VISIT_PHOTO_FAILED };
}

/** One more photo of the visit or of a point: a fresh ticket each time, the same upload key on a retry. */
export async function addVisitPhoto<F>(deps: VisitFlowDeps<F>, visitId: string, file: F, pointId?: string, place?: VisitPhotoPlace): Promise<{ ok: true } | { ok: false; message: string }> {
  const request: VisitFormRequest = { kind: 'photo', visit_id: visitId, ...(pointId ? { point_id: pointId } : {}) };
  const key = deps.newKey();
  const fields = place ? visitPhotoFields(place) : undefined;
  return (await photoOnce(deps, request, file, key, fields)) ?? (await photoOnce(deps, request, file, key, fields)) ?? { ok: false, message: uploadFailure(EXPIRED) };
}

export type MarkedPoint = { ok: true; n: number; pointId: string; photoFailed?: string } | { ok: false; message: string };

/** «Guardar punto N»: the point first, then its photo; a photo that fails leaves the point saved. */
/** The point's photo carries the point's own place and the hour (Portal 43a1f701). */
export async function markVisitPoint<F>(deps: VisitFlowDeps<F>, request: VisitPointRequest, file: F | null, takenAt: string = new Date().toISOString()): Promise<MarkedPoint> {
  const answer = await answerOf(deps, request, POINT_FAILED);
  if ('message' in answer) return { ok: false, message: answer.message };
  const marked = markedPointOf(answer.response.data);
  if (!marked) return { ok: false, message: answer.response.text ?? POINT_FAILED };
  const point = { ok: true as const, n: marked.n, pointId: marked.pointId };
  if (file === null) return point;
  const place = { lat: request.lat, lng: request.lng, ...(request.precision_m !== undefined ? { precisionM: request.precision_m } : {}), takenAt };
  const photo = marked.upload ? await sent(deps, marked.upload, file, deps.newKey(), visitPhotoFields(place)) : null;
  const done = photo ?? (await addVisitPhoto(deps, request.visit_id, file, marked.pointId, place));
  return done.ok ? point : { ...point, photoFailed: done.message };
}

/** «Terminar»: Portal says what is still missing, or that it closed it. */
export async function finishVisit<F>(deps: VisitFlowDeps<F>, visitId: string): Promise<{ ok: boolean; message: string }> {
  const answer = await answerOf(deps, { kind: 'finish', visit_id: visitId }, FINISH_FAILED);
  if ('message' in answer) return { ok: false, message: answer.message };
  const missing = record(answer.response.data).missing;
  const first = Array.isArray(missing) ? missing.find((one): one is string => typeof one === 'string') : undefined;
  return first ? { ok: false, message: `Falta: ${first}` } : { ok: true, message: answer.response.text ?? 'Visita terminada.' };
}

/** «Ver PDF»: its address once made; while Portal makes it, the person reads so. */
export async function visitPdf<F>(deps: VisitFlowDeps<F>, visitId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const answer = await answerOf(deps, { kind: 'pdf', visit_id: visitId }, PDF_FAILED);
  if ('message' in answer) return { ok: false, message: answer.message };
  const { url, status } = record(answer.response.data);
  if (typeof url === 'string' && /^https:\/\//.test(url)) return { ok: true, url };
  return { ok: false, message: status === 'generating' || status === 'pending' ? PDF_MAKING : answer.response.text ?? PDF_FAILED };
}
