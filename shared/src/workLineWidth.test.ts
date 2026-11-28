import { describe, expect, it } from 'vitest';
import { DEFAULT_STREET_WIDTH_M, firstSymbolLayerId, groundWidthPx, metersPerPixel, streetWidthExpression, workLineWidthPx } from './workLineWidth.js';
import { basemapStreetWidthPx, WORK_MAP_STYLE } from './workMapStyle.js';

describe('metersPerPixel', () => {
  it('halves with each zoom step and shrinks away from the equator', () => {
    // Arrange / Act
    const atSixteen = metersPerPixel(16, 0);
    // Assert
    expect(atSixteen).toBeCloseTo(1.194, 3);
    expect(metersPerPixel(17, 0)).toBeCloseTo(atSixteen / 2, 6);
    expect(metersPerPixel(16, -12)).toBeLessThan(atSixteen);
  });
});

describe('groundWidthPx', () => {
  it('covers the street width in meters when zoomed in', () => {
    expect(groundWidthPx(8, 18, -12, 3)).toBeCloseTo(8 / metersPerPixel(18, -12), 6);
  });

  it('never goes under the minimum when zoomed out', () => {
    expect(groundWidthPx(8, 10, -12, 3)).toBe(3);
    expect(groundWidthPx(0, 18, -12, 2)).toBe(2);
  });
});

describe('metersPerPixel tile size', () => {
  it('uses MapLibre 512 px tiles: 0.597 m per pixel at zoom 18 on the equator', () => {
    expect(metersPerPixel(18, 0)).toBeCloseTo(40_075_016.686 / (512 * 2 ** 18), 6);
  });
});

describe('basemapStreetWidthPx', () => {
  it('follows the base map street fill: 9 px times its stops, exponential 1.6 between them', () => {
    expect(basemapStreetWidthPx(15)).toBeCloseTo(9 * 0.55, 6);
    expect(basemapStreetWidthPx(18)).toBeCloseTo(9 * 2.4, 6);
    expect(basemapStreetWidthPx(17.5)).toBeCloseTo(16.98, 1);
    expect(basemapStreetWidthPx(10)).toBeCloseTo(9 * 0.15, 6);
    expect(basemapStreetWidthPx(20)).toBeCloseTo(9 * 2.4, 6);
  });
});

describe('workLineWidthPx', () => {
  it('covers the drawn street where the base map draws it wider than 6 m (emulator QA: 13 px over 18 px)', () => {
    // Arrange: a common 6 m street at zoom 17.5 in Lima
    const ground = groundWidthPx(DEFAULT_STREET_WIDTH_M, 17.5, -12, 5);
    // Act
    const line = workLineWidthPx(DEFAULT_STREET_WIDTH_M, 17.5, -12, 5);
    // Assert
    expect(ground).toBeLessThan(basemapStreetWidthPx(17.5));
    expect(line).toBeCloseTo(basemapStreetWidthPx(17.5), 6);
  });

  it('keeps the real width once it is wider than the drawn street', () => {
    expect(workLineWidthPx(6, 20, -12, 5)).toBeCloseTo(groundWidthPx(6, 20, -12, 5), 6);
    expect(workLineWidthPx(6, 20, -12, 5)).toBeGreaterThan(basemapStreetWidthPx(20));
  });
});

describe('streetWidthExpression', () => {
  it('never paints a stop under the drawn street', () => {
    const stops = streetWidthExpression(2, -12).slice(3);
    const atSeventeen = stops[stops.indexOf(17) + 1] as unknown[];
    expect(atSeventeen[1]).toBeCloseTo(basemapStreetWidthPx(17), 6);
  });

  it('interpolates base 2 over the zoom with one clamped stop per zoom from 12 to 22', () => {
    // Arrange / Act
    const expression = streetWidthExpression(4, 0);
    // Assert
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['exponential', 2], ['zoom']]);
    const stops = expression.slice(3);
    expect(stops).toHaveLength(22);
    expect(stops[0]).toBe(12);
    expect(stops.at(-2)).toBe(22);
    expect(stops[1]).toEqual(['max', 4, ['*', ['coalesce', ['get', 'widthM'], DEFAULT_STREET_WIDTH_M], 1 / metersPerPixel(12, 0)]]);
  });
});

describe('firstSymbolLayerId', () => {
  it('names the street names layer of the work map style', () => {
    expect(firstSymbolLayerId(WORK_MAP_STYLE)).toBe('street-name');
  });

  it('is undefined for a style without labels', () => {
    expect(firstSymbolLayerId({ layers: [{ id: 'ground', type: 'background' }] })).toBeUndefined();
  });
});

describe('WORK_MAP_LABELS_LAYER', () => {
  it('is the first label of both base map styles', async () => {
    const { WORK_MAP_LABELS_LAYER } = await import('./workLineWidth.js');
    const { WORK_MAP_DARK_STYLE } = await import('./workMapStyle.js');
    expect(firstSymbolLayerId(WORK_MAP_STYLE)).toBe(WORK_MAP_LABELS_LAYER);
    expect(firstSymbolLayerId(WORK_MAP_DARK_STYLE)).toBe(WORK_MAP_LABELS_LAYER);
  });
});

describe('work map lines carry the street width', () => {
  it('writes the width in meters on each feature, the common street when unknown', async () => {
    const { workMapCollection } = await import('./workMap.js');
    const collection = workMapCollection([{ streetId: 's1', color: '#111111', coordinates: [[-77, -12], [-76.9, -12]], widthM: 9.5 }, { streetId: 's2', color: '#111111', coordinates: [[-77, -12], [-76.9, -12]] }]);
    expect(collection.features.map((feature) => feature.properties.widthM)).toEqual([9.5, DEFAULT_STREET_WIDTH_M]);
  });

  it('paints no dashes in the viewer', async () => {
    const { LAYER_BASE_PAINT, LAYER_PLANNED_PAINT, LAYER_DONE_PAINT, WORK_MAP_STRETCH_PAINT } = await import('./workLayerLines.js');
    for (const paint of [LAYER_BASE_PAINT, LAYER_PLANNED_PAINT, LAYER_DONE_PAINT, WORK_MAP_STRETCH_PAINT]) expect(paint).not.toHaveProperty('line-dasharray');
  });
});
