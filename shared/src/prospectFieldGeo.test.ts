import { describe, expect, it } from 'vitest';
import { droppedGeoOf, fieldGeoMapOf, fieldGeoOf, GEO_VERTICES_MAX } from './prospectFieldGeo.js';
import { validateProspectInsight } from './prospectInsight.js';

const LOT = [{ lat: -12.05, lng: -77.03 }, { lat: -12.051, lng: -77.03 }, { lat: -12.051, lng: -77.031 }];
const FILE = 'a'.repeat(24);

describe('fieldGeoOf (agentes 17/11: a KML read into points and a polygon)', () => {
  it('takes points with their label and a polygon of 3 or more vertices', () => {
    expect(fieldGeoOf({ points: [{ lat: -12.05, lng: -77.03, label: 'Ingreso' }], polygon: LOT })).toEqual({ points: [{ lat: -12.05, lng: -77.03, label: 'Ingreso' }], polygon: LOT });
    expect(fieldGeoOf({ polygon: LOT })).toEqual({ polygon: LOT });
  });

  it('refuses an empty geo, a point off the planet, a polygon of 2 and more than the vertex cap', () => {
    expect(fieldGeoOf({})).toBeNull();
    expect(fieldGeoOf({ points: [{ lat: 95, lng: 0 }] })).toBeNull();
    expect(fieldGeoOf({ polygon: LOT.slice(0, 2) })).toBeNull();
    expect(fieldGeoOf({ polygon: Array.from({ length: GEO_VERTICES_MAX + 1 }, (_, index) => ({ lat: -12 - index / 1e4, lng: -77 })) })).toBeNull();
  });
});

describe('a PUT with a field that has a geo', () => {
  it('keeps the field and its geo', () => {
    const { patch, ignored } = validateProspectInsight({ fields: [{ key: 'area', label: 'Área', value: '3 200 m² según el KML', source: 'document', file_id: FILE, geo: { polygon: LOT } }] });
    expect(patch.set.fields?.[0]).toMatchObject({ key: 'area', geo: { polygon: LOT } });
    expect(ignored).toEqual([]);
  });

  it('a bad geo drops only the geo: the field is kept and the geo told back in ignored', () => {
    const { patch, ignored } = validateProspectInsight({ fields: [{ key: 'area', label: 'Área', value: '3 200 m²', geo: { polygon: LOT.slice(0, 2) } }] });
    expect(patch.set.fields).toEqual([{ key: 'area', label: 'Área', value: '3 200 m²' }]);
    expect(ignored).toEqual([{ field: 'fields.area.geo', message: expect.stringContaining('polygon') }]);
    expect(droppedGeoOf([{ key: 'area', geo: { polygon: LOT } }])).toEqual([]);
  });
});

describe('fieldGeoMapOf (the ficha draws the lot and the named points)', () => {
  const BOX = { width: 300, height: 160 };
  it('fits the outline and the points in the box, the outline closed and the pins apart', () => {
    const map = fieldGeoMapOf({ polygon: LOT, points: [{ lat: -12.0505, lng: -77.0305, label: 'Ingreso' }] }, BOX);
    expect(map.tiles.length).toBeGreaterThan(0);
    expect(map.outline).toHaveLength(LOT.length);
    expect(map.pins).toEqual([expect.objectContaining({ label: 'Ingreso' })]);
    for (const pixel of [...map.outline, ...map.pins]) {
      expect(pixel.left).toBeGreaterThanOrEqual(0);
      expect(pixel.left).toBeLessThanOrEqual(BOX.width);
      expect(pixel.top).toBeGreaterThanOrEqual(0);
      expect(pixel.top).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('draws only points when there is no outline', () => {
    const map = fieldGeoMapOf({ points: [{ lat: -12.05, lng: -77.03 }] }, BOX);
    expect([map.outline.length, map.pins.length]).toEqual([0, 1]);
  });
});
