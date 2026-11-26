import { AREA_WRITE, type AdditionalArea, type AreaDocument } from './additionalArea.js';
import { newFieldJob, type FieldJob, type FieldJobFile } from './fieldQueue.js';
import type { WriteAnswer, WriteKind } from './formFilesWrite.js';
import { OBSERVATION_WRITE } from './observationWrite.js';

/**
 * An observation (REG-OBS / LEV-OBS) or an additional area (IAA) written without signal (José 26/11):
 * a field job that carries the request (with its `entry_id`: Portal finds the first one on a resend),
 * the form's values and each file with its own fields. Without `report_id` Portal files it in the
 * service's open report (`findOpenReport`, verified 26/11), so nothing waits for another job. PURE.
 */
export type FieldWriteName = 'observation' | 'area';
export type FieldWritePayload = { write: FieldWriteName; request: Record<string, unknown>; values: Record<string, string>; /** Each file's own form fields (`captura`), by its key. */ fileFields: Record<string, Record<string, string>> };

const KINDS: Record<FieldWriteName, WriteKind<WriteAnswer>> = { observation: OBSERVATION_WRITE, area: AREA_WRITE };
export const fieldWriteKindOf = (name: FieldWriteName): WriteKind<WriteAnswer> => KINDS[name];

const LABELS: Record<string, string> = { observation_register: 'Observación nueva', observation_lift: 'Observación levantada', area_create: 'Área adicional', area_edit: 'Área editada', area_remove: 'Área quitada' };
export const fieldWriteLabel = (request: { kind?: unknown }): string => LABELS[String(request.kind)] ?? 'Registro de campo';

export function fieldWriteJobOf(input: { key: string; scope: FieldJob['scope']; payload: FieldWritePayload; files: FieldJobFile[]; now: number }): FieldJob {
  return newFieldJob({ key: input.key, kind: 'observation', scope: input.scope, label: fieldWriteLabel(input.payload.request), payload: input.payload as unknown as Record<string, unknown>, files: input.files, now: input.now });
}

/**
 * Editing or removing a saved area (26/11): no file and no answer to read, only Portal's «Hecho». An edit
 * rewrites the whole measure, so a resend lands the same; a second removal is Portal's refusal, visible.
 */
const DIRECT_WRITES: ReadonlySet<string> = new Set(['area_edit', 'area_remove']);
export const isDirectFieldWrite = (request: { kind?: unknown }): boolean => DIRECT_WRITES.has(String(request.kind));

const CM_PER_M = 100;
const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const numberIn = (raw: Record<string, unknown>, key: string): number | undefined => (typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? (raw[key] as number) : undefined);

function editedArea(area: AdditionalArea, payload: FieldWritePayload): AdditionalArea {
  const { request, values } = payload;
  const areaM2 = numberIn(request, 'area_m2') ?? area.areaM2;
  const thicknessCm = numberIn(request, 'thickness_cm');
  const rest: AdditionalArea = { ...area };
  delete rest.thicknessCm;
  delete rest.volumeM3;
  return {
    ...rest, areaM2,
    ...(numberIn(request, 'length_m') !== undefined ? { lengthM: numberIn(request, 'length_m') } : {}),
    ...(numberIn(request, 'width_m') !== undefined ? { widthM: numberIn(request, 'width_m') } : {}),
    ...(thicknessCm !== undefined ? { thicknessCm, volumeM3: round((areaM2 * thicknessCm) / CM_PER_M, 3) } : {}),
    ...(values.ubicacion ? { place: values.ubicacion } : {}),
    ...(values.descripcion ? { description: values.descripcion } : {}),
  };
}

/** The area report as it will be once this service's waiting edits and removals land, totals included. */
export function projectAreaReport(document: AreaDocument, queue: readonly FieldJob[], serviceId: string): AreaDocument {
  const writes = queue.filter((job) => job.kind === 'observation' && job.scope.serviceId === serviceId).map((job) => job.payload as unknown as FieldWritePayload).filter((payload) => isDirectFieldWrite(payload.request));
  if (!writes.length) return document;
  const areas = writes.reduce((list, payload) => {
    const id = payload.request.area_id;
    if (payload.request.kind === 'area_remove') return list.filter((area) => area.id !== id);
    return list.map((area) => (area.id === id ? editedArea(area, payload) : area));
  }, document.areas);
  const sum = (list: readonly AdditionalArea[], pick: (area: AdditionalArea) => number) => list.reduce((total, area) => total + pick(area), 0);
  const delta = { areaM2: sum(areas, (area) => area.areaM2) - sum(document.areas, (area) => area.areaM2), volumeM3: sum(areas, (area) => area.volumeM3 ?? 0) - sum(document.areas, (area) => area.volumeM3 ?? 0) };
  return { ...document, areas, totals: { areaM2: round(Math.max(0, document.totals.areaM2 + delta.areaM2), 2), volumeM3: round(Math.max(0, document.totals.volumeM3 + delta.volumeM3), 3) } };
}
