import { describe, expect, it } from 'vitest';
import { workMapView, type WorkMap } from './workMap.js';
import { LAYER_BASE_COLOR, layerMapLinesOf, STATION_MIN_ZOOM } from './workLayerLines.js';
import { collapseSheet, initialMapSheet, expandLayerSheet, sheetForLayerPick, toggleLayersSheet } from './workMapSheet.js';
import { colorLuminance, lineHaloOf, LINE_HALO_COLOR, workMapCollection } from './workMap.js';

/** Design ma01 (José 28/11): the map by layer, no grey dashes outside «Editar croquis». */
const LINE = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [{ id: 'a', name: 'Jr. Progreso', line: LINE, lengthM: 109 }, { id: 'b', name: 'Jr. Monje', line: LINE, lengthM: 109 }, { id: 'c', name: 'Pje. Sin capa', line: LINE, lengthM: 109 }],
  scopes: [{ id: 's1', streetId: 'a', fromM: 0, toM: 109, workIds: ['imp', 'asf'] }, { id: 's2', streetId: 'b', fromM: 0, toM: 109, workIds: ['asf'] }],
  progress: [{ streetId: 'a', workId: 'imp', fromM: 0, toM: 40, date: '2026-11-20', rework: false }, { streetId: 'b', workId: 'asf', fromM: 0, toM: 50, date: '2026-11-20', rework: false }],
  works: [{ id: 'imp', name: 'Imprimación', color: '#d97706' }, { id: 'asf', name: 'Asfaltado', color: '#2563eb' }],
  stages: [],
};
const view = workMapView(MAP);
const rows = [{ streetId: 'a', percentText: '37 %' }];

describe('the map by layer', () => {
  it('every street of the work is a thin neutral base, the layer planned in ITS color with its %', () => {
    // Act
    const lines = layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: false });
    // Assert
    expect(lines.base.map((line) => [line.streetId, line.color])).toEqual([['a', LAYER_BASE_COLOR], ['b', LAYER_BASE_COLOR], ['c', LAYER_BASE_COLOR]]);
    expect(lines.planned.map((line) => [line.streetId, line.color])).toEqual([['a', '#d97706']]);
    expect(lines.done.map((line) => [line.streetId, line.workId, line.color])).toEqual([['a', 'imp', '#d97706']]);
    expect(lines.labels).toEqual([expect.objectContaining({ streetId: 'a', label: '37 %' })]);
  });

  it('a street without the layer is never drawn dashed and other layers stay off', () => {
    const lines = layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: false });
    expect(lines.planned.some((line) => line.streetId === 'b' || line.streetId === 'c')).toBe(false);
    expect(lines.done.some((line) => line.workId === 'asf')).toBe(false);
  });

  it('a layer switched off draws only the base; without works the done lines stay and nothing is dashed', () => {
    expect(layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: true })).toMatchObject({ planned: [], done: [], labels: [] });
    const bare = layerMapLinesOf({ map: MAP, view, filter: {}, workId: null, rows: [], hidden: false });
    expect(bare.planned).toEqual([]);
    expect(bare.done).toBe(view.done);
  });

  it('the stations wait for a close zoom', () => {
    expect(STATION_MIN_ZOOM).toBeGreaterThanOrEqual(16);
  });
});

describe('the sheet over the phone map', () => {
  it('opens as the layer peek with layers, closed without them; «Capas» only from its button', () => {
    expect(initialMapSheet(2)).toBe('peek');
    expect(initialMapSheet(0)).toBeNull();
    expect(toggleLayersSheet('peek', true)).toBe('layers');
    expect(toggleLayersSheet('layers', true)).toBe('min');
    expect(toggleLayersSheet('layers', false)).toBeNull();
  });

  it('a chip shows its layer and the handle grows the detail and back', () => {
    expect(sheetForLayerPick(null)).toBe('peek');
    expect(sheetForLayerPick('layers')).toBe('peek');
    expect(sheetForLayerPick('full')).toBe('full');
    expect(expandLayerSheet('peek')).toBe('full');
    expect(expandLayerSheet('full')).toBe('peek');
    expect(expandLayerSheet('min')).toBe('peek');
  });

  it('the X folds the detail to the peek and the peek to its action alone (José 28/11)', () => {
    expect(collapseSheet('full', true)).toBe('peek');
    expect(collapseSheet('peek', true)).toBe('min');
    expect(collapseSheet('min', true)).toBe('min');
    expect(collapseSheet('layers', false)).toBeNull();
  });
});

describe('a near-black layer on the dark map (José 28/11)', () => {
  it('gets a light rim; any other color keeps none', () => {
    expect(colorLuminance('#111827')).toBeLessThan(0.12);
    expect(lineHaloOf('#111827')).toBe(LINE_HALO_COLOR);
    expect(lineHaloOf('#2563eb')).not.toBe(LINE_HALO_COLOR);
    expect(lineHaloOf('rojo')).not.toBe(LINE_HALO_COLOR);
    expect(workMapCollection([{ streetId: 'a', color: '#000000', coordinates: [[0, 0], [1, 1]] }]).features[0]!.properties.halo).toBe(LINE_HALO_COLOR);
  });
});
