import { describe, expect, it } from 'vitest';
import { isLayerOn, layerRowsOf, NO_HIDDEN_LAYERS, toggleLayer, viewWithLayers, visibleMarks, visibleObservations } from './workMapLayers.js';
import type { WorkMap, WorkMapView } from './workMap.js';
import type { WorkMapMark } from './workMapMarks.js';
import type { WorkMapObservation } from './workMapObservations.js';

const view = {
  percent: 0, doneM: 0, totalM: 100, streets: [], bounds: null, planned: [],
  works: [{ id: 'w1', name: 'Corte y demolición', color: '#f97316', percent: 10 }, { id: 'w2', name: 'Imprimación', color: '#3b82f6', percent: 0 }],
  done: [{ streetId: 's1', workId: 'w1', color: '#f97316', coordinates: [[0, 0], [1, 1]] }, { streetId: 's1', workId: 'w2', color: '#3b82f6', coordinates: [[0, 0], [1, 1]] }],
} as unknown as WorkMapView;
/** The job behind the view: the first work went 10 m of 100 (the one % of a layer, `layerPercentOf`). */
const LAYER_MAP: WorkMap = {
  streets: [{ id: 's1', name: 'Jr. Lima', line: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }], lengthM: 100 }],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 100, workIds: ['w1', 'w2'] }],
  progress: [{ streetId: 's1', workId: 'w1', fromM: 0, toM: 10, date: '2026-11-20', rework: false }],
  works: view.works.map(({ id, name, color }) => ({ id, name, color })),
  stages: [],
};
const point = { kind: 'point', point: { lat: -12, lng: -77 } } as unknown as WorkMapMark['shape'];
const marks: WorkMapMark[] = [{ id: 'm1', type: 'otro', shape: point }, { id: 'm2', type: 'otro', shape: point }, { id: 'm3', type: 'giba', shape: point }];
const observation = (id: string, status: WorkMapObservation['status']): WorkMapObservation => ({ id, text: 'Bache', status, photos: [] });
const observations = [observation('o1', 'open'), observation('o2', 'open'), observation('o3', 'resolved')];

describe('toggleLayer', () => {
  it('everything is on at first, and a toggle turns one off and on again', () => {
    expect(isLayerOn(NO_HIDDEN_LAYERS, 'works', 'w1')).toBe(true);
    const off = toggleLayer(NO_HIDDEN_LAYERS, 'works', 'w1');
    expect(isLayerOn(off, 'works', 'w1')).toBe(false);
    expect(isLayerOn(off, 'works', 'w2')).toBe(true);
    expect(isLayerOn(toggleLayer(off, 'works', 'w1'), 'works', 'w1')).toBe(true);
  });
  it('does not change the layers it was given', () => {
    toggleLayer(NO_HIDDEN_LAYERS, 'marks', 'giba');
    expect(NO_HIDDEN_LAYERS.marks).toEqual([]);
  });
});

describe('viewWithLayers', () => {
  it('leaves out the done lines of a hidden work, keeps the rest', () => {
    const shown = viewWithLayers(view, toggleLayer(NO_HIDDEN_LAYERS, 'works', 'w1'));
    expect(shown.done.map((line) => line.workId)).toEqual(['w2']);
    expect(shown.works).toHaveLength(2);
  });
  it('is the same view with nothing hidden', () => {
    expect(viewWithLayers(view, NO_HIDDEN_LAYERS)).toBe(view);
  });
});

describe('visible marks and observations', () => {
  it('hides a whole type of drawing', () => {
    expect(visibleMarks(marks, toggleLayer(NO_HIDDEN_LAYERS, 'marks', 'otro')).map((mark) => mark.id)).toEqual(['m3']);
  });
  it('hides the open or the lifted observations', () => {
    expect(visibleObservations(observations, toggleLayer(NO_HIDDEN_LAYERS, 'observations', 'resolved')).map((one) => one.id)).toEqual(['o1', 'o2']);
    expect(visibleObservations(observations, NO_HIDDEN_LAYERS)).toBe(observations);
  });
});

describe('layerRowsOf', () => {
  it('lists the works with color and progress, the drawings by type and the observations by state', () => {
    const rows = layerRowsOf(view, marks, observations, LAYER_MAP);
    expect(rows.works.map((work) => `${work.name} ${work.percent}`)).toEqual(['Corte y demolición 10', 'Imprimación 0']);
    expect(rows.marks.map((group) => `${group.label} ${group.count}`)).toEqual(['Otro 2', 'Giba 1']);
    expect(rows.marks[0]?.color).toMatch(/^#/);
    expect(rows.observations).toEqual([{ key: 'open', label: 'Pendientes', count: 2 }, { key: 'resolved', label: 'Levantadas', count: 1 }]);
  });
  it('lists a work no street carries yet, at 0 % and unassigned (José 27/11: «creé 2 trabajos y no se ven»)', () => {
    const map = { ...LAYER_MAP, works: [...LAYER_MAP.works, { id: 'w3', name: 'Carpeta asfáltica', color: '#16a34a' }] };
    const rows = layerRowsOf(view, [], [], map);
    expect(rows.works.map((work) => `${work.name} ${work.percent} ${work.assigned}`)).toEqual(['Corte y demolición 10 true', 'Imprimación 0 true', 'Carpeta asfáltica 0 false']);
  });
  it('drops an empty group of observations', () => {
    expect(layerRowsOf(view, [], [], LAYER_MAP).observations).toEqual([]);
  });
});
