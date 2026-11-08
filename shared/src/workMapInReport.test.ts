import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { workMapOf, type WorkMap } from './workMap.js';
import { inReportViewOf, IN_REPORT_IDLE, mapInReportOf, setMapInReport, toggleMapInReport, workMapInReportRequest } from './workMapInReport.js';
import type { MapEditSend } from './workScopeDraft.js';

/** «Incluir en el informe del servicio» (o-08, Portal 926b9723). */
const map: WorkMap = workMapOf({ workStreets: { streets: [], scopes: [], progress: [], tags: [], stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }] } }) ?? { streets: [], scopes: [], progress: [], works: [], stages: [{ id: 'e1', name: 'Etapa 1' }] };

describe('workMapInReportRequest', () => {
  it('turning it on carries the cut; turning it off carries none', () => {
    expect(workMapInReportRequest(true, { stageId: 'e1', untilDay: '2026-11-06', workId: 'x' })).toEqual({ kind: 'work_map_in_report', include: true, stage_id: 'e1', until: '2026-11-06', forms: FORMS_LEVEL });
    expect(workMapInReportRequest(false, { stageId: 'e1' })).toEqual({ kind: 'work_map_in_report', include: false, forms: FORMS_LEVEL });
  });
});

describe('mapInReportOf', () => {
  it('says what the report carries, with the stage by its name', () => {
    expect(mapInReportOf(map, { incluido: true, etapa: 'e1', hasta: '2026-11-06' }, true)).toEqual({ included: true, label: 'Se adjunta al informe: Etapa 1 · Hasta el 6 nov.' });
    expect(mapInReportOf(map, { incluido: true }, true).label).toBe('Se adjunta al informe: Toda la obra · Hasta el día del informe.');
    expect(mapInReportOf(map, { incluido: false }, true)).toEqual({ included: false, label: 'El informe del servicio va sin el mapa.' });
    expect(mapInReportOf(map, undefined, false).included).toBe(false);
  });

  it('sends it through the door and shows Portal\'s refusal', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { incluido: true } }));
    expect(await setMapInReport(send, map, {}, true)).toMatchObject({ ok: true, state: { included: true } });
    expect(await setMapInReport(async () => ({ ok: false, message: 'No.' }), map, {}, true)).toEqual({ ok: false, message: 'No.' });
  });
});

describe('toggleMapInReport', () => {
  it('keeps the switch where it was on a refusal', async () => {
    expect(await toggleMapInReport(async () => ({ ok: false, message: 'No.' }), map, {}, true)).toEqual({ on: null, note: { ok: false, text: 'No.' } });
    expect((await toggleMapInReport(async () => ({ ok: true, message: '', data: { incluido: false } }), map, {}, false)).on).toBe(false);
  });
});

describe('inReportViewOf', () => {
  it('opens on when Portal has it on, with its cut', () => {
    expect(inReportViewOf(map, { included: true, stageId: 'e1', until: '2026-11-06' })).toEqual({ on: true, busy: false, note: { ok: true, text: 'Se adjunta al informe: Etapa 1 · Hasta el 6 nov.' } });
    expect(inReportViewOf(map, { included: false })).toEqual(IN_REPORT_IDLE);
    expect(inReportViewOf(map, undefined)).toEqual(IN_REPORT_IDLE);
  });
});
