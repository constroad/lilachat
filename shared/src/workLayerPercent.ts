import { mergeIntervals } from '@constroad/shared/obra';
import type { WorkMap, WorkMapFilter, WorkMapStreet } from './workMap.js';
import type { ByApproveList, ByApproveProgress } from './workByApprove.js';

/**
 * How far a layer (work) of the map went: the ONE source of its percent (José 28/11: never two
 * different % for the same layer). Area approved over area planned when every stretch of the layer
 * has a width (the stretch's, else the street's); metres otherwise. Overlapping stretches count once,
 * at the wider width; rework and what waits for approval never count. The ma01 chips and sheet,
 * «Modo Avance» and «Capas y leyenda» all read it. PURE.
 */
export type LayerUnit = 'm²' | 'm';

type Interval = [number, number];
/** One piece of a street the layer covers, with the width it is paved at (none when unknown). */
export type Piece = { fromM: number; toM: number; widthM: number | null };
export type StreetMeasure = { street: WorkMapStreet; pieces: Piece[]; done: Interval[]; pending: Interval[] };

export const FULL_PCT = 100;

export const overlapOf = (piece: Piece, intervals: Interval[]): number =>
  intervals.reduce((total, [from, to]) => total + Math.max(0, Math.min(to, piece.toM) - Math.max(from, piece.fromM)), 0);

/** `left` without what `right` covers; both merged and sorted. */
function subtractIntervals(left: Interval[], right: Interval[]): Interval[] {
  return left.flatMap(([from, to]) => {
    const kept: Interval[] = [];
    let cursor = from;
    for (const [cutFrom, cutTo] of right) {
      if (cutTo <= cursor || cutFrom >= to) continue;
      if (cutFrom > cursor) kept.push([cursor, cutFrom]);
      cursor = Math.max(cursor, cutTo);
    }
    if (cursor < to) kept.push([cursor, to]);
    return kept;
  });
}

/** The stretches of the layer cut where any of them starts or ends: an overlap is counted once, at its widest. */
function piecesOf(map: Pick<WorkMap, 'scopes'>, street: WorkMapStreet, workId: string): Piece[] {
  const own = map.scopes.filter((scope) => scope.streetId === street.id && scope.workIds.includes(workId) && scope.toM > scope.fromM);
  const cuts = [...new Set(own.flatMap((scope) => [Math.max(0, scope.fromM), scope.toM]))].sort((one, other) => one - other);
  return cuts.slice(1).flatMap((toM, index) => {
    const fromM = cuts[index]!;
    const covering = own.filter((scope) => scope.fromM <= fromM && scope.toM >= toM);
    if (!covering.length || toM <= fromM) return [];
    const widths = covering.flatMap((scope) => { const width = scope.widthM ?? street.widthM; return width ? [width] : []; });
    return [{ fromM, toM, widthM: widths.length === covering.length ? Math.max(...widths) : null }];
  });
}

export const pendingOfLayer = (list: ByApproveList | null, workId: string): ByApproveProgress[] =>
  (list?.items ?? []).filter((one) => one.state === 'pendiente' && one.workId === workId);

export function measureOf(map: Pick<WorkMap, 'scopes' | 'progress'>, street: WorkMapStreet, workId: string, list: ByApproveList | null): StreetMeasure {
  const approved = map.progress.filter((one) => one.streetId === street.id && one.workId === workId && !one.rework);
  const done = mergeIntervals(approved.map((one): Interval => [one.fromM, one.toM]));
  const waiting = pendingOfLayer(list, workId).flatMap((one): Interval[] => (one.streetId === street.id && one.fromM !== null && one.toM !== null && one.toM > one.fromM ? [[one.fromM, one.toM]] : []));
  return { street, pieces: piecesOf(map, street, workId), done, pending: subtractIntervals(mergeIntervals(waiting), done) };
}

/** The streets the layer covers, measured; what waits for approval only with the list. */
export const layerMeasuresOf = (map: Pick<WorkMap, 'streets' | 'scopes' | 'progress'>, workId: string, list: ByApproveList | null): StreetMeasure[] =>
  map.streets.map((street) => measureOf(map, street, workId, list)).filter((measure) => measure.pieces.length > 0);

/** m² only when every piece has a width; `widthless`: the streets that force metres. */
export function layerUnitOf(measures: StreetMeasure[]): { unit: LayerUnit; widthless: number } {
  const widthless = measures.filter((measure) => measure.pieces.some((piece) => piece.widthM === null)).length;
  return { unit: measures.length && !widthless ? 'm²' : 'm', widthless };
}

/** A street in the layer's unit: planned, approved and waiting quantities. */
export function streetQuantitiesOf(measure: StreetMeasure, unit: LayerUnit): { total: number; done: number; pending: number } {
  const weight = (piece: Piece) => (unit === 'm²' ? piece.widthM ?? 0 : 1);
  const sumOf = (length: (piece: Piece) => number) => measure.pieces.reduce((sum, piece) => sum + length(piece) * weight(piece), 0);
  return { total: sumOf((piece) => piece.toM - piece.fromM), done: sumOf((piece) => overlapOf(piece, measure.done)), pending: sumOf((piece) => overlapOf(piece, measure.pending)) };
}

/** 0–100 without rounding, capped. */
export const shareOf = (part: number, whole: number) => (whole > 0 ? Math.min(FULL_PCT, (part / whole) * FULL_PCT) : 0);

type LayerMap = Pick<WorkMap, 'streets' | 'scopes' | 'progress'>;

/**
 * The map as the board's filter in force counts it («Capas y leyenda»: the figures stay those of the
 * filter): only the stage's stretches, only the progress up to the cut day. The filter's work does
 * not narrow it: each layer is measured on its own.
 */
export function layerScopeOf<Shown extends LayerMap>(map: Shown, filter: WorkMapFilter = {}): Shown {
  const { stageId, untilDay } = filter;
  if (!stageId && !untilDay) return map;
  // Days are `YYYY-MM-DD`: they compare as plain text.
  const progress = untilDay ? map.progress.filter((one) => one.date <= untilDay) : map.progress;
  return { ...map, scopes: stageId ? map.scopes.filter((scope) => scope.stageId === stageId) : map.scopes, progress };
}

/** THE percent of a layer under the board's filter, rounded: the same number in every place that shows it. */
export function layerPercentOf(map: LayerMap, workId: string, filter: WorkMapFilter = {}): number {
  const measures = layerMeasuresOf(layerScopeOf(map, filter), workId, null);
  const { unit } = layerUnitOf(measures);
  const totals = measures.map((measure) => streetQuantitiesOf(measure, unit));
  return Math.round(shareOf(totals.reduce((sum, one) => sum + one.done, 0), totals.reduce((sum, one) => sum + one.total, 0)));
}
