import { FORMS_LEVEL } from './appForms.js';
import { metersLabel, stationLabel } from './workMap.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * What was deleted from the map and how an admin brings it back (José 07/11: a logical delete an
 * admin can undo). Portal answers the list in the tool's `data` (agentes 890b02e).
 * PURE: the APK and the web draw from here.
 */
export type DeletedStreet = { id: string; name: string; lengthM: number; deletedAt: string; deletedBy: string | null };
export type DeletedScope = { id: string; streetId: string; fromM: number; toM: number; deletedAt: string; deletedBy: string | null };
export type DeletedWork = { streets: DeletedStreet[]; scopes: DeletedScope[] };
export type DeletedRow = { kind: 'street' | 'scope'; id: string; title: string; detail: string };
export type WorkRestoreRequest = { kind: 'work_restore'; street_id?: string; scope_id?: string; forms: number };
export type WorkDeletedRequest = { kind: 'work_deleted'; forms: number };

export const NOTHING_DELETED = 'No hay calles ni tramos borrados.';
export const DELETED_FAILED = 'No se pudo traer lo borrado. Revisa tu señal y vuelve a intentarlo.';
export const RESTORED = 'Restaurado.';
export const RESTORE_FAILED = 'No se pudo restaurar. Revisa tu señal y vuelve a intentarlo.';

type Raw = Record<string, unknown>;
const listOf = (raw: unknown): Raw[] => (Array.isArray(raw) ? raw.filter((one): one is Raw => Boolean(one) && typeof one === 'object') : []);
const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw : '');
const numberOf = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
const byOf = (raw: unknown): string | null => (typeof raw === 'string' && raw.trim() ? raw.trim() : null);

export function deletedWorkOf(data: unknown): DeletedWork {
  const raw = (data && typeof data === 'object' ? data : {}) as Raw;
  const streets = listOf(raw.calles).flatMap((one) => (textOf(one.calleId) ? [{ id: textOf(one.calleId), name: textOf(one.nombre), lengthM: numberOf(one.largoM), deletedAt: textOf(one.borradoEl), deletedBy: byOf(one.borradoPor) }] : []));
  const scopes = listOf(raw.tramos).flatMap((one) => (textOf(one.tramoId) ? [{ id: textOf(one.tramoId), streetId: textOf(one.calleId), fromM: numberOf(one.desdeM), toM: numberOf(one.hastaM), deletedAt: textOf(one.borradoEl), deletedBy: byOf(one.borradoPor) }] : []));
  return { streets, scopes };
}

const LIMA = 'America/Lima';
/** Built once: Hermes pays a new `Intl` object on every call. */
let dayFormat: Intl.DateTimeFormat | undefined;
let hourFormat: Intl.DateTimeFormat | undefined;
const whenOf = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  dayFormat ??= new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, day: 'numeric', month: 'short' });
  hourFormat ??= new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dayFormat.format(date).replace('.', '')}, ${hourFormat.format(date).replace(/\s/g, ' ')}`;
};
const deletedLine = (word: string, at: string, by: string | null) => [`${word} el ${whenOf(at)}`, by ? `por ${by}` : ''].filter(Boolean).join(' ');

/** One row per street and per stretch, the newest first; `names` names a stretch's street still on the map. */
export function deletedRowsOf(deleted: DeletedWork, names: Map<string, string>): DeletedRow[] {
  const streets = deleted.streets.map((street) => ({ at: street.deletedAt, row: { kind: 'street' as const, id: street.id, title: street.name || 'Calle sin nombre', detail: `${metersLabel(street.lengthM)} · ${deletedLine('borrada', street.deletedAt, street.deletedBy)}` } }));
  const scopes = deleted.scopes.map((scope) => {
    const where = names.get(scope.streetId);
    const parts = [...(where ? [where] : []), metersLabel(scope.toM - scope.fromM), deletedLine('borrado', scope.deletedAt, scope.deletedBy)];
    return { at: scope.deletedAt, row: { kind: 'scope' as const, id: scope.id, title: `Tramo ${stationLabel(scope.fromM)} a ${stationLabel(scope.toM)}`, detail: parts.join(' · ') } };
  });
  return [...streets, ...scopes].sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0)).map((entry) => entry.row);
}

export const workDeletedRequest = (): WorkDeletedRequest => ({ kind: 'work_deleted', forms: FORMS_LEVEL });
export const workRestoreRequest = (row: Pick<DeletedRow, 'kind' | 'id'>): WorkRestoreRequest =>
  ({ kind: 'work_restore', ...(row.kind === 'street' ? { street_id: row.id } : { scope_id: row.id }), forms: FORMS_LEVEL });

export const sendWorkDeleted = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: NOTHING_DELETED, failed: DELETED_FAILED });
export const sendWorkRestore = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: RESTORED, failed: RESTORE_FAILED });

export type DeletedList = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; rows: DeletedRow[] };
export const DELETED_LOADING: DeletedList = { state: 'loading' };

/** The admin's «Borrados» list (web and APK): asked through the door, named with the streets on the map. */
export async function loadDeletedRows(send: MapEditSend, names: Map<string, string>): Promise<DeletedList> {
  const result = await send(workDeletedRequest(), sendWorkDeleted);
  return result.ok ? { state: 'ready', rows: deletedRowsOf(deletedWorkOf(result.data), names) } : { state: 'failed', message: result.message };
}

/** «Restaurar»: null when Portal brought it back, else why not. */
export async function restoreDeleted(send: MapEditSend, row: Pick<DeletedRow, 'kind' | 'id'>): Promise<string | null> {
  const result = await send(workRestoreRequest(row), sendWorkRestore);
  return result.ok ? null : result.message;
}
