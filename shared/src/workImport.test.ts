import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { confirmImport, IMPORT_NOTHING, importCreateLabel, importDoneLabel, importFileType, importReviewOf, reviewImport, workImportRequest } from './workImport.js';
import { KML_TYPE, KMZ_TYPE } from './driveUpload.js';
import type { MapEditSend } from './workScopeDraft.js';

/** «Importar KMZ o KML» (o-12, Portal abc01353): review first, then confirm with an entry. */
const MEDIA = '6aef8d455e4b25190f7c3177';
const ENTRY = '0b7e7d0e-6a8f-4c3b-9d2e-1f2a3b4c5d6e';

describe('importFileType', () => {
  it('decides by the name, since phones send .kmz as anything', () => {
    expect(importFileType('Obra.KMZ', 'application/octet-stream')).toBe(KMZ_TYPE);
    expect(importFileType('trazo.kml', '')).toBe(KML_TYPE);
    expect(importFileType('x', KMZ_TYPE)).toBe(KMZ_TYPE);
    expect(importFileType('foto.jpg', 'image/jpeg')).toBeNull();
  });
});

describe('the request and the answer', () => {
  it('reviews without an entry and confirms with one', () => {
    expect(workImportRequest(MEDIA)).toEqual({ kind: 'work_import', media_id: MEDIA, confirm: false, forms: FORMS_LEVEL });
    expect(workImportRequest(MEDIA, ENTRY)).toEqual({ kind: 'work_import', media_id: MEDIA, confirm: true, entry_id: ENTRY, forms: FORMS_LEVEL });
  });

  it('reads the lines Portal found or created, and the skipped ones with their reason', () => {
    expect(importReviewOf({ calles: [{ nombre: 'Jr. Los Pinos', largoM: 320.4, puntos: 12 }, { largoM: 80 }], omitidas: [{ nombre: 'Parque', motivo: 'Es un polígono' }] })).toEqual({
      lines: [{ name: 'Jr. Los Pinos', length: '320 m' }, { name: 'Sin nombre', length: '80 m' }],
      skipped: [{ name: 'Parque', reason: 'Es un polígono' }],
    });
    expect(importReviewOf({ creadas: [{ calleId: 's1', nombre: 'A', largoM: 10 }] }).lines).toEqual([{ name: 'A', length: '10 m' }]);
    expect(importReviewOf(undefined)).toEqual({ lines: [], skipped: [] });
  });

  it('a file without lines says so; the confirm goes with its entry', async () => {
    expect(await reviewImport(async () => ({ ok: true, message: '', data: { calles: [], omitidas: [] } }), MEDIA)).toEqual({ ok: false, message: IMPORT_NOTHING });
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { creadas: [{ nombre: 'A', largoM: 10 }] } }));
    expect(await confirmImport(send, MEDIA, ENTRY)).toEqual({ ok: true, review: { lines: [{ name: 'A', length: '10 m' }], skipped: [] } });
    expect(send.mock.calls[0]![0]).toMatchObject({ confirm: true, entry_id: ENTRY });
  });

  it('counts in words', () => {
    expect(importCreateLabel(1)).toBe('Crear 1 calle');
    expect(importCreateLabel(4)).toBe('Crear 4 calles');
    expect(importDoneLabel(4)).toBe('Se crearon 4 calles.');
  });
});
