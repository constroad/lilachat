import { pointAtMeasure, projectToLine, STREET_REACH_M } from '@constroad/shared/obra';
import { metersLabel, stationLabel, type WorkMap, type WorkMapLine, type WorkMapPoint, type WorkMapStreet, type WorkMapView } from './workMap.js';
import { GPS_OFF_STREET, GPS_WEAK, manualProblem, pendingProblem, progressPreviewOf, progressTargetOf, type ManualProgressDraft } from './workManualProgress.js';
import { stretchLineOf } from './workMapProgress.js';
import type { StationMark } from './workMapStations.js';
import type { StreetHandle } from './workStreetPick.js';
import { WALK_MAX_ACCURACY_M, type GpsFix } from './workStreetWalk.js';

/**
 * «Registrar avance de <trabajo>» (design ma04, José 28/11; Portal's approved prototype): the street
 * comes from the phone's GPS, a big ring is dragged along its axis from where the work stopped, and
 * «Tomar foto y registrar» sends the same `work_manual_progress` as before (pending until an admin
 * approves it). PURE: the APK and the web draw what this decides.
 */
export type GpsStreet = { streetId: string; name: string; accuracyM: number; distanceM: number };
/** No street by GPS: `problem` says why (null when there was no position at all). */
export type GpsStreetMiss = { problem: string | null };
export type RecordSummary = { gain: string; stretch: string; area: string | null; areaHow: string | null; total: string; donePct: number; newPct: number };
export type RecordMap = { view: WorkMapView; stretch: WorkMapLine[]; pending: WorkMapLine[]; stations: StationMark[]; handles: StreetHandle[] };

export const RECORD_PHOTO_AND_SEND = 'Tomar foto y registrar';
export const RECORD_WITHOUT_PHOTO = 'Registrar sin foto';
export const RECORD_SEND = 'Registrar avance';
export const RECORD_TO_ME = 'Hasta mi ubicación';
export const RECORD_WHOLE = 'Toda la calle';
export const RECORD_CHANGE = 'Cambiar';
export const RECORD_LOCATING = 'Buscando tu calle…';
export const RECORD_WHICH_STREET = '¿En qué calle?';
export const RECORD_ADD_NOTE = 'Agregar nota';
export const RECORD_NOTE_PLACEHOLDER = 'Nota (opcional)';
export const RECORD_PENDING_NOTE = 'Queda pendiente hasta que un admin lo apruebe.';
export const recordTitle = (workName: string | null) => (workName ? `Registrar avance de ${workName}` : 'Registrar avance');
export const recordHint = (workName: string) => `Arrastra el círculo hasta donde llegó ${workName}`;
export const youAreOn = (located: Pick<GpsStreet, 'name' | 'accuracyM'>) => `Estás en ${located.name} · ±${Math.round(located.accuracyM)} m`;

const FULL_PCT = 100;
/** Portal refuses an end past the street's length plus half a meter. */
const END_TOLERANCE_M = 0.5;

const workedStreets = (map: Pick<WorkMap, 'streets' | 'scopes'>): WorkMapStreet[] => {
  const worked = new Set(map.scopes.filter((scope) => scope.workIds.length > 0).map((scope) => scope.streetId));
  return map.streets.filter((street) => worked.has(street.id) && street.line.length >= 2);
};

/** The worked street under the phone; a weak fix or one far from every street leaves the choice to the person. */
export function gpsStreetOf(map: Pick<WorkMap, 'streets' | 'scopes'>, fix: GpsFix | null): GpsStreet | GpsStreetMiss {
  if (!fix) return { problem: null };
  if (fix.accuracyM > WALK_MAX_ACCURACY_M) return { problem: GPS_WEAK(fix.accuracyM) };
  const feet = workedStreets(map).flatMap((street) => {
    const foot = projectToLine(street.line, fix);
    return foot ? [{ street, distanceM: foot.distanceM }] : [];
  });
  const nearest = feet.sort((one, other) => one.distanceM - other.distanceM)[0];
  if (!nearest) return { problem: null };
  if (nearest.distanceM > STREET_REACH_M) return { problem: GPS_OFF_STREET(nearest.distanceM) };
  return { streetId: nearest.street.id, name: nearest.street.name, accuracyM: fix.accuracyM, distanceM: nearest.distanceM };
}

/** The street given by whoever opened the screen wins; else the GPS one; null opens the chooser. */
export const recordStreetOf = (given: string | null, located: GpsStreet | GpsStreetMiss | null): string | null =>
  given ?? (located && 'streetId' in located ? located.streetId : null);

/** The big ring at the end, on the axis, with its chainage; `drop` renews it after each drag so it snaps. */
export function recordHandleOf(street: WorkMapStreet, toM: number, drop: number): StreetHandle | null {
  const point = street.line.length >= 2 ? pointAtMeasure(street.line, toM) : null;
  return point ? { handle: 'end', point, label: stationLabel(toM), key: `avance-${street.id}-${Math.round(toM)}-${drop}` } : null;
}

const endLimit = (lengthM: number) => Math.floor(lengthM + END_TOLERANCE_M);

/** The ring dropped anywhere: snapped onto the axis, never before the start nor past the street. */
export function recordDropAt(draft: ManualProgressDraft, line: WorkMapPoint[], lengthM: number, point: WorkMapPoint): ManualProgressDraft {
  const foot = line.length >= 2 ? projectToLine(line, point) : null;
  if (!foot) return draft;
  return { ...draft, toM: Math.min(endLimit(lengthM), Math.max(draft.fromM, Math.round(foot.measureM))) };
}

/** «Toda la calle»: to the end of the work's stretch on the street, or the street's end without one. */
export function recordWholeStreet(map: Pick<WorkMap, 'scopes'>, streetId: string, draft: ManualProgressDraft, lengthM: number): ManualProgressDraft {
  const ends = map.scopes.filter((scope) => scope.streetId === streetId && draft.workId !== null && scope.workIds.includes(draft.workId)).map((scope) => scope.toM);
  const endM = ends.length ? Math.min(Math.max(...ends), lengthM) : lengthM;
  return { ...draft, toM: Math.max(draft.fromM, Math.min(endLimit(lengthM), Math.round(endM))) };
}

const percentOf = (meters: number, lengthM: number) => (lengthM > 0 ? Math.max(0, Math.min(FULL_PCT, Math.round((meters / lengthM) * FULL_PCT))) : 0);
const areaLabel = (squareM: number) => `${metersLabel(squareM).slice(0, -2)} m²`;

/** «+46 m · 0+120 → 0+166 · 276 m²»; the area only when the street has its width. */
export function recordSummary(draft: Pick<ManualProgressDraft, 'fromM' | 'toM'>, lengthM: number, widthM?: number): RecordSummary {
  const gainM = Math.max(0, draft.toM - draft.fromM);
  return {
    gain: `+${metersLabel(gainM)}`,
    stretch: `${stationLabel(draft.fromM)} → ${stationLabel(Math.max(draft.fromM, draft.toM))}`,
    area: widthM ? areaLabel(gainM * widthM) : null,
    areaHow: widthM ? `${metersLabel(gainM)} × ${metersLabel(widthM)}` : null,
    total: `Total calle: ${metersLabel(lengthM)}`,
    donePct: percentOf(draft.fromM, lengthM),
    newPct: percentOf(gainM, lengthM),
  };
}

/** What blocks it, checked BEFORE the camera opens: what already waits (no twin), no work, no length, past the street. */
export function recordProblem(map: Pick<WorkMap, 'pending'>, streetId: string, lengthM: number, draft: ManualProgressDraft): string | null {
  return pendingProblem(map, streetId, draft.workId, draft.toM) ?? manualProblem(draft, lengthM);
}

/** The street alone with what is done, what waits (dashed), the new stretch and its ring. */
export function recordMapOf(map: WorkMap, streetId: string, draft: ManualProgressDraft, drop: number): RecordMap {
  const preview = progressPreviewOf(map, streetId, draft);
  const color = (workId: string) => map.works.find((work) => work.id === workId)?.color;
  const pending = (map.pending ?? []).filter((one) => one.streetId === streetId).flatMap((one) => {
    const line = stretchLineOf(map, streetId, one.fromM, one.toM);
    const tint = color(one.workId);
    return line ? [{ ...line, workId: one.workId, ...(tint ? { color: tint } : {}) }] : [];
  });
  const street = map.streets.find((one) => one.id === streetId);
  const handle = street ? recordHandleOf(street, draft.toM, drop) : null;
  return { view: preview.view, stretch: preview.stretch, pending, stations: preview.stations, handles: handle ? [handle] : [] };
}

/** The streets «¿En qué calle?» offers: those with work, as «Registrar avance» on the map counts them. */
export function recordStreetChoices(map: Pick<WorkMap, 'streets' | 'scopes'>): Array<{ id: string; name: string }> {
  const target = progressTargetOf(map);
  if (target.kind === 'choose') return target.streets;
  return target.kind === 'street' ? map.streets.filter((one) => one.id === target.streetId).map(({ id, name }) => ({ id, name })) : [];
}

/** One GPS read when the screen opens; the answer is dropped once the screen closed (the returned cancel). */
/** What the screen knows of where the phone is: nothing yet, a street, or why not. */
export type RecordLocation = GpsStreet | GpsStreetMiss | null;

export function locateRecordStreet(read: () => Promise<GpsFix | null>, mapNow: () => Pick<WorkMap, 'streets' | 'scopes'>, onLocated: (located: GpsStreet | GpsStreetMiss) => void): () => void {
  let alive = true;
  void read().then((fix) => { if (alive) onLocated(gpsStreetOf(mapNow(), fix)); });
  return () => { alive = false; };
}

export type RecordStage = { kind: 'sent'; message: string } | { kind: 'record'; streetId: string; located: GpsStreet | null } | { kind: 'choose'; problem: string | null; locating: boolean };

/** What the screen shows: the answer, the street with its ring, or «¿En qué calle?». */
export function recordStageOf(state: { picked: string | null; located: GpsStreet | GpsStreetMiss | null; choosing: boolean; sent: string | null }): RecordStage {
  if (state.sent) return { kind: 'sent', message: state.sent };
  const streetId = recordStreetOf(state.picked, state.located);
  const { located } = state;
  if (streetId && !state.choosing) return { kind: 'record', streetId, located: located && 'streetId' in located && located.streetId === streetId ? located : null };
  return { kind: 'choose', problem: located && 'problem' in located ? located.problem : null, locating: !located && !state.picked };
}
