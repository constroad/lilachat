import { FORMS_LEVEL } from './appForms.js';
import { metersLabel, type WorkMap, type WorkMapWork } from './workMap.js';
import { stretchWorksOf } from './workMapProgress.js';
import type { DriveUploadResult } from './driveUpload.js';
import type { MapEditSend } from './workScopeDraft.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * «Registrar avance» by hand (design o-06, Portal 57f06ec7): a stretch done without trucks
 * (subgrade, base, a prime coat from a tanker). It starts where that work stopped, the person
 * moves the end, adds photos already in the service's Drive, and it enters pending until the
 * resident approves it. Portal dates it by the phone's clock and refuses one ahead of now. PURE.
 */
export type ManualProgressDraft = { workId: string | null; fromM: number; toM: number; photoIds: string[]; note: string };
export type WorkManualProgressRequest = {
  kind: 'work_manual_progress';
  street_id: string;
  tag_id?: string;
  partida_id?: string;
  from_m: number;
  to_m: number;
  entry_id: string;
  device_at: string;
  photo_ids: string[];
  forms: number;
};

export const MANUAL_PHOTOS_MAX = 6;
export const MANUAL_NOTE_MAX = 280;
export const MANUAL_STEP_M = 10;
/** Portal refuses an end past the street's length plus half a meter. */
const END_TOLERANCE_M = 0.5;

export const MANUAL_PICK_WORK = 'Elige qué trabajo avanzó.';
export const MANUAL_NO_LENGTH = 'Indica hasta dónde avanzó.';
export const MANUAL_PAST_STREET = (lengthM: number) => `El avance pasa el largo de la calle (${Math.round(lengthM)} m).`;
export const MANUAL_SENT = 'Avance registrado. Queda pendiente hasta que un admin lo apruebe.';
export const MANUAL_FAILED = 'No se pudo registrar el avance. Revisa tu señal y vuelve a enviar.';
export const MANUAL_PHOTO_UNLINKED = 'La foto subió al Drive, pero no se pudo adjuntar. Vuelve a intentarlo.';

const approvedEnd = (map: Pick<WorkMap, 'progress'>, streetId: string, workId: string): number | null => {
  const ends = map.progress.filter((one) => one.streetId === streetId && one.workId === workId && !one.rework).map((one) => one.toM);
  return ends.length ? Math.max(...ends) : null;
};

const scopeStart = (map: Pick<WorkMap, 'scopes'>, streetId: string, workId: string): number => {
  const starts = map.scopes.filter((scope) => scope.streetId === streetId && scope.workIds.includes(workId)).map((scope) => scope.fromM);
  return starts.length ? Math.min(...starts) : 0;
};

/** «Sigue donde quedó»: the end of the approved progress of that work, or the start of its stretch. */
export const manualStartOf = (map: Pick<WorkMap, 'progress' | 'scopes'>, streetId: string, workId: string): number =>
  Math.round(approvedEnd(map, streetId, workId) ?? scopeStart(map, streetId, workId));

/** The works the street's stretches carry; with one, it comes picked. */
export function manualDraftFor(map: WorkMap, streetId: string): { works: WorkMapWork[]; draft: ManualProgressDraft } {
  const works = stretchWorksOf(map, streetId);
  const only = works.length === 1 ? works[0]!.id : null;
  const fromM = only ? manualStartOf(map, streetId, only) : 0;
  return { works, draft: { workId: only, fromM, toM: fromM, photoIds: [], note: '' } };
}

/** Picking a work moves the start to where that work stopped; the end keeps the same length. */
export function pickManualWork(map: WorkMap, streetId: string, draft: ManualProgressDraft, workId: string): ManualProgressDraft {
  const fromM = manualStartOf(map, streetId, workId);
  return { ...draft, workId, fromM, toM: fromM + Math.max(0, draft.toM - draft.fromM) };
}

/** «−10 m» and «+10 m»: never before the start, never past the street. */
export const nudgeManualEnd = (draft: ManualProgressDraft, deltaM: number, lengthM: number): ManualProgressDraft =>
  ({ ...draft, toM: Math.min(Math.floor(lengthM + END_TOLERANCE_M), Math.max(draft.fromM, draft.toM + deltaM)) });

export function manualProblem(draft: ManualProgressDraft, lengthM: number): string | null {
  if (!draft.workId) return MANUAL_PICK_WORK;
  if (!(draft.toM > draft.fromM)) return MANUAL_NO_LENGTH;
  if (draft.toM > lengthM + END_TOLERANCE_M) return MANUAL_PAST_STREET(lengthM);
  return null;
}

/** «+120 m · 720 m²»; the area only when the street has its width. */
export function manualFigures(draft: ManualProgressDraft, widthM?: number): string {
  const lengthM = Math.max(0, draft.toM - draft.fromM);
  const length = `+${metersLabel(lengthM)}`;
  return widthM ? `${length} · ${metersLabel(lengthM * widthM).slice(0, -2)} m²` : length;
}

export const addManualPhoto = (draft: ManualProgressDraft, mediaId: string): ManualProgressDraft =>
  (draft.photoIds.includes(mediaId) || draft.photoIds.length >= MANUAL_PHOTOS_MAX ? draft : { ...draft, photoIds: [...draft.photoIds, mediaId] });

export function workManualProgressRequest(map: WorkMap, streetId: string, draft: ManualProgressDraft, entryId: string, now: Date): WorkManualProgressRequest {
  const partida = map.works.find((work) => work.id === draft.workId)?.partida;
  const workId = draft.workId ?? '';
  return {
    kind: 'work_manual_progress',
    street_id: streetId,
    ...(partida ? { partida_id: workId } : { tag_id: workId }),
    from_m: Math.round(draft.fromM),
    to_m: Math.round(draft.toM),
    entry_id: entryId,
    device_at: now.toISOString(),
    photo_ids: draft.photoIds.slice(0, MANUAL_PHOTOS_MAX),
    forms: FORMS_LEVEL,
  };
}

/** The same `entry_id` on a resend: Portal answers it was already marked. */
export const sendWorkManualProgress = (deps: WorkProgressDeps, note: string): Promise<WorkProgressResult> =>
  sendMapTool(deps, note.trim() ? { nota: note.trim().slice(0, MANUAL_NOTE_MAX) } : {}, { sent: MANUAL_SENT, failed: MANUAL_FAILED });

/** A photo for the progress: uploaded to the service's Drive first, its id rides with the progress. */
export type ManualPhotoUpload<F> = (file: F) => Promise<{ ok: true; mediaId: string } | { ok: false; message: string }>;

/** Portal answers the file's id; without it the photo cannot go as evidence. */
export const manualPhotoOf = (result: DriveUploadResult): Awaited<ReturnType<ManualPhotoUpload<unknown>>> => {
  if (!result.ok) return result;
  return result.mediaId ? { ok: true, mediaId: result.mediaId } : { ok: false, message: MANUAL_PHOTO_UNLINKED };
};

type ManualRun = { map: WorkMap; streetId: string; lengthM: number; draft: ManualProgressDraft; entryId: string; send: MapEditSend; now: Date };

/** Checks it, then sends it through the door; what is wrong comes back as the message to show. */
export async function runManualProgress(run: ManualRun): Promise<WorkProgressResult> {
  const problem = manualProblem(run.draft, run.lengthM);
  if (problem) return { ok: false, message: problem };
  return run.send(workManualProgressRequest(run.map, run.streetId, run.draft, run.entryId, run.now), (deps) => sendWorkManualProgress(deps, run.draft.note));
}
