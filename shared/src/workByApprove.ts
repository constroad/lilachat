import { FORMS_LEVEL } from './appForms.js';
import { dayOf } from './serviceDetail.js';
import { streetWidthExpression } from './workLineWidth.js';
import { stationLabel, type WorkMap, type WorkMapLine, type WorkMapPendingStretch } from './workMap.js';
import { stretchLineOf } from './workMapProgress.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * What waits for approval, on the map (José 28/11: the pending progress was invisible and the same
 * stretch could be registered twice). Portal's `avances_por_aprobar_de_obra` lists ALL pending
 * progress of the service (anyone's) and the rejected of the last 14 days, newest first;
 * `deshacer_avance_de_obra` deletes the caller's own while it is still pending. Member tools,
 * through the member's door only. PURE: the APK and the web draw and send what this decides.
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

export const BY_APPROVE_PILL = 'POR APROBAR';
export const REJECTED_PILL = 'RECHAZADO';
export const UNDO_LABEL = 'Deshacer';
export const UNDONE = 'Avance deshecho.';
export const UNDO_FAILED = 'No se pudo deshacer el avance. Revisa tu señal y vuelve a intentarlo.';
const BY_APPROVE_FAILED = 'No se pudo traer lo que espera aprobación.';
const NO_STREET = 'Calle sin nombre';
export const pendingAlready = (toM: number) => `Ya hay un avance por aprobar hasta ${stationLabel(toM)} en esta calle.`;
export const undoQuestion = (toM: number) => `¿Deshacer el avance hasta ${stationLabel(toM)}? Se borra antes de que lo aprueben.`;

/** MapLibre paint of what waits: the work's color, solid and half-transparent, as wide as the street (José 28/11: no dashes). */
export const WORK_MAP_PENDING_PAINT = { 'line-color': ['get', 'color'], 'line-width': streetWidthExpression(4), 'line-opacity': 0.65 };

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
export const pendingCountOf = (list: ByApproveList | null): number => pendingItems(list).length;
export const rejectedOf = (list: ByApproveList | null): ByApproveProgress[] => (list ? list.items.filter((one) => one.state === 'rechazado') : []);

function stretchOf(one: ByApproveProgress): WorkMapPendingStretch | null {
  if (!one.streetId || !one.workId || one.fromM === null || one.toM === null || one.toM <= one.fromM) return null;
  return { streetId: one.streetId, workId: one.workId, fromM: one.fromM, toM: one.toM };
}

/** The map that also knows what waits, so «desde» skips it; without the list the map stays as is. */
export const withPendingOf = (map: WorkMap, list: ByApproveList | null): WorkMap =>
  (list ? { ...map, pending: pendingItems(list).flatMap((one) => stretchOf(one) ?? []) } : map);

/** Where the pending progress of that work on that street ends; null when nothing waits. */
export function pendingEndOf(map: Pick<WorkMap, 'pending'>, streetId: string, workId: string): number | null {
  const ends = (map.pending ?? []).filter((one) => one.streetId === streetId && one.workId === workId).map((one) => one.toM);
  return ends.length ? Math.round(Math.max(...ends)) : null;
}

/** Each pending one over its stretch, in its work's color; the rejected are not drawn. */
export function byApproveLinesOf(map: Pick<WorkMap, 'streets' | 'works'>, list: ByApproveList | null): WorkMapLine[] {
  return pendingItems(list).flatMap((one) => {
    const stretch = stretchOf(one);
    const line = stretch ? stretchLineOf(map, stretch.streetId, stretch.fromM, stretch.toM) : null;
    const color = map.works.find((work) => work.id === one.workId)?.color;
    return line && stretch ? [{ ...line, workId: stretch.workId, ...(color ? { color } : {}) }] : [];
  });
}

/** «Jr. Lima · 0+030 a 0+060 · Imprimación · 28 nov · por Ana Ruiz». */
export function byApproveDetail(map: Pick<WorkMap, 'streets' | 'works'>, one: ByApproveProgress): string {
  const street = map.streets.find((candidate) => candidate.id === one.streetId)?.name ?? NO_STREET;
  const stretch = one.fromM !== null && one.toM !== null ? `${stationLabel(one.fromM)} a ${stationLabel(one.toM)}` : '';
  const work = map.works.find((candidate) => candidate.id === one.workId)?.name ?? '';
  return [street, stretch, work, one.date ? dayOf(one.date) : '', one.author ? `por ${one.author}` : ''].filter(Boolean).join(' · ');
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

/** «Deshacer»: null when Portal deleted it, else Portal's reason. */
export async function undoByApprove(send: MapEditSend, id: string): Promise<string | null> {
  const answer = await send(workUndoRequest(id), sendUndo);
  return answer.ok ? null : answer.message;
}

/** What the platforms' `useByApprove` runs: load the list into `setList`, and undo then load again. */
export function byApproveActions(sender: { current: MapEditSend | undefined }, setList: (list: ByApproveList | null) => void) {
  const load = (): void => {
    if (sender.current) void loadByApprove(sender.current).then(setList);
    else setList(null);
  };
  const undo = async (id: string): Promise<string | null> => {
    if (!sender.current) return UNDO_FAILED;
    const failure = await undoByApprove(sender.current, id);
    if (!failure) load();
    return failure;
  };
  return { load, undo };
}
