import { mergeIntervals } from '@constroad/shared/obra';
import { metersLabel, stationLabel, workMapView, type WorkMap, type WorkMapFilter, type WorkMapLine } from './workMap.js';

/**
 * Partial progress (design o-08, José 06/11: which streets are in base, primed or paved): what
 * each work has done, street by street, for the stage and the day the map shows. Only approved progress, as the client sees it. PURE: the web and the APK draw it.
 */
export type PartialRow = { workId: string; name: string; color: string; streets: string };
export type PartialSummary = { rows: PartialRow[]; streetsWithProgress: number; streetsTotal: number; doneLabel: string };

/** Half a metre either side still counts as the whole street (Portal's own tolerance). */
const WHOLE_STREET_SLACK_M = 0.5;
type Interval = [number, number];

function stretchText(name: string, lengthM: number, intervals: Interval[]): string {
  const [first] = intervals;
  if (intervals.length === 1 && first && first[0] <= WHOLE_STREET_SLACK_M && first[1] >= lengthM - WHOLE_STREET_SLACK_M) return name;
  if (intervals.length === 1 && first && first[0] <= WHOLE_STREET_SLACK_M) return `${name} hasta ${stationLabel(first[1])}`;
  return `${name} ${intervals.map(([from, to]) => `${stationLabel(from)} a ${stationLabel(to)}`).join(', ')}`;
}

function streetsOfWork(map: WorkMap, lines: WorkMapLine[]): string {
  const byStreet = new Map<string, Interval[]>();
  for (const line of lines) {
    if (line.fromM === undefined || line.toM === undefined) continue;
    byStreet.set(line.streetId, [...(byStreet.get(line.streetId) ?? []), [line.fromM, line.toM]]);
  }
  return map.streets.flatMap((street) => {
    const intervals = byStreet.get(street.id);
    return intervals ? [stretchText(street.name, street.lengthM, mergeIntervals(intervals))] : [];
  }).join(' · ');
}

/** The last work first: what reads first is how far the work went (asphalt over base). */
export function partialProgressOf(map: WorkMap, filter: WorkMapFilter): PartialSummary {
  const view = workMapView(map, { stageId: filter.stageId, untilDay: filter.untilDay });
  const rows = [...map.works].reverse().flatMap((work) => {
    const lines = view.done.filter((line) => line.workId === work.id);
    return lines.length ? [{ workId: work.id, name: work.name, color: work.color, streets: streetsOfWork(map, lines) }] : [];
  });
  const touched = new Set(view.done.map((line) => line.streetId));
  return { rows, streetsWithProgress: touched.size, streetsTotal: view.streets.length, doneLabel: `+${metersLabel(view.doneM)} lineales` };
}

export const partialStreetsLabel = ({ streetsWithProgress, streetsTotal }: Pick<PartialSummary, 'streetsWithProgress' | 'streetsTotal'>): string =>
  `${streetsWithProgress} de ${streetsTotal} ${streetsTotal === 1 ? 'vía' : 'vías'}`;

export type CutOption = { id: string; label: string };
export const WHOLE_WORK = 'Toda la obra';

const stageStreets = (map: WorkMap, stageId: string): string[] =>
  map.streets.filter((street) => map.scopes.some((scope) => scope.stageId === stageId && scope.streetId === street.id)).map((street) => street.name);

/** «Etapa de obra» of o-08: each stage says its streets, as the design does. */
export const shareStageOptions = (map: WorkMap): CutOption[] =>
  [{ id: '', label: WHOLE_WORK }, ...map.stages.map((stage) => {
    const streets = stageStreets(map, stage.id);
    return { id: stage.id, label: streets.length ? `${stage.name} (${streets.join(', ')})` : stage.name };
  })];

/** «Qué» of o-12: the whole work or a stage, each with its planned metres. */
export const exportStageOptions = (map: WorkMap): CutOption[] =>
  [{ id: '', label: WHOLE_WORK }, ...map.stages.map((stage) => ({ id: stage.id, label: `${stage.name} (${metersLabel(workMapView(map, { stageId: stage.id }).totalM)})` }))];

export type KmzLayer = { workId: string; name: string; color: string; meters: string };
export type KmzLayers = { done: KmzLayer[]; pending: string };

/** «Estructura de capas KMZ generada» (o-12): the folders the file carries and their metres. */
export function kmzLayersOf(map: WorkMap, filter: WorkMapFilter): KmzLayers {
  const view = workMapView(map, filter);
  const done = map.works.flatMap((work) => {
    const meters = view.done.filter((line) => line.workId === work.id).reduce((sum, line) => sum + ((line.toM ?? 0) - (line.fromM ?? 0)), 0);
    return meters > 0 ? [{ workId: work.id, name: work.name, color: work.color, meters: metersLabel(meters) }] : [];
  });
  return { done, pending: metersLabel(Math.max(0, view.totalM - view.doneM)) };
}
