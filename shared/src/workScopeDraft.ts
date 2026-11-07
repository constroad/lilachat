import { FORMS_LEVEL } from './appForms.js';
import type { ReportFormRequest } from './reportCreation.js';
import type { WorkMap } from './workMap.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * Adding or editing a stretch, a stage or a work of the map (designs o-03, o-04, o-05; step 3,
 * José 07/11). Each goes through the server's door to Portal's tool (`guardar_tramo_de_obra`,
 * `borrar_tramo_de_obra`, `crear_etapa_de_obra`, `crear_etiqueta_de_obra`), which checks it again.
 * PURE: the APK and the web send what this builds.
 */
export type ScopeDraft = { fromM: number | null; toM: number | null; workIds: string[]; stageId: string | null; widthM: number | null };
export type WorkScopeRequest = { kind: 'work_scope'; street_id: string; scope_id?: string; from_m: number; to_m: number; tag_ids: string[]; partida_ids: string[]; stage_id: string | null; width_m?: number; entry_id?: string; forms: number };
export type WorkScopeDeleteRequest = { kind: 'work_scope_delete'; scope_id: string; forms: number };
export type WorkStageRequest = { kind: 'work_stage'; name: string; forms: number };
export type WorkTagRequest = { kind: 'work_tag'; name: string; color: string; forms: number };

/** Portal lets a stretch pass the street by half a metre: what a measured line rounds to. */
const STREET_SLACK_M = 0.5;
export const LABEL_MAX = 60;

export const SCOPE_NEEDS_ENDS = 'Escribe dónde empieza y dónde termina el tramo.';
export const SCOPE_ENDS_BEFORE = 'El tramo termina antes de empezar.';
export const SCOPE_PAST_STREET = (lengthM: number) => `El tramo pasa el largo de la calle (${Math.round(lengthM)} m).`;
export const LABEL_NEEDS_NAME = 'Ponle nombre.';
export const LABEL_TOO_LONG = `El nombre lleva hasta ${LABEL_MAX} letras.`;

/** The colors of the drawings (o-05): subrasante, base, imprimación, asfalto, then four more to tell works apart. MapLibre paints hex. */
export const WORK_TAG_COLORS = ['#7c4a2d', '#d97706', '#0d9488', '#111827', '#2563eb', '#7c3aed', '#db2777', '#65a30d'] as const;

export const SCOPE_SAVED = 'Tramo guardado.';
export const SCOPE_SAVE_FAILED = 'No se pudo guardar el tramo. Revisa tu señal y vuelve a guardar.';
export const SCOPE_DELETED = 'Tramo borrado. Un admin puede restaurarlo.';
export const SCOPE_DELETE_FAILED = 'No se pudo borrar el tramo. Revisa tu señal y vuelve a intentarlo.';
export const STAGE_CREATED = 'Etapa creada.';
export const STAGE_FAILED = 'No se pudo crear la etapa. Revisa tu señal y vuelve a intentarlo.';
export const TAG_CREATED = 'Trabajo creado.';
export const TAG_FAILED = 'No se pudo crear el trabajo. Revisa tu señal y vuelve a intentarlo.';

/** A new stretch starts as the whole street: the common case is «toda la calle». */
export const scopeDraftFor = (lengthM: number): ScopeDraft => ({ fromM: 0, toM: Math.round(lengthM), workIds: [], stageId: null, widthM: null });

export function scopeDraftProblem(draft: ScopeDraft, streetLengthM: number): string | null {
  if (draft.fromM === null || draft.toM === null) return SCOPE_NEEDS_ENDS;
  if (draft.toM <= draft.fromM) return SCOPE_ENDS_BEFORE;
  if (draft.toM > streetLengthM + STREET_SLACK_M) return SCOPE_PAST_STREET(streetLengthM);
  return null;
}

export const toggleScopeWork = (draft: ScopeDraft, workId: string): ScopeDraft =>
  ({ ...draft, workIds: draft.workIds.includes(workId) ? draft.workIds.filter((id) => id !== workId) : [...draft.workIds, workId] });

/** Portal keeps tags and partidas apart; the map shows them as one list of works. Call it once the draft has no problem. */
export function workScopeRequest(map: WorkMap, streetId: string, draft: ScopeDraft, entryId: string, scopeId?: string): WorkScopeRequest {
  const isPartida = (id: string) => map.works.some((work) => work.id === id && work.partida);
  return {
    kind: 'work_scope',
    street_id: streetId,
    ...(scopeId ? { scope_id: scopeId } : {}),
    from_m: draft.fromM ?? 0,
    to_m: draft.toM ?? 0,
    tag_ids: draft.workIds.filter((id) => !isPartida(id)),
    partida_ids: draft.workIds.filter(isPartida),
    stage_id: draft.stageId,
    ...(draft.widthM !== null ? { width_m: draft.widthM } : {}),
    ...(scopeId ? {} : { entry_id: entryId }),
    forms: FORMS_LEVEL,
  };
}

export const workScopeDeleteRequest = (scopeId: string): WorkScopeDeleteRequest => ({ kind: 'work_scope_delete', scope_id: scopeId, forms: FORMS_LEVEL });

export function labelProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return LABEL_NEEDS_NAME;
  return trimmed.length > LABEL_MAX ? LABEL_TOO_LONG : null;
}

export const workStageRequest = (name: string): WorkStageRequest => ({ kind: 'work_stage', name: name.trim(), forms: FORMS_LEVEL });
export const workTagRequest = (name: string, color: string): WorkTagRequest => ({ kind: 'work_tag', name: name.trim(), color, forms: FORMS_LEVEL });

export const sendWorkScope = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: SCOPE_SAVED, failed: SCOPE_SAVE_FAILED });
export const sendWorkScopeDelete = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: SCOPE_DELETED, failed: SCOPE_DELETE_FAILED });
export const sendWorkStage = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: STAGE_CREATED, failed: STAGE_FAILED });
export const sendWorkTag = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: TAG_CREATED, failed: TAG_FAILED });

/** One of the map's edits through the server's door: the request it opens and how its answer reads. */
export type MapEditSend = (request: ReportFormRequest, run: (deps: WorkProgressDeps) => Promise<WorkProgressResult>) => Promise<WorkProgressResult>;

/** An edit that worked asks for the map again, so the panel shows what Portal kept. */
export const editThenReload = (send: MapEditSend | undefined, reload: () => Promise<unknown>): MapEditSend | undefined =>
  send && (async (request, run) => {
    const result = await send(request, run);
    if (result.ok) await reload();
    return result;
  });
