import { FORMS_LEVEL } from './appForms.js';
import { labelProblem, type MapEditSend } from './workScopeDraft.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * Renaming and deleting a stage or a work of the map (Portal c1c35c58, asked 08/11: whoever typed
 * a stage wrong kept it forever). A work here is a tag: the contract's items are not deleted from
 * the map. Both deletes are logical; an admin restores them from «Borrados».
 * PURE: the APK and the web send from here.
 */
export type MapLayerKind = 'stages' | 'works';
export type WorkStageEditRequest = { kind: 'work_stage_edit'; stage_id: string; name: string; forms: number };
export type WorkTagEditRequest = { kind: 'work_tag_edit'; tag_id: string; name: string; forms: number };
export type WorkStageDeleteRequest = { kind: 'work_stage_delete'; stage_id: string; forms: number };
export type WorkTagDeleteRequest = { kind: 'work_tag_delete'; tag_id: string; forms: number };
export type LayerEditRequest = WorkStageEditRequest | WorkTagEditRequest;
export type LayerDeleteRequest = WorkStageDeleteRequest | WorkTagDeleteRequest;

export const LAYER_NAME_TAKEN = 'Ya hay otra con ese nombre.';
export const LAYER_RENAMED = 'Nombre guardado.';
export const LAYER_RENAME_FAILED = 'No se pudo cambiar el nombre. Revisa tu señal y vuelve a intentarlo.';
export const LAYER_DELETED = 'Borrado. Un admin puede restaurarlo.';
export const LAYER_DELETE_FAILED = 'No se pudo borrar. Revisa tu señal y vuelve a intentarlo.';

/** Portal compares names without case nor extra spaces; the same rule warns before sending. */
const sameName = (left: string, right: string) => left.trim().replace(/\s+/g, ' ').toLowerCase() === right.trim().replace(/\s+/g, ' ').toLowerCase();

export function layerEditProblem(name: string, id: string, layers: Array<{ id: string; name: string }>): string | null {
  return labelProblem(name) ?? (layers.some((one) => one.id !== id && sameName(one.name, name)) ? LAYER_NAME_TAKEN : null);
}

export const layerEditRequest = (kind: MapLayerKind, id: string, name: string): LayerEditRequest =>
  kind === 'stages' ? { kind: 'work_stage_edit', stage_id: id, name: name.trim(), forms: FORMS_LEVEL } : { kind: 'work_tag_edit', tag_id: id, name: name.trim(), forms: FORMS_LEVEL };

export const layerDeleteRequest = (kind: MapLayerKind, id: string): LayerDeleteRequest =>
  kind === 'stages' ? { kind: 'work_stage_delete', stage_id: id, forms: FORMS_LEVEL } : { kind: 'work_tag_delete', tag_id: id, forms: FORMS_LEVEL };

/** What happens to its stretches, said before deleting. */
export const layerDeleteQuestion = (kind: MapLayerKind, name: string): string =>
  kind === 'stages'
    ? `¿Borrar la etapa «${name}»? Sus tramos quedan sin etapa. Un admin puede restaurarla.`
    : `¿Borrar el trabajo «${name}»? Sus tramos quedan sin él. Un trabajo con avance registrado no se borra. Un admin puede restaurarlo.`;

export const sendLayerEdit = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: LAYER_RENAMED, failed: LAYER_RENAME_FAILED });
export const sendLayerDelete = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: LAYER_DELETED, failed: LAYER_DELETE_FAILED });

/** «Guardar» of a rename: null when Portal took it, else what to show under the field. */
export async function renameLayer(send: MapEditSend, kind: MapLayerKind, id: string, name: string, layers: Array<{ id: string; name: string }>): Promise<string | null> {
  const problem = layerEditProblem(name, id, layers);
  if (problem) return problem;
  const result = await send(layerEditRequest(kind, id, name), sendLayerEdit);
  return result.ok ? null : result.message;
}

/** «Borrar» after asking: null when Portal took it, else its refusal («tiene avance», the report's cut). */
export async function deleteLayer(send: MapEditSend, kind: MapLayerKind, id: string): Promise<string | null> {
  const result = await send(layerDeleteRequest(kind, id), sendLayerDelete);
  return result.ok ? null : result.message;
}
