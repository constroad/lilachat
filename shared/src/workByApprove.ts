import { FORMS_LEVEL } from './appForms.js';
import { stationLabel, type WorkMap, type WorkMapProgress } from './workMap.js';
import { workResolveRequest, type WorkResolveRequest } from './workPending.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * Field progress counts as soon as it is recorded (José 28/11: «ningún admin lo aprueba»). The door
 * `work_by_approve` reads Portal's `historial_de_avances_de_obra`: every pending record plus all
 * resolved in the last 30 days (at most 200, newest first). Pending ones are folded into the done
 * progress here. Undo: `deshacer_avance_de_obra` on the caller's own when Portal says `puedeDeshacer`;
 * an admin takes back any other with `resolver_avance_de_obra` «rechazar». Portal's «deshecho» is kept
 * as `rechazado` (the old list's word): neither counts. PURE: the APK and the web send what this decides.
 */
export type ByApproveState = 'pendiente' | 'aprobado' | 'rechazado';
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
  /** Photos Portal reports on it, when it does (José 28/11: «Agregar foto»). */
  photos?: number;
  /** Portal's `puedeDeshacer` (own, not undone, open work); null when the older list did not say. */
  canUndo?: boolean | null;
};
export type ByApproveList = { total: number; items: ByApproveProgress[] };
export type WorkByApproveRequest = { kind: 'work_by_approve'; forms: number };
export type WorkUndoRequest = { kind: 'work_undo'; progress_id: string; forms: number };

export const UNDO_LABEL = 'Deshacer';
export const UNDONE = 'Avance deshecho.';
export const UNDO_FAILED = 'No se pudo deshacer el avance. Revisa tu señal y vuelve a intentarlo.';
const BY_APPROVE_FAILED = 'No se pudo cargar el historial';
/** Kept in the resident's record when an admin takes a progress back from the map. */
const UNDO_NOTE = 'Deshecho desde el mapa.';
export const pendingAlready = (toM: number) => `Ya hay un avance registrado hasta ${stationLabel(toM)} en esta calle.`;
export const undoQuestion = (toM: number) => `¿Deshacer el avance hasta ${stationLabel(toM)}? Deja de sumar al avance de la obra.`;

type Raw = Record<string, unknown>;
/** Portal's word for each state; «deshecho» (the history) and «rechazado» (the older list) read the same. */
const STATES: Readonly<Record<string, ByApproveState>> = { pendiente: 'pendiente', aprobado: 'aprobado', deshecho: 'rechazado', rechazado: 'rechazado' };
const objectOf = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});
const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw.trim() : '');
const meterOf = (raw: unknown): number | null => (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null);
const countOf = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
const photosOf = (one: Raw): number => (Array.isArray(one.fotoIds) ? one.fotoIds.length : Math.max(0, countOf(one.fotos)));

function progressOf(one: Raw): ByApproveProgress | null {
  const id = textOf(one.avanceId);
  const state = STATES[textOf(one.estado)];
  if (!id || !state) return null;
  return {
    id,
    state,
    date: textOf(one.fecha),
    streetId: textOf(one.calleId) || null,
    fromM: meterOf(one.desdeM),
    toM: meterOf(one.hastaM),
    workId: textOf(one.tagId) || textOf(one.partidaId) || null,
    quantity: countOf(one.metrado),
    author: textOf(one.autor) || null,
    own: one.propio === true,
    rejectNote: textOf(one.notaRechazo) || null,
    photos: photosOf(one),
    canUndo: typeof one.puedeDeshacer === 'boolean' ? one.puedeDeshacer : null,
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

/** Portal decides with `puedeDeshacer`; the older list only allowed the caller's own pending one. */
const isUndoable = (one: ByApproveProgress): boolean =>
  one.toM !== null && (typeof one.canUndo === 'boolean' ? one.own && one.canUndo : one.own && one.state === 'pendiente');

/** The caller's newest pending progress of that work on that street: the one «Deshacer» removes. */
export function undoableOf(list: ByApproveList | null, streetId: string, workId: string): ByApproveProgress | null {
  return list?.items.find((one) => isUndoable(one) && one.streetId === streetId && one.workId === workId) ?? null;
}

/** In the list, «Deshacer» where Portal says `puedeDeshacer`; with the older list, the newest own pending one of each street and work. */
export function undoableIds(list: ByApproveList | null): Set<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const one of list?.items ?? []) {
    const key = `${one.streetId}|${one.workId}`;
    if (!isUndoable(one)) continue;
    if (typeof one.canUndo === 'boolean') {
      ids.add(one.id);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    ids.add(one.id);
  }
  return ids;
}

export const workByApproveRequest = (): WorkByApproveRequest => ({ kind: 'work_by_approve', forms: FORMS_LEVEL });
export const workUndoRequest = (id: string): WorkUndoRequest => ({ kind: 'work_undo', progress_id: id, forms: FORMS_LEVEL });

/** The caller's own undoable one is deleted; anything else (an admin's undo) is taken back with the existing reject. */
export function undoRequestOf(list: ByApproveList | null, id: string): WorkUndoRequest | WorkResolveRequest {
  const own = list?.items.find((one) => one.id === id && isUndoable(one));
  return own ? workUndoRequest(id) : workResolveRequest(id, 'rechazar', UNDO_NOTE);
}

const sendByApprove = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: '', failed: BY_APPROVE_FAILED });
const sendUndo = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: UNDONE, failed: UNDO_FAILED });

/** The history next to the map; null when it could not come (the tool not approved yet, no signal): the map works as before and the list says so. */
export async function loadByApprove(send: MapEditSend): Promise<ByApproveList | null> {
  try {
    const answer = await send(workByApproveRequest(), sendByApprove);
    if (answer?.ok && answer.data !== undefined) return byApproveOf(answer.data);
    console.warn('work-map: progress history unavailable', answer?.message ?? 'no answer');
    return null;
  } catch (error) {
    console.warn('work-map: progress history unavailable', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The history and whether its last load failed: «No se pudo cargar el historial» with «Reintentar», never a silent gap. */
export type ByApproveLoad = { list: ByApproveList | null; failed: boolean };
export const BY_APPROVE_IDLE: ByApproveLoad = { list: null, failed: false };

/** «Deshacer»: null when Portal deleted or took it back, else Portal's reason. */
export async function undoByApprove(send: MapEditSend, id: string, list: ByApproveList | null): Promise<string | null> {
  const answer = await send(undoRequestOf(list, id), sendUndo);
  return answer.ok ? null : answer.message;
}

/** What the platforms' `useByApprove` runs: load the history into `setLoad` (a failure kept the last list), and undo then load again. */
export function byApproveActions(sender: { current: MapEditSend | undefined }, setLoad: (update: (previous: ByApproveLoad) => ByApproveLoad) => void) {
  let latest: Promise<ByApproveList | null> = Promise.resolve(null);
  const load = (): void => {
    const send = sender.current;
    latest = send ? loadByApprove(send) : Promise.resolve(null);
    void latest.then((list) => setLoad((previous) => (list ? { list, failed: false } : { list: previous.list, failed: Boolean(send) })));
  };
  const undo = async (id: string): Promise<string | null> => {
    if (!sender.current) return UNDO_FAILED;
    const failure = await undoByApprove(sender.current, id, await latest);
    if (!failure) load();
    return failure;
  };
  return { load, undo };
}
