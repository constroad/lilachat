import { FORMS_LEVEL } from './appForms.js';
import type { ManualPhotoUpload } from './workManualProgress.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * «Agregar foto» on a record already made (José 28/11: record it now, add the photo later). Portal's
 * `agregar_foto_a_avance_de_obra` takes 1–6 files of the service's Drive, uploaded first with the
 * same upload as the progress photo; any member of the service may use it. It goes through the
 * server's map door like `deshacer_avance_de_obra`, never to Portal directly.
 * PURE: the APK and the web send what this builds.
 */
export type WorkProgressPhotoRequest = { kind: 'work_progress_photo'; progress_id: string; photo_ids: string[]; forms: number };
export type ProgressPhotoResult = { ok: true; progressId: string | null; photos: number | null; message: string } | { ok: false; message: string };
/** What the camera gives: the shot, a reason (denied), or null when it was closed. */
export type PhotoTake<F> = () => Promise<{ shot: F } | { message: string } | null>;

export const PROGRESS_PHOTOS_MAX = 6;
export const ADD_PHOTO_LABEL = 'Agregar foto';
export const ADDING_PHOTO = 'Agregando…';
export const PHOTO_ADDED = 'Foto agregada.';
export const PHOTO_ADD_FAILED = 'No se pudo agregar la foto; inténtalo de nuevo.';
export const PROGRESS_CHANGED = 'El avance cambió mientras tanto: vuelve a intentarlo.';

/** Portal's own refusals read as sentences for the person; anything else (502, a missing tool) is the plain retry. */
const PORTAL_REFUSAL = /cambió mientras tanto|deshech|cerrad|no es de|no pertenece|fotos como máximo|no está activ/i;

type Raw = Record<string, unknown>;
const objectOf = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});
/** The tool's `data`, as is or wrapped once more by the door (`data.data`). */
const answerOf = (data: unknown, key: string): Raw => {
  const outer = objectOf(data);
  return key in outer ? outer : objectOf(outer.data);
};

export function workProgressPhotoRequest(progressId: string, photoIds: readonly string[]): WorkProgressPhotoRequest | null {
  const ids = [...new Set(photoIds.map((id) => id.trim()).filter(Boolean))].slice(0, PROGRESS_PHOTOS_MAX);
  const id = progressId.trim();
  return id && ids.length ? { kind: 'work_progress_photo', progress_id: id, photo_ids: ids, forms: FORMS_LEVEL } : null;
}

/** `{ avanceId, fotos }` when it worked; Portal's refusal or the plain retry when not. */
export function progressPhotoResultOf(result: WorkProgressResult): ProgressPhotoResult {
  if (!result.ok) return { ok: false, message: PORTAL_REFUSAL.test(result.message) ? result.message : PHOTO_ADD_FAILED };
  const raw = answerOf(result.data, 'avanceId');
  const photos = typeof raw.fotos === 'number' && Number.isFinite(raw.fotos) ? raw.fotos : null;
  return { ok: true, progressId: typeof raw.avanceId === 'string' && raw.avanceId ? raw.avanceId : null, photos, message: PHOTO_ADDED };
}

/** The record Portal answered for «Registrar»: also on a resend; null when it went to the phone's queue. */
export function recordedProgressIdOf(result: WorkProgressResult): string | null {
  if (!result.ok) return null;
  const raw = answerOf(result.data, 'avanceId');
  return typeof raw.avanceId === 'string' && raw.avanceId ? raw.avanceId : null;
}

const sendPhoto = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: PHOTO_ADDED, failed: PHOTO_ADD_FAILED });

/** Asks the tool; a door that throws is logged and answered with the plain retry. */
export async function sendProgressPhoto(send: MapEditSend, progressId: string, photoIds: readonly string[]): Promise<ProgressPhotoResult> {
  const request = workProgressPhotoRequest(progressId, photoIds);
  if (!request) return { ok: false, message: PHOTO_ADD_FAILED };
  try {
    return progressPhotoResultOf(await send(request, sendPhoto));
  } catch (error) {
    console.warn('work-map: add photo to progress failed', error instanceof Error ? error.message : error);
    return { ok: false, message: PHOTO_ADD_FAILED };
  }
}

type AddPhotoRun<F> = { take: PhotoTake<F>; upload: ManualPhotoUpload<F>; send: MapEditSend; progressId: string };

/** The camera as «Tomar foto y registrar», the Drive upload, then the tool; null when the camera was closed. */
export async function addPhotoToProgress<F>(run: AddPhotoRun<F>): Promise<ProgressPhotoResult | null> {
  const taken = await run.take();
  if (!taken) return null;
  if ('message' in taken) return { ok: false, message: taken.message };
  const uploaded = await run.upload(taken.shot);
  if (!uploaded.ok) return { ok: false, message: uploaded.message };
  return sendProgressPhoto(run.send, run.progressId, [uploaded.mediaId]);
}

/** «2 fotos» on a record; nothing without photos. */
export const photosLabel = (count: number): string => (count <= 0 ? '' : count === 1 ? '1 foto' : `${count} fotos`);

/** After one try: the count to show (the tool's total, or one more when it gave none) and the error, if any. */
export function afterPhotoAdd(added: ProgressPhotoResult | null, shown: number): { photos: number; error: string | null } {
  if (!added) return { photos: shown, error: null };
  return added.ok ? { photos: added.photos ?? shown + 1, error: null } : { photos: shown, error: added.message };
}
