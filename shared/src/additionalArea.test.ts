import { FORMS_LEVEL } from './appForms.js';
import { describe, expect, it } from 'vitest';
import { AREA_TYPE, areaAnswerOf, areaEditRequest, zoneRemoveAsk, zoneChipsOf, areaReportDay, areaRemoveAsk, areaRemoveRequest, isRemovableArea, areaCardLines, areaCreateRequest, areaDocumentOf, areaPlaceValues, areaTotalsLine, areaWriteStore, zonePlaceLine, MEASURE_IN_APK, measureInApkLinks } from './additionalArea.js';
import { ENLACE_DE_DESCARGA } from './invitacion.js';

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

  it('takes Portal\'s photo-only ticket from the structured answer (no maxSeconds: no video goes on it)', () => {
    const portalTicket = { url: 'https://portal.constroad.com/api/public/additional-area-upload/tok', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2030-01-01T00:00:00.000Z', maxBytes: 50_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] };
    const answer = areaAnswerOf({ responseType: 'ephemeral', data: { informeId: 'r9', areaId: 'a7', codigo: 'IAA-004', upload: portalTicket } } as never);
    expect(answer?.upload).toMatchObject({ url: portalTicket.url, fileField: 'file', mimeTypes: portalTicket.mimeTypes });
  });

  it('a structured ticket that also takes videos without a limit, or points elsewhere, is no ticket', () => {
    const base = { url: 'https://portal.constroad.com/api/public/additional-area-upload/tok', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2030-01-01T00:00:00.000Z', maxBytes: 1000 };
    expect(areaAnswerOf({ responseType: 'ephemeral', data: { informeId: 'r9', areaId: 'a7', upload: { ...base, mimeTypes: ['video/mp4'] } } } as never)?.upload).toBeNull();
    expect(areaAnswerOf({ responseType: 'ephemeral', data: { informeId: 'r9', areaId: 'a7', upload: { ...base, url: 'https://evil.example.com/x', mimeTypes: ['image/jpeg'] } } } as never)?.upload).toBeNull();
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

/** «Quitar área» (Portal's `quitar`, 12/11): it leaves the table and its photos go to Portal's trash. */
describe('removing an area', () => {
  it('asks by its item and sends only the area', () => {
    expect(areaRemoveAsk('3')).toEqual({ title: '¿Quitar el área 3?', hint: 'Sale del cuadro y sus fotos van a la papelera de Portal.' });
    expect(areaRemoveRequest('a-7')).toEqual({ kind: 'area_remove', area_id: 'a-7', forms: FORMS_LEVEL });
  });

  it('only an area taken in the field: one measured on its photos in Portal is the office\'s', () => {
    const base = { id: 'a1', areaM2: 4.8, lat: null, lng: null, photos: [] };
    expect(isRemovableArea({ ...base, method: 'medidas-iphone' })).toBe(true);
    expect(isRemovableArea({ ...base, method: 'a-mano' })).toBe(true);
    expect(isRemovableArea({ ...base, method: 'ar-app' })).toBe(true);
    expect(isRemovableArea({ ...base, method: 'foto-medida' })).toBe(false);
    expect(isRemovableArea({ ...base, method: null })).toBe(false);
  });
});

/** José 15/11: «que diga se mide en el APK para reducir margen de error»; the phone PWA no longer measures. */
describe('the banner that sends the measuring to the APK', () => {
  it('on Android it opens the APK and falls back to LilaStore; an iPhone gets no link, since it cannot install an APK', () => {
    // Arrange / Act
    const android = measureInApkLinks(false);
    const iphone = measureInApkLinks(true);
    // Assert
    expect(android.open).toBe(`intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.lilachat.app;S.browser_fallback_url=${encodeURIComponent(ENLACE_DE_DESCARGA)};end`);
    expect(android.install).toBe(ENLACE_DE_DESCARGA);
    expect(iphone.open).toBeNull();
    expect(iphone.install).toBeNull();
    expect(MEASURE_IN_APK).toEqual({ kicker: 'Medición', title: 'Se mide en el APK', why: 'Con la cámara (AR) y un lado medido con wincha hay menos error que midiendo sobre una foto.', open: 'Abrir en el APK', install: '¿No tienes el APK? Instalar Lilachat', iphone: 'Mide desde un teléfono Android con el APK de Lilachat.' });
  });
});

describe('areaReportDay', () => {
  it('reads Portal\'s date-only day as it is, never a day before (la-01 header)', () => {
    expect(areaReportDay('2026-11-15')).toBe('domingo 15 de noviembre de 2026');
    expect(areaReportDay('2026-01-01')).toBe('jueves 1 de enero de 2026');
  });

  it('without a valid day says nothing', () => {
    expect(areaReportDay(undefined)).toBeNull();
    expect(areaReportDay('15/11/2026')).toBeNull();
    expect(areaReportDay('2026-02-30')).toBeNull();
  });
});

describe('zonePlaceLine (José 15/11: the zone takes its street from the GPS)', () => {
  it('names the work-map street and its station when the engineer stands on one', () => {
    expect(zonePlaceLine({ id: 's1', name: 'Av. El Sol', distanceM: 6, measureM: 120.4 }, 'Calle 5')).toBe('Av. El Sol 0+120');
  });

  it('falls back to the street of the address, and to nothing', () => {
    expect(zonePlaceLine(null, 'Jr. Moquegua 310')).toBe('Jr. Moquegua 310');
    expect(zonePlaceLine(null, '  ')).toBeNull();
    expect(zonePlaceLine(null, null)).toBeNull();
  });
});

describe('areaEditRequest (design la-06: correct a zone measured in the field)', () => {
  const report = { id: 'r-1', type: AREA_TYPE } as const;
  const zone = { id: 'z-1', areaM2: 0.53, method: 'ar' as const, lat: -12.01, lng: -76.9, precisionM: 6, photos: [] };

  it('keeps the area, the method and the GPS: Portal rewrites the whole measure on an edit', () => {
    expect(areaEditRequest(report, zone, 5.2)).toEqual({
      kind: 'area_edit', area_id: 'z-1', area_m2: 0.53, thickness_cm: 5.2, method: 'ar', lat: -12.01, lng: -76.9, precision_m: 6, source: 'apk', report_id: 'r-1', forms: FORMS_LEVEL,
    });
  });

  it('without a thickness the zone stays in m² only', () => {
    expect(areaEditRequest(report, { ...zone, thicknessCm: 4 }, null)).not.toHaveProperty('thickness_cm');
  });

  it('a zone measured by hand keeps its two sides', () => {
    expect(areaEditRequest(report, { ...zone, method: 'a-mano', lengthM: 2, widthM: 1.5, areaM2: 3 }, null)).toMatchObject({ length_m: 2, width_m: 1.5, area_m2: 3 });
  });

  it('a zone with no GPS sends none', () => {
    const edit = areaEditRequest(report, { ...zone, lat: null, lng: null, precisionM: undefined }, null);
    expect(edit).not.toHaveProperty('lat');
    expect(edit).not.toHaveProperty('precision_m');
  });

  it('the office\'s areas (measured on their photos) and unknown methods are not edited from the field', () => {
    expect(areaEditRequest(report, { ...zone, method: 'foto-medida' }, null)).toBeNull();
    expect(areaEditRequest(report, { ...zone, method: null }, null)).toBeNull();
  });
});

describe('zoneRemoveAsk (la-06: «¿Borrar la zona 1?» and what the total becomes)', () => {
  it('says the zone and the total without it', () => {
    expect(zoneRemoveAsk(1, { areaM2: 18.42, volumeM3: 0.954 }, { areaM2: 4.81, volumeM3: 0.25 })).toEqual({ title: '¿Borrar la zona 1?', hint: 'Se quita del informe. El total queda en 13,61 m² · 0,704 m³.' });
  });

  it('without volume, the total in m² alone', () => {
    expect(zoneRemoveAsk(2, { areaM2: 0.53, volumeM3: 0 }, { areaM2: 0.53 }).hint).toBe('Se quita del informe. El total queda en 0,00 m².');
  });

  it('never a negative total from rounding', () => {
    expect(zoneRemoveAsk(1, { areaM2: 1.2, volumeM3: 0.01 }, { areaM2: 1.21, volumeM3: 0.02 }).hint).toBe('Se quita del informe. El total queda en 0,00 m².');
  });
});

describe('a saved zone\'s chips (José 15/11: m², m³, perímetro)', () => {
  const zone = { id: 'z1', areaM2: 4.8, method: 'medidas-iphone' as const, lat: null, lng: null, photos: [] };

  it('two sides measured: their rectangle\'s perimeter and four sides', () => {
    expect(zoneChipsOf({ ...zone, lengthM: 3.2, widthM: 1.5 }, 5)).toEqual([
      { label: 'Área', value: '4,80 m²' }, { label: 'Volumen', value: '0,240 m³' }, { label: 'Perímetro', value: '9,40 m' }, { label: 'Lados', value: '4' },
    ]);
  });

  it('only the area (an AR zone keeps no sides in Portal): the area alone, volume with a thickness', () => {
    expect(zoneChipsOf({ ...zone, areaM2: 0.53, method: 'ar' }, null)).toEqual([{ label: 'Área', value: '0,53 m²' }]);
  });
});

describe('areaEditRequest with a corrected AR zone (José 16/11)', () => {
  it('sends the new area, the method and the geometry, never a length × width', () => {
    const area = { id: 'a1', areaM2: 3, lengthM: 2, widthM: 1.5, method: 'ar' as const, lat: null, lng: null, photos: [] };
    const request = areaEditRequest(null, area, null, { areaM2: 3.15, method: 'ar-app', geometry: '{"v":1}' })!;

    expect(request).toMatchObject({ kind: 'area_edit', area_m2: 3.15, method: 'ar-app', geometry: '{"v":1}' });
    expect(request).not.toHaveProperty('length_m');
  });
});
