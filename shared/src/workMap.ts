import { colorForPartida, kmLabel, lengthOfLine, mergeIntervals, projectToLine, sliceLine as sliceStreet } from '@constroad/shared/obra';
import { dayMonthOf } from './appDirectory.js';
import type { ServiceMapResult } from './serviceMap.js';

/**
 * The work map of a service (José 06/11: «el mapa literal de la obra»). Portal owns the streets,
 * the stretches and the approved progress; this reads what it shows a client and turns it into
 * figures and lines. The figures add up like Portal's report (`workMapOverview`): the client must
 * not read two percentages. PURE: the server, the app and the web use it.
 */
export type WorkMapPoint = { lat: number; lng: number };
export type WorkMapStreet = { id: string; name: string; line: WorkMapPoint[]; lengthM: number; widthM?: number };
/** `id` and `widthM` let the person edit or delete a stretch (o-03, step 3). */
export type WorkMapScope = { id: string; streetId: string; fromM: number; toM: number; workIds: string[]; stageId?: string; widthM?: number };
export type WorkMapProgress = { streetId: string; workId: string; fromM: number; toM: number; date: string; rework: boolean };
/** `partida`: a contracted item, not a tag of the map; the progress names it `partidaId`. */
export type WorkMapWork = { id: string; name: string; color: string; partida?: true };
export type WorkMapStage = { id: string; name: string };
export type WorkMap = { streets: WorkMapStreet[]; scopes: WorkMapScope[]; progress: WorkMapProgress[]; works: WorkMapWork[]; stages: WorkMapStage[] };

export type WorkMapFilter = { stageId?: string; workId?: string; untilDay?: string };
/** A done line also says its stations, so an export can name the stretch. */
export type WorkMapLine = { streetId: string; workId?: string; color: string; coordinates: Array<[number, number]>; fromM?: number; toM?: number };
export type WorkMapStreetRow = {
  id: string;
  name: string;
  lengthM: number;
  status: string;
  done: boolean;
  segments: Array<{ workId: string; color: string; fromPct: number; widthPct: number }>;
};
export type WorkMapView = {
  percent: number;
  doneM: number;
  totalM: number;
  works: Array<WorkMapWork & { percent: number }>;
  streets: WorkMapStreetRow[];
  planned: WorkMapLine[];
  done: WorkMapLine[];
  bounds: [[number, number], [number, number]] | null;
};

export type WorkMapState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string; url?: string }
  | { kind: 'ready'; url: string; map: WorkMap | null };

/** MapLibre paints with plain colors: a CSS variable does not reach its canvas. */
export const WORK_MAP_PLANNED_COLOR = '#94a3b8';
export const WORK_MAP_FAILED = 'No se pudo cargar el mapa. Prueba de nuevo.';
/** Design o-10: what a space admin reads in a service without streets (José 07/11: «dónde voy a crear el mapa»). */
export const WORK_MAP_FIRST = {
  kicker: 'Mapa de la obra',
  title: 'Todavía no hay calles',
  hint: 'Marca dónde se va a trabajar. El avance y el informe del cliente salen de aquí.',
  steps: ['Dibuja las calles', 'Pártelas en etapas', 'Marca los trabajos'],
  draw: 'Dibujar la primera calle',
  action: 'O dibújala en el Portal',
} as const;

const UNNAMED_WORK = 'Trabajo';
const NO_PROGRESS = 'Sin avance';
export const NO_STRETCHES = 'Sin tramos definidos';
const FINISHED = 'Terminada';
const COMPLETE_PCT = 100;
const MAX_STATUS_PARTS = 2;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PORTAL_ORIGIN = 'https://constroad.com';
const SERVICE_LINK = /^https:\/\/(?:www\.)?constroad\.com\/public\/(?:[a-z0-9-]+\/)?service-report\/([A-Za-z0-9_-]{16,128})(?:[/?#]|$)/;
const SERVICE_ID = /^[0-9a-f]{24}$/;

type Interval = [number, number];
type Fields = Record<string, unknown>;

const round2 = (value: number) => Math.round(value * 100) / 100;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const listOf = (value: unknown): Fields[] => (Array.isArray(value) ? value.filter(isFields) : []);
const textOf = (value: unknown) => (typeof value === 'string' ? value : '');
const numberOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const textsOf = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : []);

/** Where Portal answers for a service link; null for anything that is not one of its links. */
export function workMapRequest(link: string, serviceId: string): string | null {
  const token = SERVICE_LINK.exec(link)?.[1];
  if (!token || !SERVICE_ID.test(serviceId)) return null;
  return `${PORTAL_ORIGIN}/api/public/client-portal/services/${serviceId}?token=${token}`;
}

export const percentLabel = (percent: number) => `${String(percent).replace('.', ',')} %`;
export const metersLabel = (meters: number) => `${String(Math.round(meters)).replace(/\B(?=(\d{3})+$)/g, ' ')} m`;

/** The figure over the map; a work without stretches has nothing to add up yet. */
export const workMapHeadline = (view: Pick<WorkMapView, 'percent' | 'doneM' | 'totalM'>) =>
  view.totalM > 0 ? `${percentLabel(view.percent)} · ${metersLabel(view.doneM)} de ${metersLabel(view.totalM)}` : NO_STRETCHES;

/** A station as the field writes it: 1420 m is «1+420». */
export function stationLabel(meters: number): string {
  const whole = Math.round(meters);
  return `${Math.floor(whole / 1000)}+${String(whole % 1000).padStart(3, '0')}`;
}

/** The street's length following its bends: the same metres Portal shows (`@constroad/shared/obra`). */
export const lineLengthM = (line: WorkMapPoint[]): number => lengthOfLine(line);

type LineFoot = { measureM: number; distanceM: number };

/** Where a place falls on a street: its station and how far off the axis, as Portal projects it. */
export function projectOntoLine(line: WorkMapPoint[], place: WorkMapPoint): LineFoot | null {
  const foot = projectToLine(line, place);
  return foot ? { measureM: foot.measureM, distanceM: foot.distanceM } : null;
}

/** The part of a street between two stations, keeping its corners; nothing for an empty cut. */
export const sliceLine = (line: WorkMapPoint[], fromM: number, toM: number): WorkMapPoint[] => sliceStreet(line, fromM, toM);

/** Metres of the stretch rounded to the centimetre, as Portal adds them per stretch (`progressByWork`). */
const metersOf = (intervals: Interval[]) => round2(intervals.reduce((total, [from, to]) => total + (to - from), 0));

/**
 * Portal counts a street even when its line cannot be drawn (fewer than two points): its stretches add
 * to the totals. Here it stays too; only the drawing leaves it out.
 */
function streetsFrom(raw: unknown): WorkMapStreet[] {
  return listOf(raw).flatMap((street) => {
    const id = textOf(street._id);
    const line = listOf(street.geometry).map((point) => ({ lat: point.lat as number, lng: point.lng as number })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const widthM = numberOf(street.widthM);
    return id ? [{ id, name: textOf(street.name), line, lengthM: numberOf(street.lengthM) || lineLengthM(line), ...(widthM > 0 ? { widthM } : {}) }] : [];
  });
}

function scopesFrom(raw: unknown, streets: WorkMapStreet[]): WorkMapScope[] {
  const known = new Set(streets.map((street) => street.id));
  return listOf(raw).flatMap((scope) => {
    const tags = textsOf(scope.tagIds);
    const stageId = textOf(scope.stageId);
    if (!known.has(textOf(scope.streetId))) return [];
    const widthM = numberOf(scope.widthM);
    return [{ id: textOf(scope._id), streetId: textOf(scope.streetId), fromM: numberOf(scope.fromM), toM: numberOf(scope.toM), workIds: tags.length ? tags : textsOf(scope.partidaIds), ...(stageId ? { stageId } : {}), ...(widthM > 0 ? { widthM } : {}) }];
  });
}

function progressFrom(raw: unknown): WorkMapProgress[] {
  return listOf(raw).flatMap((record) => {
    const workId = textOf(record.tagId) || textOf(record.partidaId);
    return workId ? [{ streetId: textOf(record.streetId), workId, fromM: numberOf(record.fromM), toM: numberOf(record.toM), date: textOf(record.date), rework: record.rework === true }] : [];
  });
}

const byOrder = (left: Fields, right: Fields) => numberOf(left.order) - numberOf(right.order);

/**
 * Tags first, in their order; then the partidas of the stretches that have no tag. The colors are
 * Portal's (`colorForPartida`): priming blue, asphalt black, base brown, as in the drawings. A tag
 * whose color is not a hex gets the same rule, so MapLibre never receives a color it cannot paint.
 */
function worksFrom(rawTags: unknown, rawPartidas: unknown, scopes: WorkMapScope[]): WorkMapWork[] {
  const tags = [...listOf(rawTags)].sort(byOrder).map((tag) => {
    const [id, name, color] = [textOf(tag._id), textOf(tag.name) || UNNAMED_WORK, textOf(tag.color)];
    return { id, name, color: HEX_COLOR.test(color) ? color : colorForPartida(id, name) };
  });
  const seen = new Set(tags.map((tag) => tag.id));
  const names = new Map(listOf(rawPartidas).map((partida) => [textOf(partida._id) || textOf(partida.id), textOf(partida.description)]));
  const partidas = [...new Set(scopes.flatMap((scope) => scope.workIds))].filter((id) => !seen.has(id));
  return [...tags, ...partidas.map((id) => {
    const name = names.get(id) || UNNAMED_WORK;
    return { id, name, color: colorForPartida(id, names.get(id) ?? ''), partida: true as const };
  })];
}

/** What the map draws out of Portal's service detail; null when the service has no streets. */
export function workMapOf(detail: unknown): WorkMap | null {
  if (!isFields(detail) || !isFields(detail.workStreets)) return null;
  const raw = detail.workStreets;
  const streets = streetsFrom(raw.streets);
  if (!streets.length) return null;
  const scopes = scopesFrom(raw.scopes, streets);
  const stages = [...listOf(raw.stages)].sort(byOrder).map((stage) => ({ id: textOf(stage._id), name: textOf(stage.name) }));
  return { streets, scopes, progress: progressFrom(raw.progress), works: worksFrom(raw.tags, detail.partidas, scopes), stages };
}

type WorkedStretch = { scope: WorkMapScope; workId: string; doneIntervals: Interval[]; totalM: number; doneM: number };

/** What was approved on a stretch for one work: every day joined, cut to it, rework left out. */
function approvedIn(progress: WorkMapProgress[], scope: WorkMapScope, workId: string): Interval[] {
  const mine = progress.filter((record) => record.streetId === scope.streetId && record.workId === workId && !record.rework);
  return mergeIntervals(mine.map((record): Interval => [Math.max(record.fromM, scope.fromM), Math.min(record.toM, scope.toM)]));
}

/** Approved metres of one work on one stretch, rework left out (o-03's bars). */
export const approvedMetersIn = (progress: WorkMapProgress[], scope: WorkMapScope, workId: string): number => metersOf(approvedIn(progress, scope, workId));

function workedStretches(map: WorkMap, scopes: WorkMapScope[], workId?: string): WorkedStretch[] {
  return scopes.flatMap((scope) => scope.workIds.filter((id) => !workId || id === workId).map((id) => {
    const doneIntervals = approvedIn(map.progress, scope, id);
    return { scope, workId: id, doneIntervals, totalM: Math.max(0, scope.toM - scope.fromM), doneM: metersOf(doneIntervals) };
  }));
}

const percentOf = (stretches: WorkedStretch[]) => {
  const total = stretches.reduce((sum, stretch) => sum + stretch.totalM, 0);
  return total > 0 ? Math.round((stretches.reduce((sum, stretch) => sum + stretch.doneM, 0) / total) * 100) : 0;
};

function statusOf(stretches: WorkedStretch[], works: WorkMapWork[]): { status: string; done: boolean } {
  const rows = works.flatMap((work) => {
    const mine = stretches.filter((stretch) => stretch.workId === work.id);
    const furthestM = Math.max(0, ...mine.flatMap((stretch) => stretch.doneIntervals.map(([, to]) => to)));
    return mine.length ? [{ name: work.name, percent: percentOf(mine), furthestM }] : [];
  });
  if (rows.length && rows.every((row) => row.percent >= COMPLETE_PCT)) return { status: FINISHED, done: true };
  const parts = rows.filter((row) => row.percent > 0).slice(-MAX_STATUS_PARTS);
  const status = parts.map((row) => (row.percent >= COMPLETE_PCT ? `${row.name} completa` : `${row.name} hasta ${kmLabel(row.furthestM)}`));
  return { status: status.join(' · ') || NO_PROGRESS, done: false };
}

function streetRow(street: WorkMapStreet, stretches: WorkedStretch[], works: WorkMapWork[]): WorkMapStreetRow {
  const length = Math.max(1, street.lengthM);
  const colorOf = (workId: string) => works.find((work) => work.id === workId)?.color ?? WORK_MAP_PLANNED_COLOR;
  const segments = stretches.flatMap((stretch) => stretch.doneIntervals.map(([from, to]) => ({ workId: stretch.workId, color: colorOf(stretch.workId), fromPct: (from / length) * 100, widthPct: ((to - from) / length) * 100 })));
  return { id: street.id, name: street.name, lengthM: street.lengthM, ...statusOf(stretches, works), segments };
}

const lngLat = (line: WorkMapPoint[]) => line.map((point): [number, number] => [point.lng, point.lat]);

function plannedLines(map: WorkMap, scopes: WorkMapScope[], narrowed: boolean): WorkMapLine[] {
  const lineOf = (streetId: string) => map.streets.find((street) => street.id === streetId)?.line ?? [];
  const stretches = scopes.map((scope) => ({ streetId: scope.streetId, color: WORK_MAP_PLANNED_COLOR, coordinates: lngLat(sliceLine(lineOf(scope.streetId), scope.fromM, scope.toM)) }));
  const bare = narrowed ? [] : map.streets.filter((street) => !scopes.some((scope) => scope.streetId === street.id));
  return [...stretches, ...bare.map((street) => ({ streetId: street.id, color: WORK_MAP_PLANNED_COLOR, coordinates: lngLat(street.line) }))].filter((line) => line.coordinates.length >= 2);
}

function doneLines(map: WorkMap, stretches: WorkedStretch[]): WorkMapLine[] {
  return stretches.flatMap((stretch) => {
    const line = map.streets.find((street) => street.id === stretch.scope.streetId)?.line ?? [];
    const color = map.works.find((work) => work.id === stretch.workId)?.color ?? WORK_MAP_PLANNED_COLOR;
    return stretch.doneIntervals.map(([from, to]) => ({ streetId: stretch.scope.streetId, workId: stretch.workId, color, coordinates: lngLat(sliceLine(line, from, to)), fromM: from, toM: to }));
  }).filter((line) => line.coordinates.length >= 2);
}

function boundsOf(streets: WorkMapStreet[]): WorkMapView['bounds'] {
  const points = streets.flatMap((street) => street.line);
  if (!points.length) return null;
  const [lngs, lats] = [points.map((point) => point.lng), points.map((point) => point.lat)];
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

/** Days are written `YYYY-MM-DD`, so they compare as text and no time zone moves them. */
const cutAt = (map: WorkMap, untilDay?: string): WorkMap =>
  (untilDay ? { ...map, progress: map.progress.filter((record) => record.date <= untilDay) } : map);

/** Figures, street rows and lines of the map; the chips keep every work of the stage in sight. */
export function workMapView(map: WorkMap, filter: WorkMapFilter = {}): WorkMapView {
  const stageScopes = map.scopes.filter((scope) => !filter.stageId || scope.stageId === filter.stageId);
  const scopes = stageScopes.filter((scope) => !filter.workId || scope.workIds.includes(filter.workId));
  const narrowed = Boolean(filter.stageId || filter.workId);
  const counted = cutAt(map, filter.untilDay);
  const stretches = workedStretches(counted, scopes, filter.workId);
  const stageStretches = workedStretches(counted, stageScopes);
  const streets = map.streets.filter((street) => !narrowed || scopes.some((scope) => scope.streetId === street.id));
  const totalM = stretches.reduce((sum, stretch) => sum + stretch.totalM, 0);
  const doneM = stretches.reduce((sum, stretch) => sum + stretch.doneM, 0);
  return {
    percent: totalM > 0 ? oneDecimal((doneM / totalM) * 100) : 0,
    doneM: round2(doneM),
    totalM: round2(totalM),
    works: map.works.flatMap((work) => {
      const mine = stageStretches.filter((stretch) => stretch.workId === work.id);
      return mine.length ? [{ ...work, percent: percentOf(mine) }] : [];
    }),
    streets: streets.map((street) => streetRow(street, stretches.filter((stretch) => stretch.scope.streetId === street.id), map.works)),
    planned: plannedLines(map, scopes, narrowed),
    done: doneLines(map, stretches),
    bounds: boundsOf(streets.length ? streets : map.streets),
  };
}

/** The lines as MapLibre reads them, on the web and in the app. */
export const workMapCollection = (lines: WorkMapLine[]) => ({
  type: 'FeatureCollection' as const,
  features: lines.map((line) => ({ type: 'Feature' as const, properties: { color: line.color }, geometry: { type: 'LineString' as const, coordinates: line.coordinates } })),
});

/** A stage may not have the chosen work: the filter drops it instead of showing an empty map. */
type FilterChange = { stageId?: string | undefined; workId?: string | undefined; untilDay?: string | undefined };

const tidyFilter = ({ stageId, workId, untilDay }: FilterChange): WorkMapFilter => ({
  ...(stageId ? { stageId } : {}),
  ...(workId ? { workId } : {}),
  ...(untilDay ? { untilDay } : {}),
});

export function workMapStageFilter(map: WorkMap, filter: WorkMapFilter, stageId: string): WorkMapFilter {
  const stageWorks = map.scopes.filter((scope) => !stageId || scope.stageId === stageId).flatMap((scope) => scope.workIds);
  const workId = filter.workId && stageWorks.includes(filter.workId) ? filter.workId : undefined;
  return tidyFilter({ ...filter, stageId, workId });
}

export const workMapWorkFilter = (filter: WorkMapFilter, workId?: string) => tidyFilter({ ...filter, workId });
export const workMapDayFilter = (filter: WorkMapFilter, untilDay: string) => tidyFilter({ ...filter, untilDay });

/** The days with progress, the latest first: any other day would show the same map. */
export const workMapCutDays = (map: WorkMap): string[] =>
  [...new Set(map.progress.map((record) => record.date).filter(Boolean))].sort().reverse();

export const workMapCutLabel = (day: string) => `Hasta el ${dayMonthOf(new Date(`${day}T00:00:00Z`))}`;

/** The link of the service, then the map behind it. With the link alone Portal's page stays open. */
/**
 * A quiet reload after an edit (step 3, web E2E 07/11): the map on screen stays while Portal answers,
 * so an open street does not close; if the reload fails, what was there stays too.
 */
export const afterQuietReload = (previous: WorkMapState, next: WorkMapState): WorkMapState =>
  (previous.kind === 'ready' && next.kind === 'failed' ? previous : next);

export async function loadWorkMap(
  link: () => Promise<ServiceMapResult>,
  read: (url: string) => Promise<{ ok: true; data: { map?: WorkMap | null } } | { ok: false; message?: string }>,
): Promise<WorkMapState> {
  const made = await link();
  if (!made.ok) return { kind: 'failed', message: made.message };
  const reply = await read(made.url);
  if (!reply.ok) return { kind: 'failed', message: reply.message ?? WORK_MAP_FAILED, url: made.url };
  return { kind: 'ready', url: made.url, map: reply.data.map ?? null };
}

/**
 * After an edit: read again with the link the map already has. Every new link is a public
 * link of a day in Portal (agentes 09/11 saw 16 in 10 minutes); a new one only when the old fails.
 */
export async function reloadWorkMap(
  previous: WorkMapState,
  link: () => Promise<ServiceMapResult>,
  read: (url: string) => Promise<{ ok: true; data: { map?: WorkMap | null } } | { ok: false; message?: string }>,
): Promise<WorkMapState> {
  if (previous.kind !== 'ready') return loadWorkMap(link, read);
  const reply = await read(previous.url);
  return reply.ok ? { kind: 'ready', url: previous.url, map: reply.data.map ?? null } : loadWorkMap(link, read);
}
