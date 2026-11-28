import { lengthOfLine, pickStreet, pointAtMeasure, projectToLine, streetAtTap, type TapFeatures } from '@constroad/shared/obra';
import { metersLabel, type WorkMapLine, type WorkMapPoint, type WorkMapStreet } from './workMap.js';
import type { DischargePin } from './workMapProgress.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { STREET_FAILED, streetDraftProblem, WORK_MAP_DRAFT_COLOR, workStreetRequest, type StreetDraft, type WorkStreetRequest } from './workStreetDraft.js';

/**
 * ma02 «Marcar calles del área» (José approved Portal's prototype 28/11): every road of the base map
 * the engineer taps comes whole and named into one numbered list; «Listo» saves them one by one
 * through the same `guardar_calle_de_obra` as the single-street editor. PURE: APK and web draw here.
 */
/** `key` is also the street's `entry_id`: a resend after a lost answer never saves it twice. */
export type BatchStreet = { key: string; name: string; mapName: string; points: WorkMapPoint[]; widthM: number | null; stageId?: string; source: 'map' | 'hand'; error?: string };
export type StreetBatch = { streets: BatchStreet[] };
export type BatchTap = { kind: 'changed'; batch: StreetBatch } | { kind: 'confirm'; key: string; question: string } | { kind: 'problem'; message: string };
export type BatchSaved = { ok: boolean; batch: StreetBatch; savedCount: number; message: string };

export const EMPTY_BATCH: StreetBatch = { streets: [] };
export const BATCH_NO_STREET = 'Ahí no hay una calle del mapa. Toca sobre la vía, o usa «Trazar a mano».';
export const BATCH_EMPTY = 'Toca en el mapa al menos una calle.';
const NO_NAME = 'Sin nombre';

/** Two lines are the same street when three points along one lie this close to the other (half a lane plus GPS). */
export const SAME_STREET_M = 15;
/** Where the overlap rule looks along a line: a crossing touches at most one of them. */
const SAMPLE_SHARES = [0.25, 0.5, 0.75];

const allNear = (line: WorkMapPoint[], other: WorkMapPoint[]): boolean => {
  const lengthM = lengthOfLine(line);
  return SAMPLE_SHARES.every((share) => {
    const point = pointAtMeasure(line, lengthM * share);
    const foot = point ? projectToLine(other, point) : null;
    return Boolean(foot && foot.distanceM <= SAME_STREET_M);
  });
};

/** The rule against twins: one line lies along the other (a stretch of a road is that road). */
export function sameStreetLine(one: WorkMapPoint[], other: WorkMapPoint[]): boolean {
  if (one.length < 2 || other.length < 2) return false;
  return allNear(one, other) || allNear(other, one);
}

const lengthOf = (street: Pick<BatchStreet, 'points'>): number => (street.points.length < 2 ? 0 : Math.round(lengthOfLine(street.points)));
const edited = (street: BatchStreet): boolean => street.source === 'hand' || street.name !== street.mapName || street.widthM !== null;
const shownName = (name: string): string => name.trim() || NO_NAME;

export const removeBatchStreet = (batch: StreetBatch, key: string): StreetBatch => ({ streets: batch.streets.filter((street) => street.key !== key) });

/** A tap on a street of the list takes it out; with edits it asks first. */
function toggleOff(batch: StreetBatch, street: BatchStreet): BatchTap {
  if (!edited(street)) return { kind: 'changed', batch: removeBatchStreet(batch, street.key) };
  return { kind: 'confirm', key: street.key, question: `«${shownName(street.name)}» tiene cambios. ¿Quitarla de la lista?` };
}

/** A hand street has no road under it: a tap close to its line is a tap on it. */
const handStreetAt = (batch: StreetBatch, tap: WorkMapPoint): BatchStreet | undefined =>
  batch.streets.find((street) => street.source === 'hand' && (projectToLine(street.points, tap)?.distanceM ?? Infinity) <= SAME_STREET_M);

/** One tap on the map: a new road joins the list, a listed one leaves it, a saved one is refused. */
export function tapStreetBatch(batch: StreetBatch, at: TapFeatures, saved: readonly WorkMapStreet[], newKey: string): BatchTap {
  const road = streetAtTap(at);
  const pick = road ? pickStreet(road) : null;
  if (!pick) {
    const hand = handStreetAt(batch, at.tap);
    return hand ? toggleOff(batch, hand) : { kind: 'problem', message: BATCH_NO_STREET };
  }
  const axis = pick.axis.map(({ lat, lng }) => ({ lat, lng }));
  const listed = batch.streets.find((street) => sameStreetLine(street.points, axis));
  if (listed) return toggleOff(batch, listed);
  const twin = saved.find((street) => sameStreetLine(street.line, axis));
  if (twin) return { kind: 'problem', message: `«${shownName(twin.name)}» ya está en la obra.` };
  const street: BatchStreet = { key: newKey, name: pick.name, mapName: pick.name, points: axis, widthM: null, source: 'map' };
  return { kind: 'changed', batch: { streets: [...batch.streets, street] } };
}

/** «Trazar a mano» comes back from the single-street editor as one more item. */
export function addHandStreet(batch: StreetBatch, draft: StreetDraft, key: string): StreetBatch {
  const street: BatchStreet = { key, name: draft.name, mapName: '', points: draft.points.map(({ lat, lng }) => ({ lat, lng })), widthM: draft.widthM, source: 'hand', ...(draft.stageId ? { stageId: draft.stageId } : {}) };
  return { streets: [...batch.streets, street] };
}

/** Rename or set a width; the item's last error goes with the edit. */
export function editBatchStreet(batch: StreetBatch, key: string, change: Partial<Pick<BatchStreet, 'name' | 'widthM'>>): StreetBatch {
  if (!batch.streets.some((street) => street.key === key)) return batch;
  return { streets: batch.streets.map((street) => (street.key === key ? { ...withoutError(street), ...change } : street)) };
}

const withoutError = (street: BatchStreet): BatchStreet => {
  const { error: _dropped, ...rest } = street;
  return rest;
};

export const batchCountLabel = (count: number): string => (count === 1 ? '1 calle' : `${count} calles`);
export const batchDoneLabel = (count: number): string => `Listo · ${batchCountLabel(count)}`;
/** `index` counts from zero: the street being sent now. */
export const batchSaveLabel = (index: number, total: number): string => `Guardando ${index + 1} de ${total}…`;
export const batchStreetLengthM = lengthOf;

/** «3 calles · 917 m» under «Área de trabajo». */
export function batchTotals(batch: StreetBatch): { count: number; lengthM: number; label: string } {
  const lengthM = batch.streets.reduce((sum, street) => sum + lengthOf(street), 0);
  return { count: batch.streets.length, lengthM, label: `${batchCountLabel(batch.streets.length)} · ${metersLabel(lengthM)}` };
}

/** What the single-street engine checks and sends for one item. */
export const batchStreetDraft = (street: BatchStreet): StreetDraft => ({ name: street.name, points: street.points, widthM: street.widthM, mode: street.source === 'hand' ? 'hand' : 'street', pick: null, ...(street.stageId ? { stageId: street.stageId } : {}) });

/** What stops «Listo», with the number of the street on the map. */
export function batchProblem(batch: StreetBatch): string | null {
  if (!batch.streets.length) return BATCH_EMPTY;
  for (const [index, street] of batch.streets.entries()) {
    const problem = streetDraftProblem(batchStreetDraft(street));
    if (problem) return `Calle ${index + 1}: ${problem}`;
  }
  return null;
}

export const batchRequests = (batch: StreetBatch): WorkStreetRequest[] => batch.streets.map((street) => workStreetRequest(batchStreetDraft(street), street.key));

/** The number of each street at its middle, as the prototype draws it. */
export function batchPins(batch: StreetBatch): DischargePin[] {
  return batch.streets.flatMap((street, index) => {
    const middle = pointAtMeasure(street.points, lengthOfLine(street.points) / 2);
    return middle ? [{ id: `lote-${street.key}`, label: String(index + 1), lat: middle.lat, lng: middle.lng, outside: false }] : [];
  });
}

export const batchLines = (batch: StreetBatch): WorkMapLine[] =>
  batch.streets.filter((street) => street.points.length >= 2).map((street) => ({ streetId: `lote-${street.key}`, color: WORK_MAP_DRAFT_COLOR, coordinates: street.points.map((point) => [point.lng, point.lat] as [number, number]) }));

type StreetSave = (draft: StreetDraft, entryId: string) => Promise<WorkProgressResult>;

const sendOne = async (save: StreetSave, street: BatchStreet): Promise<WorkProgressResult> => {
  try {
    return await save(batchStreetDraft(street), street.key);
  } catch {
    // A dropped socket or a thrown door: the street stays in the list with the plain retry message.
    return { ok: false, message: STREET_FAILED };
  }
};

const doneMessage = (count: number): string => (count === 1 ? '1 calle guardada. Ya aparece en el mapa.' : `${count} calles guardadas. Ya aparecen en el mapa.`);

/** «Se guardó 1 de 5. »: nothing when the first one failed. */
const savedSoFar = (count: number, total: number): string => (count === 0 ? '' : `${count === 1 ? 'Se guardó 1' : `Se guardaron ${count}`} de ${total}. `);

/** One by one, in the list's order; the first failure stops it and the unsaved stay with Portal's message. */
export async function saveStreetBatch(batch: StreetBatch, save: StreetSave, onProgress: (index: number, total: number) => void): Promise<BatchSaved> {
  const total = batch.streets.length;
  for (const [index, street] of batch.streets.entries()) {
    onProgress(index, total);
    const sent = await sendOne(save, street);
    if (!sent.ok) {
      const left = batch.streets.slice(index).map((one) => (one.key === street.key ? { ...one, error: sent.message } : one));
      return { ok: false, batch: { streets: left }, savedCount: index, message: `${savedSoFar(index, total)}${shownName(street.name)}: ${sent.message}` };
    }
  }
  return { ok: true, batch: EMPTY_BATCH, savedCount: total, message: doneMessage(total) };
}
