import { describe, expect, it } from 'vitest';
import { AREA_TYPE, areaAnswerOf, areaCardLines, areaCreateRequest, areaDocumentOf, areaPlaceValues, areaTotalsLine, areaWriteStore } from './additionalArea.js';

/** Portal's `informe_area_adicional` as agentes passes it (Portal 12/11, proposed contract). */
const portalArea = {
  id: 'a1', item: '1', ubicacion: 'Jr. Moquegua cdra 3', descripcion: 'Bacheo localizado', largoM: 3.2, anchoM: 1.5, espesorCm: 5, areaM2: 4.8, volumenM3: 0.24,
  metodo: 'medidas-iphone', verificar: true, lat: -12.05, lng: -77.03, precisionM: 22, fuente: 'web', aproximada: true,
  fotos: [{ mediaId: 'm1', url: 'https://lila.constroad.com/m/1.jpg', thumbnailUrl: 'https://lila.constroad.com/m/1-t.jpg', captura: true }],
};
const portalDocument = { id: 'r9', codigo: 'IAA-003', estado: 'draft', fecha: '2026-11-12', areas: [portalArea, { id: 'a2', areaM2: 12.5, metodo: 'a-mano', fotos: [] }], totales: { areaM2: 17.3, volumenM3: 0.24 } };

describe('areaDocumentOf', () => {
  it('reads Portal\'s areas with their figures, method, place and photos', () => {
    const document = areaDocumentOf(portalDocument)!;
    expect(document).toMatchObject({ id: 'r9', code: 'IAA-003', type: AREA_TYPE, status: 'draft', totals: { areaM2: 17.3, volumeM3: 0.24 } });
    expect(document.areas[0]).toEqual({
      id: 'a1', item: '1', place: 'Jr. Moquegua cdra 3', description: 'Bacheo localizado', lengthM: 3.2, widthM: 1.5, thicknessCm: 5, areaM2: 4.8, volumeM3: 0.24,
      method: 'medidas-iphone', lat: -12.05, lng: -77.03, precisionM: 22, approximate: true,
      photos: [{ url: 'https://lila.constroad.com/m/1.jpg', thumbUrl: 'https://lila.constroad.com/m/1-t.jpg', mime: 'image/jpeg', capture: true }],
    });
    expect(document.areas[1]).toMatchObject({ id: 'a2', areaM2: 12.5, method: 'a-mano', lat: null, lng: null, photos: [] });
  });

  it('reads its own output again (the server parses it and the app parses what the server sent)', () => {
    const once = areaDocumentOf(portalDocument)!;
    expect(areaDocumentOf(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('an empty draft is a document with no areas', () => {
    expect(areaDocumentOf({ id: null, areas: [], totales: { areaM2: 0, volumenM3: 0 } })).toMatchObject({ id: '', areas: [], totals: { areaM2: 0, volumeM3: 0 } });
  });

  it('without an areas list it is not this report', () => {
    expect(areaDocumentOf({ id: 'r1', sections: [] })).toBeNull();
    expect(areaDocumentOf(null)).toBeNull();
  });

  it('an area without its id or its m² is left out; an unknown method reads as none', () => {
    const document = areaDocumentOf({ areas: [{ areaM2: 3 }, { id: 'x' }, { id: 'y', areaM2: 2, metodo: 'otro' }] })!;
    expect(document.areas.map((area) => area.id)).toEqual(['y']);
    expect(document.areas[0]!.method).toBeNull();
  });

  it('keeps up to 100 photos per area: Portal has a real area with 85 (agentes 3006ed9)', () => {
    const pictures = Array.from({ length: 101 }, (_, index) => ({ url: `https://lila.constroad.com/m/${index}.jpg` }));
    expect(areaDocumentOf({ areas: [{ id: 'a', areaM2: 1, fotos: pictures.slice(0, 85) }] })!.areas[0]!.photos).toHaveLength(85);
    expect(areaDocumentOf({ areas: [{ id: 'a', areaM2: 1, fotos: pictures }] })!.areas[0]!.photos).toHaveLength(100);
  });

  it('photos with no area come at the report level (`fotosSinArea`, Portal and agentes 3006ed9)', () => {
    const document = areaDocumentOf({ ...portalDocument, fotosSinArea: [{ url: 'https://lila.constroad.com/m/suelta.jpg', thumbnailUrl: 'https://lila.constroad.com/m/suelta-t.jpg' }, { url: 'http://insegura' }] })!;
    expect(document.loosePhotos).toEqual([{ url: 'https://lila.constroad.com/m/suelta.jpg', thumbUrl: 'https://lila.constroad.com/m/suelta-t.jpg', mime: 'image/jpeg' }]);
    expect(areaDocumentOf(JSON.parse(JSON.stringify(document)))!.loosePhotos).toEqual(document.loosePhotos);
    expect(areaDocumentOf(portalDocument)!.loosePhotos).toEqual([]);
  });

  it('totals add up the areas when Portal sends none', () => {
    expect(areaDocumentOf({ areas: [{ id: 'a', areaM2: 1.25 }, { id: 'b', areaM2: 2.5, volumenM3: 0.1 }] })!.totals).toEqual({ areaM2: 3.75, volumeM3: 0.1 });
  });
});

describe('areaTotalsLine', () => {
  it('«2 áreas · 17,30 m²», and the volume only when there is one', () => {
    expect(areaTotalsLine({ count: 2, totals: { areaM2: 17.3, volumeM3: 0 } })).toBe('2 áreas · 17,30 m²');
    expect(areaTotalsLine({ count: 1, totals: { areaM2: 4.8, volumeM3: 0.24 } })).toBe('1 área · 4,80 m² · 0,240 m³');
  });
});

describe('areaCreateRequest', () => {
  const entryId = '7f6c1d2e-1111-4a2b-9c3d-123456789abc';

  it('length × width from an iPhone, with its place and the report it belongs to', () => {
    expect(areaCreateRequest({ id: 'r9', type: AREA_TYPE }, entryId, { lengthM: 3.2, widthM: 1.5, areaM2: 4.8, thicknessCm: 5, volumeM3: 0.24, line: '', large: false }, { lat: -12.05, lng: -77.03, precision: 6.4 }, 'medidas-iphone', 'web')).toEqual({
      kind: 'area_create', entry_id: entryId, length_m: 3.2, width_m: 1.5, area_m2: 4.8, thickness_cm: 5, method: 'medidas-iphone', lat: -12.05, lng: -77.03, precision_m: 6, source: 'web', report_id: 'r9', forms: expect.any(Number),
    });
  });

  it('a direct area goes without sides; no GPS goes without a place; no report goes without an id', () => {
    const request = areaCreateRequest(null, entryId, { areaM2: 17.6, line: '', large: false }, null, 'a-mano', 'apk');
    expect(request).toEqual({ kind: 'area_create', entry_id: entryId, area_m2: 17.6, method: 'a-mano', source: 'apk', forms: expect.any(Number) });
  });
});

describe('areaPlaceValues', () => {
  it('blank texts go as nothing: Portal fills the street and «Bacheo localizado», never a filler of ours', () => {
    expect(areaPlaceValues({ place: '  ', note: '' })).toEqual({});
    expect(areaPlaceValues({ place: ' Jr. Moquegua ', note: 'Fuera del metrado' })).toEqual({ ubicacion: 'Jr. Moquegua', descripcion: 'Fuera del metrado' });
  });
});

describe('areaAnswerOf and the store', () => {
  const ticket = { url: 'https://portal.constroad.com/api/iaa/upload', method: 'POST', fields: { t: 'x' }, fileField: 'file', expiresAt: '2030-01-01T00:00:00.000Z', maxBytes: 50_000_000, maxSeconds: 30, mimeTypes: ['image/jpeg'] };

  it('reads the report, the area and its code', () => {
    expect(areaAnswerOf({ responseType: 'ephemeral', data: { informeId: 'r9', areaId: 'a7', codigo: 'Área 3' }, upload: ticket } as never)).toEqual({ reportId: 'r9', areaId: 'a7', code: 'Área 3', upload: ticket });
    expect(areaAnswerOf({ responseType: 'ephemeral', data: { informeId: 'r9' } } as never)).toBeNull();
  });

  it('without a place to send it from, the store says so and writes nothing', async () => {
    const store = areaWriteStore();
    expect(await store.run(null, { place: '', note: '' }, [], 'guardada')).toBeNull();
    expect(store.get().line).toMatch(/No se pudo/);
  });
});

describe('areaCardLines', () => {
  it('the m², the sides, the volume and the method, each only when there is one', () => {
    const [first, second] = areaDocumentOf(portalDocument)!.areas;
    expect(areaCardLines(first!)).toEqual({ size: '4,80 m²', sides: '3,20 × 1,50 m', volume: '0,240 m³', method: 'Medidas (iPhone)' });
    expect(areaCardLines(second!)).toEqual({ size: '12,50 m²', sides: null, volume: null, method: 'A mano' });
  });
});
