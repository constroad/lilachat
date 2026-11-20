import { describe, expect, it } from 'vitest';
import { MARK_CHIP_PAINT, MARK_FILL_PAINT, MARK_GLYPH_PAINT, MARK_TEXT_LAYOUT, mapMarkCollection, mapMarksBounds, markColor, markName, workMapMarksOf } from './workMapMarks.js';
import { workMapOf, workMapView, WORK_MAP_MIN_FRAME_DEG } from './workMap.js';

/** José 19/11 (El Almirante, parches Jr. Conchucos): Portal's map showed 33 drawings; Lilachat said «Todavía no hay calles». */
describe('workMapMarksOf', () => {
  it('reads every kind Portal draws and leaves a broken one out', () => {
    // Arrange
    const raw = [
      { id: 'a', type: 'giba', shape: { kind: 'circle', center: { lat: -12.05, lng: -77.03 }, radiusM: 4 } },
      { id: 'b', type: 'buzon', note: 'Tapa rota', shape: { kind: 'symbol', at: { lat: -12.06, lng: -77.04 } } },
      { id: 'c', type: 'otro', shape: { kind: 'rect', corners: [{ lat: -12.05, lng: -77.03 }, { lat: -12.051, lng: -77.031 }] } },
      { id: 'd', type: 'sardinel', shape: { kind: 'arrow', from: { lat: -12.05, lng: -77.03 }, to: { lat: -12.052, lng: -77.03 } } },
      { id: 'e', type: 'bocacalle', shape: { kind: 'polygon', points: [{ lat: -12.05, lng: -77.03 }, { lat: -12.05, lng: -77.031 }, { lat: -12.051, lng: -77.031 }] } },
      { id: 'f', type: 'giba', shape: { kind: 'circle', center: { lat: 'x', lng: -77 }, radiusM: 4 } },
      { id: 'g', type: 'giba', hidden: true, shape: { kind: 'symbol', at: { lat: -12.05, lng: -77.03 } } },
    ];
    // Act
    const marks = workMapMarksOf(raw);
    // Assert
    expect(marks.map((mark) => mark.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(marks[1]).toMatchObject({ type: 'buzon', note: 'Tapa rota' });
  });

  it('nothing, or not a list, is no drawings', () => {
    expect(workMapMarksOf(undefined)).toEqual([]);
    expect(workMapMarksOf({ id: 'a' })).toEqual([]);
  });
});

describe('mapMarkCollection', () => {
  it('areas as polygons, the arrow as a line, a dropped element as a point, each with its label', () => {
    // Arrange
    const marks = workMapMarksOf([
      { id: 'a', type: 'giba', shape: { kind: 'circle', center: { lat: -12.05, lng: -77.03 }, radiusM: 4 } },
      { id: 'b', type: 'buzon', shape: { kind: 'symbol', at: { lat: -12.06, lng: -77.04 } } },
      { id: 'd', type: 'sardinel', shape: { kind: 'arrow', from: { lat: -12.05, lng: -77.03 }, to: { lat: -12.052, lng: -77.03 } } },
    ]);
    // Act
    const collection = mapMarkCollection(marks);
    // Assert
    expect(collection.features.map((feature) => feature.geometry.type)).toEqual(['Polygon', 'Point', 'LineString']);
    expect(collection.features.map((feature) => feature.properties.label)).toEqual(['Giba', 'Buzón', 'Sardinel']);
    const ring = (collection.features[0]!.geometry as { coordinates: number[][][] }).coordinates[0]!;
    expect(ring[0]).toEqual(ring.at(-1));
  });

  it('the bounds hold every drawing; none without drawings', () => {
    const marks = workMapMarksOf([{ id: 'b', type: 'poste', shape: { kind: 'symbol', at: { lat: -12.06, lng: -77.04 } } }, { id: 'c', type: 'poste', shape: { kind: 'symbol', at: { lat: -12.05, lng: -77.03 } } }]);
    expect(mapMarksBounds(marks)).toEqual([[-77.04, -12.06], [-77.03, -12.05]]);
    expect(mapMarksBounds([])).toBeNull();
  });
});

describe('a service with drawings and no streets', () => {
  it('is a map (not «Todavía no hay calles») framed on its drawings', () => {
    // Arrange
    const detail = { workStreets: null, workMapMarks: [{ id: 'a', type: 'giba', shape: { kind: 'symbol', at: { lat: -12.05, lng: -77.03 } } }] };
    // Act
    const map = workMapOf(detail);
    // Assert
    expect(map).toMatchObject({ streets: [], marks: [{ id: 'a' }] });
    // A lone point is framed with the minimum span (José 19/11: never at full zoom).
    expect(workMapView(map!).bounds).toEqual([[-77.03 - WORK_MAP_MIN_FRAME_DEG / 2, -12.05 - WORK_MAP_MIN_FRAME_DEG / 2], [-77.03 + WORK_MAP_MIN_FRAME_DEG / 2, -12.05 + WORK_MAP_MIN_FRAME_DEG / 2]]);
  });

  it('neither streets nor drawings is still no map', () => {
    expect(workMapOf({ workStreets: null, workMapMarks: [] })).toBeNull();
  });
});

/** José 19/11: the 33 points of El Almirante all read «Otro»; Portal names them by their note. */
describe('markName', () => {
  it('an «Otro» with a note goes by its note, cut to fit; any other by its type', () => {
    expect(markName({ type: 'otro', note: 'Parche 12' })).toBe('Parche 12');
    expect(markName({ type: 'otro', note: 'Parche frente al colegio de la avenida principal' })).toBe('Parche frente al colegio de la…');
    expect(markName({ type: 'otro' })).toBe('Otro');
    expect(markName({ type: 'giba', note: 'frente al colegio' })).toBe('Giba');
  });
});

/** José 19/11: Lilachat drew every drawing as an orange dot; Portal's croquis, a white chip ringed in its type's color. */
describe("the drawings look like Portal's croquis", () => {
  it("each type wears Portal's color (MAP_MARK_TYPES), an unknown one the color of «Otro»", () => {
    expect(markColor('giba')).toBe('#db7706');
    expect(markColor('buzon')).toBe('#205fc5');
    expect(markColor('cono')).toBe('#dc2618');
    expect(markColor('otro')).toBe('#5d636f');
    expect(markColor('ventana')).toBe('#5d636f');
  });

  it('every feature carries its type color for the paint to read', () => {
    // Arrange
    const marks = workMapMarksOf([
      { id: 'a', type: 'arbol', shape: { kind: 'symbol', at: { lat: -12.05, lng: -77.03 } } },
      { id: 'b', type: 'otro', note: 'Parche 1', shape: { kind: 'symbol', at: { lat: -12.06, lng: -77.04 } } },
    ]);
    // Act
    const collection = mapMarkCollection(marks);
    // Assert
    expect(collection.features.map((feature) => feature.properties.color)).toEqual(['#1c7d3f', '#5d636f']);
  });

  it('an element is a white chip ringed and dotted in its color; an area is filled in its color', () => {
    expect(MARK_CHIP_PAINT).toMatchObject({ 'circle-color': '#ffffff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 });
    expect(MARK_GLYPH_PAINT).toMatchObject({ 'circle-color': ['get', 'color'] });
    expect(MARK_FILL_PAINT).toMatchObject({ 'fill-color': ['get', 'color'] });
  });

  it("an element's tag shows from zoom 16, like Portal; an area's label always", () => {
    // Arrange
    const field = MARK_TEXT_LAYOUT['text-field'] as unknown[];
    // Act
    const [operator, , below, minZoom, above] = field;
    // Assert
    expect(operator).toBe('step');
    expect(minZoom).toBe(16);
    expect(below).toEqual(['case', ['==', ['geometry-type'], 'Point'], '', ['get', 'label']]);
    expect(above).toEqual(['get', 'label']);
  });
});
