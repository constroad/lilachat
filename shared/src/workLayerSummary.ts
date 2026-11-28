import { FULL_PCT, layerMeasuresOf, layerPercentOf, layerScopeOf, layerUnitOf, pendingOfLayer, shareOf, streetQuantitiesOf, type LayerUnit, type StreetMeasure } from './workLayerPercent.js';
import { metersLabel, percentLabel, type WorkMap, type WorkMapFilter } from './workMap.js';
import { WORK_NOT_ASSIGNED } from './workMapLayers.js';
import { feedWhen } from './workProgressFeed.js';
import { manualDraftFor, pickManualWork, type ManualProgressDraft } from './workManualProgress.js';
import { recordTitle } from './workProgressRecord.js';
import type { ByApproveList } from './workByApprove.js';
import { avancePickedWork, type AvanceChip } from './workAvanceMode.js';

/**
 * The work map by layer (design ma01, José 28/11; Portal's approved prototype): one chip per layer
 * with its percent, and the sheet of the active one — «3 590 de 6 325 m² · 57 %», one row per street
 * with its bar, what waits for approval hatched apart (never in the percent), and the latest
 * progress. Area when every stretch of the layer has a width; metres otherwise, said discreetly.
 * PURE: the APK and the web draw what this decides.
 */
export type LayerStreetSummary = {
  streetId: string;
  name: string;
  doneQty: number;
  pendingQty: number;
  totalQty: number;
  percent: number;
  /** Bar widths, 0–100: approved, then pending after it. */
  donePct: number;
  pendingPct: number;
  amount: string;
  percentText: string;
};
export type LayerSummary = Omit<LayerStreetSummary, 'streetId' | 'name'> & {
  workId: string;
  name: string;
  color: string;
  unit: LayerUnit;
  kicker: string;
  headline: string;
  /** «En metros: 2 calles sin ancho»; null when everything is in m². */
  widthNote: string | null;
  streets: LayerStreetSummary[];
  recordLabel: string;
};
export type LayerLatest = { text: string; pill: string | null };

export const LAYER_PENDING_PILL = 'por aprobar';
export const layerWidthNote = (count: number) => `En metros: ${count === 1 ? '1 calle' : `${count} calles`} sin ancho`;

const TIME_OF_DAY = /T(\d{2}):(\d{2})/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;
const LIMA_OFFSET_MS = 5 * 3_600_000;

const quantityText = (value: number, unit: LayerUnit) => `${metersLabel(value).slice(0, -2)} ${unit}`;

function figuresOf(done: number, pending: number, total: number, unit: LayerUnit) {
  const percent = Math.round(shareOf(done, total));
  const donePct = shareOf(done, total);
  return { doneQty: done, pendingQty: pending, totalQty: total, percent, donePct, pendingPct: Math.min(FULL_PCT - donePct, shareOf(pending, total)), amount: `${metersLabel(done).slice(0, -2)} de ${quantityText(total, unit)}`, percentText: percentLabel(percent) };
}

/** One street of the layer in its unit: area piece by piece, or plain metres. */
function streetSummaryOf(measure: StreetMeasure, unit: LayerUnit): LayerStreetSummary {
  const { done, pending, total } = streetQuantitiesOf(measure, unit);
  return { streetId: measure.street.id, name: measure.street.name, ...figuresOf(done, pending, total, unit) };
}

/** The sheet of one layer; null when the map has no such layer. */
export function layerSummaryOf(map: Pick<WorkMap, 'streets' | 'scopes' | 'progress' | 'works'>, workId: string, list: ByApproveList | null, filter: WorkMapFilter = {}): LayerSummary | null {
  const work = map.works.find((one) => one.id === workId);
  if (!work) return null;
  const measures = layerMeasuresOf(layerScopeOf(map, filter), workId, list);
  const { unit, widthless } = layerUnitOf(measures);
  const streets = measures.map((measure) => streetSummaryOf(measure, unit));
  const sum = (pick: (row: LayerStreetSummary) => number) => streets.reduce((total, row) => total + pick(row), 0);
  const figures = figuresOf(sum((row) => row.doneQty), sum((row) => row.pendingQty), sum((row) => row.totalQty), unit);
  // The layer's percent comes from the one function every place reads (`layerPercentOf`).
  const percent = layerPercentOf(map, workId, filter);
  return {
    ...figures,
    percent,
    percentText: percentLabel(percent),
    workId,
    name: work.name,
    color: work.color,
    unit,
    kicker: work.name.toLocaleUpperCase('es'),
    headline: streets.length ? figures.amount : WORK_NOT_ASSIGNED,
    widthNote: streets.length && widthless ? layerWidthNote(widthless) : null,
    streets,
    recordLabel: recordTitle(work.name),
  };
}

/** The strip of layers (ma01): each chip with `layerPercentOf`, as its sheet, «Modo Avance» and «Capas». */
export function layerChipsOf(map: Pick<WorkMap, 'streets' | 'scopes' | 'progress' | 'works'>, selectedId: string | null, filter: WorkMapFilter = {}): AvanceChip[] {
  return map.works.map((work) => {
    const percent = layerPercentOf(map, work.id, filter);
    return { id: work.id, name: work.name, color: work.color, percent, label: `${work.name} ${percentLabel(percent)}`, selected: work.id === selectedId };
  });
}

type LatestEntry = { date: string; streetId: string | null; lengthM: number; pending: boolean };

/** «10:42» in Lima when the date carries a time; nothing for a bare day. */
function timeOf(date: string): string {
  if (!TIME_OF_DAY.test(date)) return '';
  if (!HAS_ZONE.test(date)) return TIME_OF_DAY.exec(date)!.slice(1, 3).join(':');
  const instant = Date.parse(date);
  return Number.isFinite(instant) ? new Date(instant - LIMA_OFFSET_MS).toISOString().slice(11, 16) : '';
}

/** The Lima day of a date that may carry a time and a zone. */
function dayOfEntry(date: string): string {
  if (!HAS_ZONE.test(date) || !TIME_OF_DAY.test(date)) return date.slice(0, 10);
  const instant = Date.parse(date);
  return Number.isFinite(instant) ? new Date(instant - LIMA_OFFSET_MS).toISOString().slice(0, 10) : date.slice(0, 10);
}

function latestEntries(map: Pick<WorkMap, 'progress'>, workId: string, list: ByApproveList | null): LatestEntry[] {
  const approved = map.progress.filter((one) => one.workId === workId && !one.rework && one.date).map((one) => ({ date: one.date, streetId: one.streetId, lengthM: one.toM - one.fromM, pending: false }));
  const waiting = pendingOfLayer(list, workId).filter((one) => one.date).map((one) => ({ date: one.date, streetId: one.streetId, lengthM: one.fromM !== null && one.toM !== null ? one.toM - one.fromM : one.quantity, pending: true }));
  return [...waiting, ...approved];
}

/** «Último: hoy 10:42 · Jr. Progreso +46 m» with «por aprobar» apart; null when the layer has no dated progress. */
export function layerLatestOf(map: Pick<WorkMap, 'streets' | 'progress'>, workId: string, list: ByApproveList | null, today: string): LayerLatest | null {
  // ISO dates sort as plain strings; on a tie what waits (listed first) stays first.
  const newest = latestEntries(map, workId, list).reduce<LatestEntry | null>((best, one) => (!best || dayOfEntry(one.date) + timeOf(one.date) > dayOfEntry(best.date) + timeOf(best.date) ? one : best), null);
  if (!newest) return null;
  const day = dayOfEntry(newest.date);
  const when = [feedWhen(day, today).toLowerCase(), timeOf(newest.date)].filter(Boolean).join(' ');
  const street = map.streets.find((one) => one.id === newest.streetId)?.name;
  const parts = [`Último: ${when || day}`, `${street ? `${street} ` : ''}+${metersLabel(Math.max(0, newest.lengthM))}`];
  return { text: parts.join(' · '), pill: newest.pending ? LAYER_PENDING_PILL : null };
}

/** «Registrar avance de <capa>» (ma04): the GPS and «¿En qué calle?» only among the layer's streets, when it has any. */
export function layerRecordMap(map: WorkMap, workId: string | null): WorkMap {
  const own = workId ? map.scopes.filter((scope) => scope.workIds.includes(workId)) : [];
  return own.length ? { ...map, scopes: own } : map;
}

/** The ma04 draft opened from a layer: that layer picked when the street carries it. */
export function layerDraftFor(map: WorkMap, streetId: string, workId: string | null): { works: ReturnType<typeof manualDraftFor>['works']; draft: ManualProgressDraft } {
  const start = manualDraftFor(map, streetId);
  if (!workId || !start.works.some((work) => work.id === workId)) return start;
  return { works: start.works, draft: pickManualWork(map, streetId, start.draft, workId) };
}

/** The bar's widths as styles: approved from the left, then what waits right after it. */
type Percent = `${number}%`;
export const layerBarOf = (summary: Pick<LayerStreetSummary, 'donePct' | 'pendingPct'>): { done: Percent; pending: Percent; pendingLeft: Percent } => ({ done: `${summary.donePct}%`, pending: `${summary.pendingPct}%`, pendingLeft: `${summary.donePct}%` });

export type ActiveLayer = { workId: string | null; chips: AvanceChip[]; summary: LayerSummary | null; latest: LayerLatest | null };

/** Everything ma01 draws for the layer picked (or the first one): chips, sheet and latest line. */
export function activeLayerOf(map: WorkMap, list: ByApproveList | null, chosen: string | null, today: string, filter: WorkMapFilter = {}): ActiveLayer {
  const workId = avancePickedWork(map, chosen);
  return {
    workId,
    chips: layerChipsOf(map, workId, filter),
    summary: workId ? layerSummaryOf(map, workId, list, filter) : null,
    latest: workId ? layerLatestOf(layerScopeOf(map, filter), workId, list, today) : null,
  };
}
