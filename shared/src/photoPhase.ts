import { FORMS_LEVEL } from './appForms.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * «Antes» and «después» marked by hand (José 08/11, through Portal 2ef27173): any member of the
 * channel marks a photo of the service, and a «before» and an «after» with the same stretch form a
 * pair in the client's portal. Portal's `marcar_foto_antes_despues`; `null` takes the mark away and
 * a missing stretch keeps the one the photo had. PURE: the APK and the web read and send from here.
 */
export type PhotoPhase = 'antes' | 'despues';
export type PhotoMark = { photoId: string; phase: PhotoPhase; stretch: string };
export type PhotoPhaseRequest = { kind: 'photo_phase'; photo_id: string; phase: PhotoPhase | null; stretch?: string; forms: number };

/** Portal sends at most 200 marks, and a stretch of at most 80 characters. */
export const PHOTO_MARKS_MAX = 200;
export const PHOTO_STRETCH_MAX = 80;
const PHOTO_ID_MAX = 64;
export const PHOTO_PHASES: ReadonlyArray<{ phase: PhotoPhase | null; label: string }> = [
  { phase: 'antes', label: 'Antes' },
  { phase: 'despues', label: 'Después' },
  { phase: null, label: 'Sin marcar' },
];
export const PHOTO_PHASE_SAVED = 'Foto marcada.';
export const PHOTO_PHASE_FAILED = 'No se pudo marcar la foto. Revisa tu señal y vuelve a intentarlo.';
export const PHOTO_STRETCH_HINT = 'Tramo, por ejemplo «Jr. Conchucos cdra 1»';

const isPhase = (value: unknown): value is PhotoPhase => value === 'antes' || value === 'despues';

function markOf(raw: unknown): PhotoMark | null {
  const { fotoId, fase, tramo } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const photoId = typeof fotoId === 'string' ? fotoId.trim() : '';
  const stretch = typeof tramo === 'string' ? tramo.trim() : '';
  if (!photoId || photoId.length > PHOTO_ID_MAX || !isPhase(fase) || stretch.length > PHOTO_STRETCH_MAX) return null;
  return { photoId, phase: fase, stretch };
}

/** `photoMarks` of Portal's service detail, validated: what is off the contract is left out. */
export const photoMarksOf = (raw: unknown): PhotoMark[] =>
  (Array.isArray(raw) ? raw.map(markOf).filter((mark): mark is PhotoMark => mark !== null).slice(0, PHOTO_MARKS_MAX) : []);

export const photoMarkOf = (marks: readonly PhotoMark[], photoId: string): PhotoMark | null => marks.find((mark) => mark.photoId === photoId) ?? null;

/** Portal pairs by stretch whatever its capitals and accents: so does Lilachat. */
export const stretchKey = (stretch: string): string =>
  stretch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function photoPhaseRequest(photoId: string, phase: PhotoPhase | null, stretch?: string): PhotoPhaseRequest {
  const kept = stretch?.trim().slice(0, PHOTO_STRETCH_MAX);
  return { kind: 'photo_phase', photo_id: photoId, phase, ...(kept ? { stretch: kept } : {}), forms: FORMS_LEVEL };
}

export function photoPhaseLabel(mark: PhotoMark | null): string {
  if (!mark) return 'Sin marcar';
  const phase = mark.phase === 'antes' ? 'Antes' : 'Después';
  return mark.stretch ? `${phase} · ${mark.stretch}` : phase;
}

/** Nothing to fill: the photo, the phase and the stretch ride as context from the server's door. */
export const sendPhotoPhase = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: PHOTO_PHASE_SAVED, failed: PHOTO_PHASE_FAILED });
