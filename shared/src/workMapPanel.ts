import { workMapCutLabel, type WorkMap, type WorkMapFilter, type WorkMapStreetRow, type WorkMapView } from './workMap.js';

/**
 * The right panel of the map (design `o-01-mapa-obra`): the bar by work under the big figure and
 * the streets grouped by stage. PURE: the web and the APK draw from here.
 */
export type WorkShare = { workId: string; color: string; percent: number };
export type StageGroup = { id: string; name: string | null; lengthM: number; streets: WorkMapStreetRow[] };

const ONE_DECIMAL = 10;
const PERCENT = 100;

/** Each work's done meters over the planned length: the segments of the stacked bar. */
export function workShares(view: WorkMapView): WorkShare[] {
  if (view.totalM <= 0) return [];
  return view.works.flatMap((work) => {
    const doneM = view.done.filter((line) => line.workId === work.id).reduce((sum, line) => sum + Math.max(0, (line.toM ?? 0) - (line.fromM ?? 0)), 0);
    const percent = Math.round((doneM / view.totalM) * PERCENT * ONE_DECIMAL) / ONE_DECIMAL;
    return percent > 0 ? [{ workId: work.id, color: work.color, percent }] : [];
  });
}

const stageOf = (map: Pick<WorkMap, 'scopes'>, streetId: string) => map.scopes.find((scope) => scope.streetId === streetId)?.stageId;

/** The streets of the view under their stage, in the order of the stages; without stages, one group. */
export function workMapStageGroups(map: Pick<WorkMap, 'scopes' | 'stages'>, view: Pick<WorkMapView, 'streets'>): StageGroup[] {
  const lengthOf = (stageId: string | undefined) => map.scopes.filter((scope) => scope.stageId === stageId).reduce((sum, scope) => sum + (scope.toM - scope.fromM), 0);
  const staged = map.stages.map((stage) => ({ id: stage.id, name: stage.name, lengthM: lengthOf(stage.id), streets: view.streets.filter((street) => stageOf(map, street.id) === stage.id) }));
  const loose = view.streets.filter((street) => !map.stages.some((stage) => stage.id === stageOf(map, street.id)));
  const groups = [...staged, ...(loose.length ? [{ id: 'sin-etapa', name: map.stages.length ? 'Sin etapa' : null, lengthM: lengthOf(undefined), streets: loose }] : [])];
  return groups.filter((group) => group.streets.length > 0);
}

/** The date chip over the map. */
export const workMapCutChip = (filter: WorkMapFilter): string => (filter.untilDay ? workMapCutLabel(filter.untilDay) : 'Hasta hoy');

/** Where a stage is, from its streets: what the design writes after its name («Etapa 1 · En ejecución»). */
export function stageStateLabel(group: Pick<StageGroup, 'streets'>): string {
  if (group.streets.every((street) => street.done)) return 'Terminada';
  return group.streets.some((street) => street.segments.length > 0) ? 'En ejecución' : 'Por iniciar';
}
