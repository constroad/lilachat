/**
 * «Capas y leyenda» of a service's map (José 19/11, design cc-04): each work (partida) in its
 * color with a switch, the drawings by type, the observations by state. Everything starts on;
 * what is turned off leaves the map, never the data. PURE: web and APK.
 */
import type { WorkMap, WorkMapFilter, WorkMapView } from './workMap.js';
import { layerPercentOf } from './workLayerPercent.js';
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
  works: Array<{ id: string; name: string; color: string; percent: number; assigned: boolean }>;
  marks: Array<{ type: string; label: string; color: string; count: number }>;
  observations: Array<{ key: WorkMapObservationStatus; label: string; count: number }>;
};

/** The rows of the panel: what the map has, never an empty switch. */
/** Every work of the job, also those no street carries yet; the percent is `layerPercentOf` under the board's filter (José 28/11: one % per layer). */
export function layerRowsOf(view: Pick<WorkMapView, 'works'>, marks: readonly WorkMapMark[], observations: readonly WorkMapObservation[], map: Pick<WorkMap, 'streets' | 'scopes' | 'progress' | 'works'>, filter: WorkMapFilter = {}): LayerRows {
  const counts = (['open', 'resolved'] as const).map((key) => ({ key, label: OBSERVATION_LABELS[key], count: observations.filter((one) => one.status === key).length }));
  return {
    works: map.works.map((work) => {
      const assigned = view.works.some((one) => one.id === work.id);
      return { id: work.id, name: work.name, color: work.color, percent: assigned ? layerPercentOf(map, work.id, filter) : 0, assigned };
    }),
    marks: markGroupsOf(marks).map((group) => ({ type: group.type, label: group.label, color: markColor(group.type), count: group.count })),
    observations: counts.filter((one) => one.count > 0),
  };
}

/** Without works the layers sheet showed only streets (José 27/11: «¿no deberían ser los trabajos?»). */
export const NO_WORKS_YET = 'Aún no hay trabajos (imprimación, base, carpeta…). Créalos en ⋮ › Trabajos y asígnalos a las calles: aquí verás el avance de cada uno.';
/** A work no street carries yet: it lists, but has no progress to tell. */
export const WORK_NOT_ASSIGNED = 'Sin calles asignadas';
