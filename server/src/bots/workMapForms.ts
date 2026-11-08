import type { AppForm, FormSchema } from '@lilachat/shared';

/**
 * The rest of Portal's work-map tools from the map (step 3, José 07/11: «itera hasta terminarlo»):
 * stretches (o-03), stages (o-04), works (o-05) and, for admins, what was deleted. Like the street,
 * each opens as a form with nothing to fill: the service is the door's and the rest rides as
 * context, which Portal validates again (`portalWorkMapTools`, a9938ba7).
 */
const CONFIRM_ONLY: FormSchema = { type: 'object', properties: {} };
const ID_MAX = 64;
const LABEL_MAX = 60;
const AXES_MAX = 30;
const WIDTH_MAX_M = 60;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MEDIA_ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkScopeInput = { kind: 'work_scope'; streetId: string; scopeId: string | null; fromM: number; toM: number; tagIds: string[] | null; partidaIds: string[] | null; stageId: string | null | undefined; widthM: number | null; entryId: string | null };
export type WorkMapFormInput =
  | WorkScopeInput
  | { kind: 'work_scope_delete'; scopeId: string }
  | { kind: 'work_stage'; name: string }
  | { kind: 'work_tag'; name: string; color: string }
  | { kind: 'work_stage_edit'; stageId: string; name: string }
  | { kind: 'work_tag_edit'; tagId: string; name: string; color: string | null }
  | { kind: 'work_stage_delete'; stageId: string }
  | { kind: 'work_tag_delete'; tagId: string }
  | { kind: 'work_restore'; target: RestoreTarget; id: string }
  | { kind: 'work_deleted' }
  | { kind: 'work_progress_link'; stageId: string | null; until: string | null; photos: boolean }
  | { kind: 'work_import'; mediaId: string; entryId: string | null }
  | { kind: 'work_map_in_report'; include: boolean; stageId: string | null; until: string | null }
  | { kind: 'work_progress_pdf'; stageId: string | null; until: string | null; format: 'cliente' | 'plano'; size: 'A3' | 'A1' | null; workIds: string[] | null };
/** What `restaurar_de_obra` brings back: exactly one of the four (Portal c1c35c58). */
type RestoreTarget = 'calleId' | 'tramoId' | 'etapaId' | 'etiquetaId';
export type WorkMapFormContext = Record<string, string | number | boolean | string[] | null>;

const idOf = (raw: unknown): string => (typeof raw === 'string' && raw.trim().length <= ID_MAX ? raw.trim() : '');
const labelOf = (raw: unknown): string => {
  const label = typeof raw === 'string' ? raw.trim() : '';
  return label.length <= LABEL_MAX ? label : '';
};
const meterOf = (raw: unknown): number | null => (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null);

/** undefined: not sent; null: sent wrong. */
function idsOf(raw: unknown): string[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > AXES_MAX) return null;
  const ids = raw.map(idOf);
  return ids.every(Boolean) ? ids : null;
}

/** undefined: keep it; null: «sin etapa»; '': sent wrong. */
const stageOf = (raw: unknown): string | null | undefined => (raw === undefined || raw === null ? raw : idOf(raw));
const widthOf = (raw: unknown): number | null | undefined => (raw === undefined ? undefined : typeof raw === 'number' && raw > 0 && raw <= WIDTH_MAX_M ? raw : null);

type ScopeExtras = Pick<WorkScopeInput, 'tagIds' | 'partidaIds' | 'stageId' | 'widthM'>;

/** Works, stage and width as sent; null when one of them came wrong. */
function scopeExtrasOf(raw: Record<string, unknown>): ScopeExtras | null {
  const [tagIds, partidaIds, stageId, widthM] = [idsOf(raw.tag_ids), idsOf(raw.partida_ids), stageOf(raw.stage_id), widthOf(raw.width_m)];
  if (tagIds === null || partidaIds === null || stageId === '' || widthM === null) return null;
  return { tagIds: tagIds ?? null, partidaIds: partidaIds ?? null, stageId, widthM: widthM ?? null };
}

function scopeInputOf(raw: Record<string, unknown>): WorkScopeInput | null {
  const [streetId, scopeId, fromM, toM] = [idOf(raw.street_id), idOf(raw.scope_id), meterOf(raw.from_m), meterOf(raw.to_m)];
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : null;
  const extras = scopeExtrasOf(raw);
  if (!streetId || fromM === null || toM === null || toM <= fromM || !extras || (!scopeId && !entryId)) return null;
  return { kind: 'work_scope', streetId, scopeId: scopeId || null, fromM, toM, ...extras, entryId: scopeId ? null : entryId };
}

const RESTORE_KEYS: Array<[string, RestoreTarget]> = [['street_id', 'calleId'], ['scope_id', 'tramoId'], ['stage_id', 'etapaId'], ['tag_id', 'etiquetaId']];

function restoreInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const sent = RESTORE_KEYS.flatMap(([key, target]) => (idOf(raw[key]) ? [{ target, id: idOf(raw[key]) }] : []));
  return sent.length === 1 ? { kind: 'work_restore', ...sent[0]! } : null;
}

/** Renaming a stage or a work (Portal c1c35c58): its id and the new name; a work may change its color. */
function editInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const name = labelOf(raw.name);
  if (raw.kind === 'work_stage_edit') return idOf(raw.stage_id) && name ? { kind: 'work_stage_edit', stageId: idOf(raw.stage_id), name } : null;
  const color = raw.color === undefined ? null : typeof raw.color === 'string' && HEX_COLOR.test(raw.color) ? raw.color : '';
  return idOf(raw.tag_id) && name && color !== '' ? { kind: 'work_tag_edit', tagId: idOf(raw.tag_id), name, color } : null;
}

function deleteInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  if (raw.kind === 'work_stage_delete') return idOf(raw.stage_id) ? { kind: 'work_stage_delete', stageId: idOf(raw.stage_id) } : null;
  return idOf(raw.tag_id) ? { kind: 'work_tag_delete', tagId: idOf(raw.tag_id) } : null;
}

function tagInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const [name, color] = [labelOf(raw.name), typeof raw.color === 'string' ? raw.color : ''];
  return name && HEX_COLOR.test(color) ? { kind: 'work_tag', name, color } : null;
}

/** The cut of «Crear enlace de avance» (o-08): stage and day are optional, a wrong one is a 400. */
function progressLinkInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const stageId = raw.stage_id === undefined ? null : idOf(raw.stage_id);
  const until = raw.until === undefined ? null : typeof raw.until === 'string' && DAY.test(raw.until) ? raw.until : '';
  if (stageId === '' || until === '' || typeof raw.photos !== 'boolean') return null;
  return { kind: 'work_progress_link', stageId, until, photos: raw.photos };
}

const PDF_FORMATS: Record<string, 'cliente' | 'plano'> = { client: 'cliente', plan: 'plano' };
const PLAN_SIZES = new Set(['A3', 'A1']);
const PDF_WORKS_MAX = 20;

/** The map's PDF (Portal 02cfceef): the cut, the format, and for the plan its size and works. */
function progressPdfInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const cut = progressLinkInputOf({ ...raw, photos: false });
  const format = typeof raw.format === 'string' ? PDF_FORMATS[raw.format] : undefined;
  const size = raw.size === undefined ? null : typeof raw.size === 'string' && PLAN_SIZES.has(raw.size) ? (raw.size as 'A3' | 'A1') : '';
  const workIds = raw.work_ids === undefined ? null : idsOf(raw.work_ids) ?? [];
  if (!cut || cut.kind !== 'work_progress_link' || !format || size === '' || (workIds && (!workIds.length || workIds.length > PDF_WORKS_MAX))) return null;
  return { kind: 'work_progress_pdf', stageId: cut.stageId, until: cut.until, format, size, workIds };
}

/** «Incluir en el informe del servicio» (o-08): on with its cut, or off. */
function mapInReportInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const cut = progressLinkInputOf({ ...raw, photos: false });
  if (!cut || cut.kind !== 'work_progress_link' || typeof raw.include !== 'boolean') return null;
  return { kind: 'work_map_in_report', include: raw.include, stageId: cut.stageId, until: cut.until };
}

/** «Importar KMZ o KML» (o-12): the Drive file, and an entry only to confirm. */
function importInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  const mediaId = typeof raw.media_id === 'string' && MEDIA_ID.test(raw.media_id) ? raw.media_id : '';
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : null;
  if (!mediaId || typeof raw.confirm !== 'boolean' || raw.confirm !== Boolean(entryId)) return null;
  return { kind: 'work_import', mediaId, entryId };
}

/** What the phone sends for one of these kinds; null when it is off the contract or another kind. */
export function workMapFormInputOf(raw: Record<string, unknown>): WorkMapFormInput | null {
  if (raw.kind === 'work_scope') return scopeInputOf(raw);
  if (raw.kind === 'work_scope_delete') return idOf(raw.scope_id) ? { kind: 'work_scope_delete', scopeId: idOf(raw.scope_id) } : null;
  if (raw.kind === 'work_stage') return labelOf(raw.name) ? { kind: 'work_stage', name: labelOf(raw.name) } : null;
  if (raw.kind === 'work_tag') return tagInputOf(raw);
  if (raw.kind === 'work_restore') return restoreInputOf(raw);
  if (raw.kind === 'work_stage_edit' || raw.kind === 'work_tag_edit') return editInputOf(raw);
  if (raw.kind === 'work_stage_delete' || raw.kind === 'work_tag_delete') return deleteInputOf(raw);
  if (raw.kind === 'work_deleted') return { kind: 'work_deleted' };
  if (raw.kind === 'work_progress_link') return progressLinkInputOf(raw);
  if (raw.kind === 'work_import') return importInputOf(raw);
  if (raw.kind === 'work_progress_pdf') return progressPdfInputOf(raw);
  if (raw.kind === 'work_map_in_report') return mapInReportInputOf(raw);
  return null;
}

/** The kinds the door opens; restore and the deleted list since agentes checks their service (890b02e). */
const FORM_KINDS = new Set(['work_scope', 'work_scope_delete', 'work_stage', 'work_tag', 'work_stage_edit', 'work_tag_edit', 'work_stage_delete', 'work_tag_delete', 'work_restore', 'work_deleted', 'work_progress_link', 'work_import', 'work_progress_pdf', 'work_map_in_report']);
export const isWorkMapFormKind = (kind: unknown): boolean => typeof kind === 'string' && FORM_KINDS.has(kind);

/** Narrows the door's union to these kinds. */
export const isWorkMapFormInput = (input: { kind: string }): input is WorkMapFormInput => isWorkMapFormKind(input.kind);

const formOf = (id: string, title: string, submitLabel: string): AppForm => ({ id, title, submitLabel, schema: CONFIRM_ONLY });

function scopeContext(serviceId: string, input: WorkScopeInput): WorkMapFormContext {
  return {
    servicioId: serviceId,
    calleId: input.streetId,
    ...(input.scopeId ? { tramoId: input.scopeId } : {}),
    desdeM: input.fromM,
    hastaM: input.toM,
    ...(input.tagIds ? { etiquetaIds: input.tagIds } : {}),
    ...(input.partidaIds ? { partidaIds: input.partidaIds } : {}),
    ...(input.stageId !== undefined ? { etapaId: input.stageId } : {}),
    ...(input.widthM !== null ? { anchoM: input.widthM } : {}),
    ...(input.entryId ? { entradaId: input.entryId } : {}),
  };
}

const restoreContext = (serviceId: string, input: Extract<WorkMapFormInput, { kind: 'work_restore' }>): WorkMapFormContext =>
  ({ servicioId: serviceId, [input.target]: input.id });

/** The form and the context Portal's tool receives; the service always comes from the door. */
export function workMapFormPrepared(serviceId: string, input: WorkMapFormInput): { form: AppForm; context: WorkMapFormContext } {
  switch (input.kind) {
    case 'work_scope': return { form: formOf('guardar_tramo_de_obra', 'Guardar tramo', 'Guardar'), context: scopeContext(serviceId, input) };
    case 'work_scope_delete': return { form: formOf('borrar_tramo_de_obra', 'Borrar tramo', 'Borrar'), context: { servicioId: serviceId, tramoId: input.scopeId } };
    case 'work_stage': return { form: formOf('crear_etapa_de_obra', 'Crear etapa', 'Crear'), context: { servicioId: serviceId, nombre: input.name } };
    case 'work_tag': return { form: formOf('crear_etiqueta_de_obra', 'Crear trabajo', 'Crear'), context: { servicioId: serviceId, nombre: input.name, color: input.color } };
    case 'work_stage_edit': return { form: formOf('editar_etapa_de_obra', 'Renombrar etapa', 'Guardar'), context: { servicioId: serviceId, etapaId: input.stageId, nombre: input.name } };
    case 'work_tag_edit': return { form: formOf('editar_etiqueta_de_obra', 'Renombrar trabajo', 'Guardar'), context: { servicioId: serviceId, etiquetaId: input.tagId, nombre: input.name, ...(input.color ? { color: input.color } : {}) } };
    case 'work_stage_delete': return { form: formOf('borrar_etapa_de_obra', 'Borrar etapa', 'Borrar'), context: { servicioId: serviceId, etapaId: input.stageId } };
    case 'work_tag_delete': return { form: formOf('borrar_etiqueta_de_obra', 'Borrar trabajo', 'Borrar'), context: { servicioId: serviceId, etiquetaId: input.tagId } };
    case 'work_restore': return { form: formOf('restaurar_de_obra', 'Restaurar', 'Restaurar'), context: restoreContext(serviceId, input) };
    case 'work_deleted': return { form: formOf('borrados_de_obra', 'Lo borrado del mapa', 'Ver'), context: { servicioId: serviceId } };
    case 'work_progress_pdf': return { form: formOf('pdf_de_avance_de_obra', 'PDF del avance', 'Generar'), context: { servicioId: serviceId, ...(input.stageId ? { etapaId: input.stageId } : {}), ...(input.until ? { hasta: input.until } : {}), formato: input.format, ...(input.size ? { tamano: input.size } : {}), ...(input.workIds ? { trabajoIds: input.workIds } : {}) } };
    case 'work_map_in_report': return { form: formOf('mapa_en_informe_de_servicio', 'Mapa en el informe', input.include ? 'Incluir' : 'Quitar'), context: { servicioId: serviceId, incluir: input.include, ...(input.stageId ? { etapaId: input.stageId } : {}), ...(input.until ? { hasta: input.until } : {}) } };
    case 'work_import': return { form: formOf('importar_calles_de_obra', 'Importar calles', input.entryId ? 'Crear calles' : 'Revisar'), context: { servicioId: serviceId, mediaId: input.mediaId, confirmar: Boolean(input.entryId), ...(input.entryId ? { entradaId: input.entryId } : {}) } };
    case 'work_progress_link': return { form: formOf('crear_enlace_de_avance', 'Enlace de avance', 'Crear enlace'), context: { servicioId: serviceId, ...(input.stageId ? { etapaId: input.stageId } : {}), ...(input.until ? { hasta: input.until } : {}), mostrarFotos: input.photos } };
  }
}
