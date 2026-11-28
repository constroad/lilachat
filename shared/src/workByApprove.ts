import { FORMS_LEVEL } from './appForms.js';
import { stationLabel, type WorkMap, type WorkMapProgress } from './workMap.js';
import { workResolveRequest, type WorkResolveRequest } from './workPending.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * Field progress counts as soon as it is recorded (José 28/11: «ningún admin lo aprueba»). Portal
 * still stores it pending until it changes, so `avances_por_aprobar_de_obra` (ALL pending of the
 * service, and the rejected of the last 14 days) is folded into the done progress here. Undo:
 * `deshacer_avance_de_obra` deletes the caller's own while Portal keeps it pending; an admin takes
 * back any other with `resolver_avance_de_obra` «rechazar». PURE: the APK and the web send what this decides.
 */
export type ByApproveState = 'pendiente' | 'rechazado';
export type ByApproveProgress = {
  id: string;
  state: ByApproveState;
  date: string;
  streetId: string | null;
  fromM: number | null;
  toM: number | null;
  workId: string | null;
  quantity: number;
  author: string | null;
  own: boolean;
  rejectNote: string | null;
};
export type ByApproveList = { total: number; items: ByApproveProgress[] };
export type WorkByApproveRequest = { kind: 'work_by_approve'; forms: number };
export type WorkUndoRequest = { kind: 'work_undo'; progress_id: string; forms: number };

export const UNDO_LABEL = 'Deshacer';
export const UNDONE = 'Avance deshecho.';
export const UNDO_FAILED = 'No se pudo deshacer el avance. Revisa tu señal y vuelve a intentarlo.';
const BY_APPROVE_FAILED = 'No se pudo traer el avance registrado.';
/** Kept in the resident's record when an admin takes a progress back from the map. */
const UNDO_NOTE = 'Deshecho desde el mapa.';
export const pendingAlready = (toM: number) => `Ya hay un avance registrado hasta ${stationLabel(toM)} en esta calle.`;
export const undoQuestion = (toM: number) => `¿Deshacer el avance hasta ${stationLabel(toM)}? Deja de sumar al avance de la obra.`;

type Raw = Record<string, unknown>;
const STATES = new Set<string>(['pendiente', 'rechazado']);
const objectOf = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});
const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');
const meterOf = (raw: unknown): number | null => (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null);
const countOf = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);

function progressOf(one: Raw): ByApproveProgress | null {
  const id = textOf(one.avanceId);
  const state = textOf(one.estado);
  if (!id || !STATES.has(state)) return null;
  return {
    id,
    state: state as ByApproveState,
    date: textOf(one.fecha),
    streetId: textOf(one.calleId) || null,
    fromM: meterOf(one.desdeM),
    toM: meterOf(one.hastaM),
    workId: textOf(one.tagId) || textOf(one.partidaId) || null,
    quantity: countOf(one.metrado),
    author: textOf(one.autor) || null,
    own: one.propio === true,
    rejectNote: textOf(one.notaRechazo) || null,
  };
}

/** Portal's `{ total, avances }`, as is or wrapped once more by the door (`data.data`). */
export function byApproveOf(data: unknown): ByApproveList {
  const outer = objectOf(data);
  const raw = 'avances' in outer ? outer : objectOf(outer.data);
  const rows = Array.isArray(raw.avances) ? raw.avances : [];
  const items = rows.flatMap((one) => (one && typeof one === 'object' ? progressOf(one as Raw) ?? [] : []));
  return { total: typeof raw.total === 'number' && Number.isFinite(raw.total) ? raw.total : items.length, items };
}

const pendingItems = (list: ByApproveList | null): ByApproveProgress[] => (list ? list.items.filter((one) => one.state === 'pendiente') : []);

function doneOf(one: ByApproveProgress): WorkMapProgress | null {
  if (!one.streetId || !one.workId || one.fromM === null || one.toM === null || one.toM <= one.fromM) return null;
  return { id: one.id, streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM, date: one.date, rework: false };
}

/** The map with what Portal still keeps pending counted as done (José 28/11); without the list the map stays as is. */
export function withPendingOf(map: WorkMap, list: ByApproveList | null): WorkMap {
  if (!list) return map;
  const known = new Set(map.progress.flatMap((one) => (one.id ? [one.id] : [])));
  const added = pendingItems(list).flatMap((one) => (known.has(one.id) ? [] : doneOf(one) ?? []));
  return { ...map, progress: [...map.progress, ...added] };
}

/** Where the pending progress of that work on that street ends; null when nothing waits. */
export function pendingEndOf(map: Pick<WorkMap, 'pending'>, streetId: string, workId: string): number | null {
  const ends = (map.pending ?? []).filter((one) => one.streetId === streetId && one.workId === workId).map((one) => one.toM);
  return ends.length ? Math.round(Math.max(...ends)) : null;
}

const isUndoable = (one: ByApproveProgress): boolean => one.own && one.state === 'pendiente' && one.toM !== null;

/** The caller's newest pending progress of that work on that street: the one «Deshacer» removes. */
export function undoableOf(list: ByApproveList | null, streetId: string, workId: string): ByApproveProgress | null {
  return list?.items.find((one) => isUndoable(one) && one.streetId === streetId && one.workId === workId) ?? null;
}

/** In the list, «Deshacer» only on the newest own pending one of each street and work. */
export function undoableIds(list: ByApproveList | null): Set<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const one of list?.items ?? []) {
    const key = `${one.streetId}|${one.workId}`;
    if (!isUndoable(one) || seen.has(key)) continue;
    seen.add(key);
    ids.add(one.id);
  }
  return ids;
}

export const workByApproveRequest = (): WorkByApproveRequest => ({ kind: 'work_by_approve', forms: FORMS_LEVEL });
export const workUndoRequest = (id: string): WorkUndoRequest => ({ kind: 'work_undo', progress_id: id, forms: FORMS_LEVEL });

/** The caller's own pending one is deleted; anything else (an admin's undo) is taken back with the existing reject. */
export function undoRequestOf(list: ByApproveList | null, id: string): WorkUndoRequest | WorkResolveRequest {
  const own = list?.items.find((one) => one.id === id && one.own && one.state === 'pendiente');
  return own ? workUndoRequest(id) : workResolveRequest(id, 'rechazar', UNDO_NOTE);
}

const sendByApprove = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: '', failed: BY_APPROVE_FAILED });
const sendUndo = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: UNDONE, failed: UNDO_FAILED });

/** The list next to the map; null when it could not come (an older Portal, no signal): the map works as before. */
export async function loadByApprove(send: MapEditSend): Promise<ByApproveList | null> {
  try {
    const answer = await send(workByApproveRequest(), sendByApprove);
    return answer?.ok ? byApproveOf(answer.data) : null;
  } catch (error) {
    // Quiet by design: without the list the map is today's map, and a log says why.
    console.warn('work-map: by-approve list unavailable', error instanceof Error ? error.message : error);
    return null;
  }
}

/** «Deshacer»: null when Portal deleted or took it back, else Portal's reason. */
export async function undoByApprove(send: MapEditSend, id: string, list: ByApproveList | null): Promise<string | null> {
  const answer = await send(undoRequestOf(list, id), sendUndo);
  return answer.ok ? null : answer.message;
}

/** What the platforms' `useByApprove` runs: load the list into `setList`, and undo then load again. */
export function byApproveActions(sender: { current: MapEditSend | undefined }, setList: (list: ByApproveList | null) => void) {
  let latest: Promise<ByApproveList | null> = Promise.resolve(null);
  const load = (): void => {
    latest = sender.current ? loadByApprove(sender.current) : Promise.resolve(null);
    void latest.then(setList);
  };
  const undo = async (id: string): Promise<string | null> => {
    if (!sender.current) return UNDO_FAILED;
    const failure = await undoByApprove(sender.current, id, await latest);
    if (!failure) load();
    return failure;
  };
  return { load, undo };
}
