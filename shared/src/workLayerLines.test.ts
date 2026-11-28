import { describe, expect, it } from 'vitest';
import { workMapView, type WorkMap } from './workMap.js';
import { definedStreetIdsOf, LAYER_BASE_COLOR, LAYER_BASE_PAINT, LAYER_LEGEND, LAYER_PLANNED_PAINT, layerMapLinesOf, STATION_MIN_ZOOM, STREET_DEFINED_COLOR } from './workLayerLines.js';
import { streetWidthExpression } from './workLineWidth.js';
import { isShortSheet, collapseSheet, initialMapSheet, expandLayerSheet, sheetForLayerPick, toggleLayersSheet } from './workMapSheet.js';
import { colorLuminance, lineHaloOf, LINE_HALO_COLOR, workMapCollection } from './workMap.js';

/** Design ma01 (José 28/11): the map by layer, no grey dashes outside «Editar croquis». */
const LINE = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [{ id: 'a', name: 'Jr. Progreso', line: LINE, lengthM: 109 }, { id: 'b', name: 'Jr. Monje', line: LINE, lengthM: 109 }, { id: 'c', name: 'Pje. Sin trabajo', line: LINE, lengthM: 109 }],
  scopes: [{ id: 's1', streetId: 'a', fromM: 0, toM: 109, workIds: ['imp', 'asf'] }, { id: 's2', streetId: 'b', fromM: 0, toM: 109, workIds: ['asf'] }],
  progress: [{ streetId: 'a', workId: 'imp', fromM: 0, toM: 40, date: '2026-11-20', rework: false }, { streetId: 'b', workId: 'asf', fromM: 0, toM: 50, date: '2026-11-20', rework: false }],
  works: [{ id: 'imp', name: 'Imprimación', color: '#d97706' }, { id: 'asf', name: 'Asfaltado', color: '#2563eb' }],
  stages: [],
};
const view = workMapView(MAP);
const rows = [{ streetId: 'a', percentText: '37 %' }];

describe('the map by layer', () => {
  it('every street of the work is a thin neutral base, the layer still to build orange, done in ITS color with its %', () => {
    // Act
    const lines = layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: false });
    // Assert
    expect(lines.base.map((line) => [line.streetId, line.color])).toEqual([['a', LAYER_BASE_COLOR], ['b', LAYER_BASE_COLOR], ['c', STREET_DEFINED_COLOR]]);
    expect(lines.planned.map((line) => [line.streetId, line.color])).toEqual([['a', STREET_DEFINED_COLOR]]);
    expect(lines.done.map((line) => [line.streetId, line.workId, line.color])).toEqual([['a', 'imp', '#d97706']]);
    expect(lines.labels).toEqual([expect.objectContaining({ streetId: 'a', label: '37 %' })]);
  });

  it('a street without the layer is never drawn dashed and other layers stay off', () => {
    const lines = layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: false });
    expect(lines.planned.some((line) => line.streetId === 'b' || line.streetId === 'c')).toBe(false);
    expect(lines.done.some((line) => line.workId === 'asf')).toBe(false);
  });

  it('a layer switched off draws only the base', () => {
    expect(layerMapLinesOf({ map: MAP, view, filter: {}, workId: 'imp', rows, hidden: true })).toMatchObject({ planned: [], done: [], labels: [] });
  });

  it('without a layer every defined stretch is orange under what is done; a bare street stays in the base', () => {
    // Act
    const bare = layerMapLinesOf({ map: MAP, view, filter: {}, workId: null, rows: [], hidden: false });
    // Assert
    expect(bare.planned.map((line) => [line.streetId, line.color])).toEqual([['a', STREET_DEFINED_COLOR], ['b', STREET_DEFINED_COLOR]]);
    expect(bare.done).toBe(view.done);
  });

  it('a section of a street is orange only along its metres (José 28/11: sections of a street)', () => {
    // Arrange
    const section: WorkMap = { ...MAP, scopes: [{ id: 's1', streetId: 'a', fromM: 0, toM: 50, workIds: ['imp'] }] };
    // Act
    const lines = layerMapLinesOf({ map: section, view: workMapView(section), filter: {}, workId: 'imp', rows: [], hidden: false });
    // Assert
    expect(lines.planned).toHaveLength(1);
    expect(lines.planned[0]?.color).toBe(STREET_DEFINED_COLOR);
    expect(lines.planned[0]?.coordinates.at(-1)?.[0]).toBeLessThan(-76.999);
  });

  it('what is still to build is opaque and as wide as the street, in light and dark', () => {
    expect(LAYER_PLANNED_PAINT['line-opacity']).toBe(1);
    expect(LAYER_PLANNED_PAINT['line-width']).toEqual(streetWidthExpression(4));
    expect(LAYER_LEGEND).toEqual({ done: 'Hecho', planned: 'Pendiente de ejecución', plannedColor: '#FF6A00' });
  });

  it('a defined street with no work painted is bright orange, opaque and as wide as the street', () => {
    // Arrange
    const unworked: WorkMap = { ...MAP, scopes: [...MAP.scopes, { id: 's3', streetId: 'c', fromM: 0, toM: 50, workIds: [] }] };
    // Act
    const defined = definedStreetIdsOf(unworked);
    const lines = layerMapLinesOf({ map: unworked, view: workMapView(unworked), filter: {}, workId: null, rows: [], hidden: false });
    // Assert
    expect([...defined]).toEqual(['c']);
    expect(lines.base.find((line) => line.streetId === 'c')?.color).toBe(STREET_DEFINED_COLOR);
    expect(STREET_DEFINED_COLOR).toBe('#FF6A00');
    expect(LAYER_BASE_PAINT['line-width']).toEqual(streetWidthExpression(2));
    expect(LAYER_BASE_PAINT['line-opacity']).toEqual(['case', ['==', ['get', 'color'], STREET_DEFINED_COLOR], 1, 0.35]);
  });

  it('without streets nothing is defined', () => {
    expect(definedStreetIdsOf({ streets: [], scopes: [] }).size).toBe(0);
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

  it('only a short sheet lifts the map controls', () => {
    expect(isShortSheet('peek')).toBe(true);
    expect(isShortSheet('min')).toBe(true);
    expect(isShortSheet('layers')).toBe(false);
    expect(isShortSheet('full')).toBe(false);
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
