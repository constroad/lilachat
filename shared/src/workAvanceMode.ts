import { metersLabel, percentLabel, stationLabel, type WorkMap, type WorkMapFilter } from './workMap.js';
import { layerPercentOf } from './workLayerPercent.js';
import { brushRequests } from './workMapBrush.js';
import { manualProblem, manualStartOf, sendWorkManualProgress, workManualProgressRequest, MANUAL_NO_LENGTH, type WorkManualProgressRequest } from './workManualProgress.js';
import { sendWorkScope, type MapEditSend, type WorkScopeRequest } from './workScopeDraft.js';
import type { WorkProgressResult } from './workProgressSend.js';
import { pendingAlready, pendingEndOf } from './workByApprove.js';

/**
 * «Modo Avance» (design av-01, José 27/11): pick a work in the strip, tap a street, pick a big
 * percent and save. It reuses the map's two doors: the stretch (`work_scope`, only when the street
 * does not carry the work yet) and the manual progress (`work_manual_progress`), which waits for an
 * admin's approval as before. PURE: the APK and the web draw and send what this decides.
 */
export const AVANCE_PERCENTS = [0, 25, 50, 75, 100] as const;
export type AvancePercent = (typeof AVANCE_PERCENTS)[number];
const FULL_PERCENT = 100;

export type AvanceChip = { id: string; name: string; color: string; percent: number; label: string; selected: boolean };
/** `doneM`: the approved end of that work on the street; `fromM`: where the new progress starts; `pendingM`: where what waits for approval ends. */
export type AvanceTarget = { streetId: string; streetName: string; workId: string; workName: string; lengthM: number; doneM: number; fromM: number; needsScope: boolean; pendingM: number | null };
export type AvanceRequest = WorkScopeRequest | WorkManualProgressRequest;
/** One id per save for each door: a resend after a lost answer is the same entry, never a twin. */
export type AvanceEntryIds = { scope: string; progress: string };

export const AVANCE_TITLE = 'Avance de la obra';
export const AVANCE_NO_WORKS = 'Aún no hay trabajos (imprimación, base, carpeta…). Crea uno para marcar su avance.';
export const AVANCE_FOOTER = 'Se guarda con la fecha de hoy y tu nombre';
export const AVANCE_PICK_STREET = 'Toca una calle de la obra en el mapa.';
export const avanceHint = (workName: string) => `Toca una calle para marcar su avance de ${workName}`;
export const avanceAlready = (doneM: number, workName: string) => `Esta calle ya va en ${metersLabel(doneM)} de ${workName}.`;
export const avanceStartsLater = (fromM: number) => `El trabajo empieza en la progresiva ${stationLabel(fromM)} de esta calle.`;

/** The strip of works (design av-01): each one with `layerPercentOf`, the one percent of a layer. */
export function avanceChipsOf(map: WorkMap, selectedId: string | null, filter: WorkMapFilter = {}): AvanceChip[] {
  return map.works.map((work) => {
    const percent = layerPercentOf(map, work.id, filter);
    return { id: work.id, name: work.name, color: work.color, percent, label: `${work.name} ${percentLabel(percent)}`, selected: work.id === selectedId };
  });
}

/** The picked work while it exists; otherwise the first one, so the mode opens ready. */
export function avancePickedWork(map: Pick<WorkMap, 'works'>, selectedId: string | null): string | null {
  if (selectedId && map.works.some((work) => work.id === selectedId)) return selectedId;
  return map.works[0]?.id ?? null;
}

const carries = (map: Pick<WorkMap, 'scopes'>, streetId: string, workId: string) =>
  map.scopes.some((scope) => scope.streetId === streetId && scope.workIds.includes(workId));

/** The map as it will be once the work is on the street: where its progress would start. */
function withWorkOnStreet(map: WorkMap, streetId: string, workId: string, lengthM: number): WorkMap {
  const own = map.scopes.filter((scope) => scope.streetId === streetId);
  if (!own.length) return { ...map, scopes: [...map.scopes, { id: 'planned', streetId, fromM: 0, toM: Math.round(lengthM), workIds: [workId] }] };
  return { ...map, scopes: map.scopes.map((scope) => (scope.streetId === streetId ? { ...scope, workIds: [...scope.workIds, workId] } : scope)) };
}

const approvedEnd = (map: Pick<WorkMap, 'progress'>, streetId: string, workId: string): number => {
  const ends = map.progress.filter((one) => one.streetId === streetId && one.workId === workId && !one.rework).map((one) => one.toM);
  return ends.length ? Math.round(Math.max(...ends)) : 0;
};

/** What the panel shows for the tapped street and the picked work; null when either is gone. */
export function avanceTargetOf(map: WorkMap, streetId: string, workId: string): AvanceTarget | null {
  const street = map.streets.find((one) => one.id === streetId);
  const work = map.works.find((one) => one.id === workId);
  if (!street || !work) return null;
  const needsScope = !carries(map, streetId, workId);
  const planned = needsScope ? withWorkOnStreet(map, streetId, workId, street.lengthM) : map;
  return { streetId, streetName: street.name, workId, workName: work.name, lengthM: Math.round(street.lengthM), doneM: approvedEnd(map, streetId, workId), fromM: manualStartOf(planned, streetId, workId), needsScope, pendingM: pendingEndOf(map, streetId, workId) };
}

/** «50 %» of the street: the chainage where the work arrives. */
export const avanceEndFor = (target: Pick<AvanceTarget, 'lengthM'>, percent: number): number => Math.round((target.lengthM * percent) / FULL_PERCENT);

/** «IMPRIMACIÓN · JR. LIMA» over the street's name. */
export const avanceKicker = (target: Pick<AvanceTarget, 'workName' | 'streetName'>) => `${target.workName} · ${target.streetName}`.toLocaleUpperCase('es');

/** «60 m de 120 m» and the bar's percent. */
export function avanceProgressLine(target: Pick<AvanceTarget, 'doneM' | 'lengthM'>): { line: string; percent: number } {
  const percent = target.lengthM > 0 ? Math.min(FULL_PERCENT, Math.round((target.doneM / target.lengthM) * FULL_PERCENT)) : 0;
  return { line: `${metersLabel(target.doneM)} de ${metersLabel(target.lengthM)}`, percent };
}

/** Why the chosen end cannot go; null when it can. What is already done is said in words. */
export function avanceProblem(target: AvanceTarget, toM: number | null): string | null {
  if (toM === null) return MANUAL_NO_LENGTH;
  if (target.pendingM !== null && toM <= target.pendingM) return pendingAlready(target.pendingM);
  if (toM <= target.fromM) {
    if (target.doneM > 0) return avanceAlready(target.doneM, target.workName);
    return target.fromM > 0 ? avanceStartsLater(target.fromM) : MANUAL_NO_LENGTH;
  }
  return manualProblem({ workId: target.workId, fromM: target.fromM, toM, photoIds: [], note: '' }, target.lengthM);
}

/** In order: the stretch when the street lacks the work (the brush's rule), then the progress. */
export function avanceRequests(map: WorkMap, target: AvanceTarget, toM: number, ids: AvanceEntryIds, now: Date): AvanceRequest[] {
  const scope = target.needsScope ? brushRequests(map, { kind: 'work', id: target.workId }, target.streetId, ids.scope) : [];
  const draft = { workId: target.workId, fromM: target.fromM, toM, photoIds: [], note: '' };
  return [...scope, workManualProgressRequest(map, target.streetId, draft, ids.progress, now)];
}

type AvanceSave = { map: WorkMap; target: AvanceTarget; toM: number | null; ids: AvanceEntryIds; now: Date; send: MapEditSend };

/** «Guardar avance»: checks, then sends each request; the first refusal stops and is what is read. */
export async function runAvanceSave(save: AvanceSave): Promise<WorkProgressResult> {
  const problem = avanceProblem(save.target, save.toM);
  if (problem || save.toM === null) return { ok: false, message: problem ?? MANUAL_NO_LENGTH };
  let answer: WorkProgressResult = { ok: false, message: MANUAL_NO_LENGTH };
  for (const request of avanceRequests(save.map, save.target, save.toM, save.ids, save.now)) {
    answer = await save.send(request, request.kind === 'work_scope' ? sendWorkScope : (deps) => sendWorkManualProgress(deps, ''));
    if (!answer.ok) return answer;
  }
  return answer;
}
