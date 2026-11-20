/**
 * «Capas y leyenda» of a service's map (José 19/11, design cc-04): each work (partida) in its
 * color with a switch, the drawings by type, the observations by state. Everything starts on;
 * what is turned off leaves the map, never the data. PURE: web and APK.
 */
import type { WorkMapView } from './workMap.js';
import { markColor, type WorkMapMark } from './workMapMarks.js';
import { markGroupsOf } from './workMapCards.js';
import type { WorkMapObservation, WorkMapObservationStatus } from './workMapObservations.js';

export type MapLayerGroup = 'works' | 'marks' | 'observations';
export type MapLayers = Readonly<Record<MapLayerGroup, readonly string[]>>;
export const NO_HIDDEN_LAYERS: MapLayers = { works: [], marks: [], observations: [] };

export const isLayerOn = (layers: MapLayers, group: MapLayerGroup, key: string): boolean => !layers[group].includes(key);

export function toggleLayer(layers: MapLayers, group: MapLayerGroup, key: string): MapLayers {
  const hidden = layers[group];
  return { ...layers, [group]: hidden.includes(key) ? hidden.filter((one) => one !== key) : [...hidden, key] };
}

/** The view without the done lines of a hidden work; the panel's figures stay those of the filter. */
export function viewWithLayers(view: WorkMapView, layers: MapLayers): WorkMapView {
  if (!layers.works.length) return view;
  return { ...view, done: view.done.filter((line) => !line.workId || !layers.works.includes(line.workId)) };
}

export const visibleMarks = (marks: readonly WorkMapMark[], layers: MapLayers): readonly WorkMapMark[] =>
  layers.marks.length ? marks.filter((mark) => !layers.marks.includes(mark.type)) : marks;

export const visibleObservations = (observations: readonly WorkMapObservation[], layers: MapLayers): readonly WorkMapObservation[] =>
  layers.observations.length ? observations.filter((one) => !layers.observations.includes(one.status)) : observations;

const OBSERVATION_LABELS: Record<WorkMapObservationStatus, string> = { open: 'Pendientes', resolved: 'Levantadas' };

export type LayerRows = {
  works: Array<{ id: string; name: string; color: string; percent: number }>;
  marks: Array<{ type: string; label: string; color: string; count: number }>;
  observations: Array<{ key: WorkMapObservationStatus; label: string; count: number }>;
};

/** The rows of the panel: what the map has, never an empty switch. */
export function layerRowsOf(view: Pick<WorkMapView, 'works'>, marks: readonly WorkMapMark[], observations: readonly WorkMapObservation[]): LayerRows {
  const counts = (['open', 'resolved'] as const).map((key) => ({ key, label: OBSERVATION_LABELS[key], count: observations.filter((one) => one.status === key).length }));
  return {
    works: view.works.map((work) => ({ id: work.id, name: work.name, color: work.color, percent: work.percent })),
    marks: markGroupsOf(marks).map((group) => ({ type: group.type, label: group.label, color: markColor(group.type), count: group.count })),
    observations: counts.filter((one) => one.count > 0),
  };
}
