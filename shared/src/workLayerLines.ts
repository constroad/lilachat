import { sliceLine, widthOf, workMapView, type WorkMap, type WorkMapFilter, type WorkMapLine, type WorkMapStreet, type WorkMapView } from './workMap.js';
import type { StationMark } from './workMapStations.js';
import type { LayerStreetSummary } from './workLayerSummary.js';
import { streetWidthExpression } from './workLineWidth.js';

/**
 * The map drawn by layer (design ma01, José 28/11: «¿por qué sigue mostrándose líneas punteadas?»).
 * Every street of the work is a faint solid neutral band; every stretch defined and not built yet
 * is the bright orange, opaque (José 28/11: grey was lost on the dark map), with the street's %
 * beside it, and what is done is the work's color on top. Every line is as wide as the street
 * (José 28/11: no dashes, «el ancho de la calle»). PURE: the web and the APK paint what this returns.
 */
export type LayerMapLines = { base: WorkMapLine[]; planned: WorkMapLine[]; done: WorkMapLine[]; labels: StationMark[] };

/** MapLibre paints hex, not tokens: a slate that reads on the light and the dark basemap. */
export const LAYER_BASE_COLOR = '#64748b';
/** Defined and not built yet, a whole street or a section (José 28/11): a bright orange that reads on the light and the dark basemap. */
export const STREET_DEFINED_COLOR = '#FF6A00';
const BASE_OPACITY = 0.35;
/** The neutral base is faint; a defined street with no work is opaque, both as wide as the street. */
export const LAYER_BASE_PAINT = { 'line-color': ['get', 'color'], 'line-width': streetWidthExpression(2), 'line-opacity': ['case', ['==', ['get', 'color'], STREET_DEFINED_COLOR], 1, BASE_OPACITY] };
/** What is still to build: the orange, opaque, under what is done. */
export const LAYER_PLANNED_PAINT = { 'line-color': ['get', 'color'], 'line-width': streetWidthExpression(4), 'line-opacity': 1 };
/** The stretch being recorded or painted (Registrar avance, the brush): solid and as wide as the street. */
export const WORK_MAP_STRETCH_PAINT = { 'line-color': ['get', 'color'], 'line-width': streetWidthExpression(6), 'line-opacity': 0.6 };
/** What is done: the layer's color, opaque, over the planned band. */
export const LAYER_DONE_PAINT = { 'line-color': ['get', 'color'], 'line-width': streetWidthExpression(5) };
export const LAYER_LABEL_LAYOUT = { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, -1.3], 'text-anchor': 'bottom', 'text-allow-overlap': false };
export const LAYER_LABEL_PAINT = { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2 };
/** «0+000» marks only from this zoom on: zoomed out they covered every street (José 28/11). */
export const STATION_MIN_ZOOM = 17;

const HALF = 2;
const MIN_POINTS = 2;
const lngLat = (street: WorkMapStreet): Array<[number, number]> => street.line.map((point) => [point.lng, point.lat]);

/** The streets with no stretch carrying a work: drawn, but nothing painted on them yet. */
export function definedStreetIdsOf(map: Pick<WorkMap, 'streets' | 'scopes'>): Set<string> {
  const worked = new Set(map.scopes.filter((scope) => scope.workIds.length > 0).map((scope) => scope.streetId));
  return new Set(map.streets.filter((street) => !worked.has(street.id)).map((street) => street.id));
}

/** The streets the view shows, whole: neutral and faint under a work, orange when none is painted. */
export function baseLinesOf(map: Pick<WorkMap, 'streets' | 'scopes'>, view: Pick<WorkMapView, 'streets'>): WorkMapLine[] {
  const shown = new Set(view.streets.map((row) => row.id));
  const defined = definedStreetIdsOf(map);
  return map.streets.filter((street) => shown.has(street.id) && street.line.length >= MIN_POINTS).map((street) => ({ streetId: street.id, color: defined.has(street.id) ? STREET_DEFINED_COLOR : LAYER_BASE_COLOR, coordinates: lngLat(street), ...widthOf(street.widthM) }));
}

/** The street's % at the middle of its line, as the design writes «42 %» beside the stretch. */
export function layerLabelsOf(map: Pick<WorkMap, 'streets'>, rows: readonly Pick<LayerStreetSummary, 'streetId' | 'percentText'>[]): StationMark[] {
  return rows.flatMap((row) => {
    const street = map.streets.find((one) => one.id === row.streetId);
    const middle = street && street.line.length >= MIN_POINTS ? sliceLine(street.line, 0, street.lengthM / HALF).at(-1) : undefined;
    return middle ? [{ streetId: row.streetId, label: row.percentText, lat: middle.lat, lng: middle.lng }] : [];
  });
}

type LayerLinesInput = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; workId: string | null; rows: readonly Pick<LayerStreetSummary, 'streetId' | 'percentText'>[]; /** The layer's switch in «Ver» is off. */ hidden: boolean };

const pendingOf = (lines: readonly WorkMapLine[], workId?: string): WorkMapLine[] => lines.map((line) => ({ ...line, color: STREET_DEFINED_COLOR, ...(workId ? { workId } : {}) }));

/** Without a layer: every defined stretch orange (a street with no scope is already orange in the base) and what is done. */
function allWorksLinesOf(input: LayerLinesInput, base: WorkMapLine[]): LayerMapLines {
  const scoped = new Set(input.map.scopes.map((scope) => scope.streetId));
  return { base, planned: pendingOf(input.view.planned.filter((line) => scoped.has(line.streetId))), done: input.view.done, labels: [] };
}

/** What the board draws: the layer's stretches still to build orange, its done stretches over them. */
export function layerMapLinesOf(input: LayerLinesInput): LayerMapLines {
  const base = baseLinesOf(input.map, input.view);
  if (!input.workId) return allWorksLinesOf(input, base);
  if (input.hidden) return { base, planned: [], done: [], labels: [] };
  const layer = workMapView(input.map, { ...input.filter, workId: input.workId });
  return { base, planned: pendingOf(layer.planned, input.workId), done: layer.done, labels: layerLabelsOf(input.map, input.rows) };
}

/** The layer sheet's legend (design ma01): done in the work's colour, the rest in the map's orange. */
export const LAYER_LEGEND = { done: 'Hecho', planned: 'Pendiente de ejecución', plannedColor: STREET_DEFINED_COLOR } as const;

/** The peek's link to the street rows: «Ver 4 calles» or, open, «Ocultar calles». */
export const layerStreetsToggle = (count: number, expanded: boolean): string => (expanded ? 'Ocultar calles' : `Ver ${count === 1 ? '1 calle' : `${count} calles`}`);
