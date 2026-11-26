import { describe, expect, it } from 'vitest';
import { AREA_WRITE } from './additionalArea.js';
import { fieldWriteJobOf, fieldWriteKindOf, fieldWriteLabel, isDirectFieldWrite, projectAreaReport } from './fieldWrites.js';
import type { AreaDocument } from './additionalArea.js';
import { OBSERVATION_WRITE } from './observationWrite.js';

describe('fieldWrites', () => {
  it('each write reads Portal\'s answer as its own screen does', () => {
    expect(fieldWriteKindOf('observation')).toBe(OBSERVATION_WRITE);
    expect(fieldWriteKindOf('area')).toBe(AREA_WRITE);
  });

  it('names what waits in the strip', () => {
    expect(fieldWriteLabel({ kind: 'observation_register' })).toBe('Observación nueva');
    expect(fieldWriteLabel({ kind: 'area_create' })).toBe('Área adicional');
    expect(fieldWriteLabel({ kind: 'whatever' })).toBe('Registro de campo');
  });

  it('is an «observation» job of its service', () => {
    const scope = { spaceId: '6650f1a2b3c4d5e6f7a8b9c0', clientId: 'c', serviceId: '66a1b2c3d4e5f6a7b8c9d0e1', chatId: '6651aa00bb11cc22dd33ee44' };
    const job = fieldWriteJobOf({ key: '3f1c2b9a-6d7e-4f80-9a1b-2c3d4e5f6a7b', scope, payload: { write: 'area', request: { kind: 'area_create', entry_id: '3f1c2b9a-6d7e-4f80-9a1b-2c3d4e5f6a7b' }, values: {}, fileFields: {} }, files: [], now: 1 });
    expect(job).toMatchObject({ kind: 'observation', label: 'Área adicional', scope });
  });
});

describe('area edits and removals in the queue', () => {
  const SERVICE = '66a1b2c3d4e5f6a7b8c9d0e1';
  const scope = { spaceId: '6650f1a2b3c4d5e6f7a8b9c0', clientId: 'c', serviceId: SERVICE, chatId: '6651aa00bb11cc22dd33ee44' };
  const AREA_A = '6b0861aa847294dd7b968c01';
  const AREA_B = '6b0861aa847294dd7b968c02';
  const report: AreaDocument = {
    id: '6b0861aa847294dd7b968cff', type: 'IAA', status: 'draft', loosePhotos: [], totals: { areaM2: 30, volumeM3: 1 },
    areas: [
      { id: AREA_A, areaM2: 10, thicknessCm: 10, volumeM3: 1, method: 'ar', lat: null, lng: null, photos: [], place: 'Jr. Lima' },
      { id: AREA_B, areaM2: 20, method: 'a-mano', lat: null, lng: null, photos: [] },
    ],
  };
  const job = (key: string, request: Record<string, unknown>, values: Record<string, string> = {}, serviceId = SERVICE) =>
    fieldWriteJobOf({ key, scope: { ...scope, serviceId }, payload: { write: 'area', request, values, fileFields: {} }, files: [], now: 1 });

  it('only edits and removals go without files', () => {
    expect(isDirectFieldWrite({ kind: 'area_edit' })).toBe(true);
    expect(isDirectFieldWrite({ kind: 'area_remove' })).toBe(true);
    expect(isDirectFieldWrite({ kind: 'area_create' })).toBe(false);
    expect(isDirectFieldWrite({})).toBe(false);
  });

  it('a waiting removal hides the area and takes it out of the totals', () => {
    const shown = projectAreaReport(report, [job('k1', { kind: 'area_remove', area_id: AREA_A })], SERVICE);
    expect(shown.areas.map((area) => area.id)).toEqual([AREA_B]);
    expect(shown.totals).toEqual({ areaM2: 20, volumeM3: 0 });
  });

  it('a waiting edit shows the new measure, thickness and texts; the last edit wins', () => {
    const queue = [
      job('k1', { kind: 'area_edit', area_id: AREA_B, area_m2: 25, thickness_cm: 4 }, { ubicacion: 'Av. Colonial' }),
      job('k2', { kind: 'area_edit', area_id: AREA_B, area_m2: 22, thickness_cm: 5 }, { descripcion: 'Bacheo' }),
    ];
    const edited = projectAreaReport(report, queue, SERVICE).areas[1]!;
    expect(edited).toMatchObject({ areaM2: 22, thicknessCm: 5, volumeM3: 1.1, place: 'Av. Colonial', description: 'Bacheo' });
    expect(projectAreaReport(report, queue, SERVICE).totals).toEqual({ areaM2: 32, volumeM3: 2.1 });
  });

  it('an edit without thickness drops the volume', () => {
    const edited = projectAreaReport(report, [job('k1', { kind: 'area_edit', area_id: AREA_A, area_m2: 12 })], SERVICE).areas[0]!;
    expect(edited.thicknessCm).toBeUndefined();
    expect(edited.volumeM3).toBeUndefined();
  });

  it('ignores other services, new areas and an area no longer there', () => {
    const queue = [
      job('k1', { kind: 'area_remove', area_id: AREA_A }, {}, '66a1b2c3d4e5f6a7b8c9d0ff'),
      job('k2', { kind: 'area_create', entry_id: 'k2', area_m2: 5 }),
      job('k3', { kind: 'area_edit', area_id: '6b0861aa847294dd7b968c99', area_m2: 99 }),
    ];
    expect(projectAreaReport(report, queue, SERVICE)).toEqual(report);
  });
});
