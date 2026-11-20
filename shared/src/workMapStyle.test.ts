import { describe, expect, it } from 'vitest';
import { ROAD_SOURCE_LAYERS } from './workStreetPick.js';
import { LIGHT_MAP_PALETTE, WORK_MAP_DARK_STYLE, WORK_MAP_STYLE, workMapStyleFor } from './workMapStyle.js';

/**
 * José 09/11: «ese mapa no me gusta… se ve feo, no se parece en nada a tus diseños». The base
 * was OpenFreeMap's positron: washed-out gray, with the streets in English («Moquegua Street»).
 * The Stitch design (o-01) draws white blocks, wide light streets and the names in Spanish, in
 * capitals. Same free tiles (no token, no card), a style of our own.
 */
const layers = WORK_MAP_STYLE.layers;
const textFields = layers.flatMap((layer) => (layer.layout && 'text-field' in layer.layout ? [JSON.stringify(layer.layout['text-field'])] : []));

describe('the base map of the work map', () => {
  it('reads OpenFreeMap\'s free vector tiles and fonts', () => {
    // Arrange / Act
    const sources = Object.values(WORK_MAP_STYLE.sources);
    // Assert
    expect(sources).toEqual([{ type: 'vector', url: 'https://tiles.openfreemap.org/planet' }]);
    expect(WORK_MAP_STYLE.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
  });

  it('names every street in Spanish (the local name, never the English one) and in capitals', () => {
    expect(textFields.length).toBeGreaterThan(0);
    expect(textFields.every((field) => !field.includes('name_en') && !field.includes('name:en'))).toBe(true);
    expect(textFields.every((field) => field.includes('"upcase"') && field.includes('"name"'))).toBe(true);
  });

  it('keeps drawing the road layers a tap on a street reads', () => {
    const roadLayers = layers.filter((layer) => 'source-layer' in layer && ROAD_SOURCE_LAYERS.includes(layer['source-layer'] ?? ''));
    expect(roadLayers.map((layer) => layer['source-layer'])).toEqual(expect.arrayContaining(['transportation', 'transportation_name']));
  });

  it('every layer has its own id and paints only colors the map can read (no CSS variables)', () => {
    const ids = layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(layers)).not.toContain('var(--');
  });
});

/** Audit 20/11 (mapa-v2-movil): in dark mode the base map stayed light; Stitch draws it dark. */
describe('the dark base map', () => {
  it('follows the theme: dark style in dark mode, the light one otherwise', () => {
    expect(workMapStyleFor(true)).toBe(WORK_MAP_DARK_STYLE);
    expect(workMapStyleFor(false)).toBe(WORK_MAP_STYLE);
  });

  it('uses the same free tiles and the same layer ids, so switching only repaints', () => {
    expect(WORK_MAP_DARK_STYLE.sources).toEqual(WORK_MAP_STYLE.sources);
    expect(WORK_MAP_DARK_STYLE.layers.map((layer) => layer.id)).toEqual(layers.map((layer) => layer.id));
  });

  it('paints a dark ground, not the light one', () => {
    const ground = WORK_MAP_DARK_STYLE.layers.find((layer) => layer.id === 'ground');
    const color = String(ground?.paint?.['background-color']);
    expect(color).not.toBe(LIGHT_MAP_PALETTE.ground);
    expect(Number(/(\d+)%\)$/.exec(color)?.[1])).toBeLessThan(20);
  });
});
