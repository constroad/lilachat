import { FORMS_LEVEL } from './appForms.js';
import { dayOf } from './serviceDetail.js';
import { stationLabel, type WorkMap, type WorkMapLine } from './workMap.js';
import { stretchLineOf } from './workMapProgress.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * Progress waiting for the resident (José 09/11: «Registrar avance» left nothing to see, because the
 * map reads only what was approved). Portal a9b1c3ba lists it with `avances_pendientes_de_obra`
 * (an admin sees all; anyone else, what they marked) and resolves it with `resolver_avance_de_obra`
 * (admins). PURE: the APK and the web draw from here.
 */
export type PendingProgress = { id: string; date: string; streetId: string | null; street: string; fromM: number | null; toM: number | null; quantity: number; work: string; note: string | null; units: number; photos: number; by: string | null };
export type PendingList = { items: PendingProgress[]; seesAll: boolean; more: boolean };
export type PendingDecision = 'aprobar' | 'rechazar';
export type WorkPendingRequest = { kind: 'work_pending'; forms: number };
export type WorkResolveRequest = { kind: 'work_resolve'; progress_id: string; decision: PendingDecision; note?: string; forms: number };

export const PENDING_FAILED = 'No se pudo traer lo pendiente. Revisa tu señal y vuelve a intentarlo.';
export const RESOLVED = 'Listo.';
export const RESOLVE_FAILED = 'No se pudo guardar. Revisa tu señal y vuelve a intentarlo.';
export const PENDING_EXPLAIN = 'Lo que marcó el equipo y todavía no aprobaste. El cliente lo ve recién al aprobarlo.';
export const PENDING_MINE = 'Lo que marcaste y espera la aprobación del residente.';

type Raw = Record<string, unknown>;
const listOf = (raw: unknown): Raw[] => (Array.isArray(raw) ? raw.filter((one): one is Raw => Boolean(one) && typeof one === 'object') : []);
const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');
const meterOf = (raw: unknown): number | null => (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null);
const countOf = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);

function itemOf(one: Raw): PendingProgress | null {
  const id = textOf(one.avanceId);
  if (!id) return null;
  return {
    id,
    date: textOf(one.fecha),
    streetId: textOf(one.calleId) || null,
    street: textOf(one.calle) || 'Calle sin nombre',
    fromM: meterOf(one.desdeM),
    toM: meterOf(one.hastaM),
    quantity: countOf(one.metrado),
    work: textOf(one.trabajo),
    note: textOf(one.nota) || null,
    units: countOf(one.unidades),
    photos: countOf(one.fotos),
    by: textOf(one.registradoPor) || null,
  };
}

const objectOf = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});

export function pendingProgressOf(data: unknown): PendingList {
  const outer = objectOf(data);
  // Portal answers `structuredContent: { data }`, and the door hands that over as the tool's data.
  const raw = 'pendientes' in outer ? outer : objectOf(outer.data);
  return { items: listOf(raw.pendientes).flatMap((one) => itemOf(one) ?? []), seesAll: raw.verTodos === true, more: raw.hayMas === true };
}

export function pendingTitle(count: number, more = false): string {
  if (count === 0) return 'Nada por aprobar';
  const words = `${count} avance${count === 1 ? '' : 's'} por aprobar`;
  return more ? `Más de ${words}` : words;
}

/** «Jr. Moquegua · 0+000 a 0+030 · Asfalto QA · 9 nov · por Ana Ruiz». */
export function pendingDetail(item: PendingProgress): string {
  const stretch = item.fromM !== null && item.toM !== null ? `${stationLabel(item.fromM)} a ${stationLabel(item.toM)}` : '';
  const units = item.units ? `${item.units} unidad${item.units === 1 ? '' : 'es'}` : '';
  return [item.street, stretch, item.work, units, item.date ? dayOf(item.date) : '', item.by ? `por ${item.by}` : ''].filter(Boolean).join(' · ');
}

export const workPendingRequest = (): WorkPendingRequest => ({ kind: 'work_pending', forms: FORMS_LEVEL });
export function workResolveRequest(id: string, decision: PendingDecision, note?: string): WorkResolveRequest {
  const clean = note?.trim();
  return { kind: 'work_resolve', progress_id: id, decision, ...(clean ? { note: clean } : {}), forms: FORMS_LEVEL };
}

const sendWorkPending = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: pendingTitle(0), failed: PENDING_FAILED });
const sendWorkResolve = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: RESOLVED, failed: RESOLVE_FAILED });

export type PendingState = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; pending: PendingList };
export const PENDING_LOADING: PendingState = { state: 'loading' };

/** «Por aprobar» above the map (web and APK): asked through the door. */
export async function loadPendingProgress(send: MapEditSend): Promise<PendingState> {
  let result: WorkProgressResult | undefined;
  try {
    result = await send(workPendingRequest(), sendWorkPending);
  } catch {
    // A door that threw is the same «no answer» as one that refused.
    result = undefined;
  }
  if (!result) return { state: 'failed', message: PENDING_FAILED };
  return result.ok ? { state: 'ready', pending: pendingProgressOf(result.data) } : { state: 'failed', message: result.message };
}

/** «Aprobar» / «Rechazar»: null when Portal kept it, else why not. */
export async function resolvePendingProgress(send: MapEditSend, id: string, decision: PendingDecision, note?: string): Promise<string | null> {
  const result = await send(workResolveRequest(id, decision, note), sendWorkResolve);
  return result.ok ? null : result.message;
}

/** Each pending one over its stretch, in its work's color: drawn like a stretch not yet counted. */
export function pendingLinesOf(map: Pick<WorkMap, 'streets' | 'works'>, items: readonly PendingProgress[]): WorkMapLine[] {
  return items.flatMap((item) => {
    if (!item.streetId || item.fromM === null || item.toM === null || item.toM <= item.fromM) return [];
    const line = stretchLineOf(map, item.streetId, item.fromM, item.toM);
    const color = map.works.find((work) => work.name === item.work)?.color;
    return line ? [color ? { ...line, color } : line] : [];
  });
}

/** The stretches the map draws, plus each progress still waiting for approval over its street. */
export const withPendingLines = (map: Pick<WorkMap, 'streets' | 'works'>, stretches: WorkMapLine[], items: readonly PendingProgress[]): WorkMapLine[] =>
  items.length ? [...stretches, ...pendingLinesOf(map, items)] : stretches;
