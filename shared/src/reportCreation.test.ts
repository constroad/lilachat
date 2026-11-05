import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms';
import { isFieldReport } from './clientAccess';
import { fieldDocumentOf } from './fieldDocument';
import { itemsLine, progressLine, progressPercent, publishFormRequest, readReportDraft, REPORT_TYPE_OPTIONS, reportDraftPath, reportDraftRequest, reportFormActions, reportFormsPath, reportTypeLabel, reportViewOf, sectionBadge, sectionFormRequest, sectionNeedsPlace, STATUS_BADGE, type TrackStart } from './reportCreation';

/** A CTL-IMP as Portal answers it, with one tramo whose photos go through their own tool. */
const form = (title: string) => ({ type: 'object', properties: { campo: { type: 'string', title } } });
const body = {
  id: '6aed0a1b2c3d4e5f60718293', type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: form('General'), ubicacion: form('Ubicación'), fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: [], results: [], form: 'general', values: { campo: 'x' } },
    {
      id: 'tramos', title: 'Tramos', required: true, state: 'partial', summary: [],
      repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }] },
      items: [{ id: 't1', title: 'Tramo 1', summary: [], results: [], sections: [{ id: 'ubicacion', state: 'done', values: {} }, { id: 'fotos', state: 'empty', values: {} }] }],
    },
  ],
  publish: { label: 'Publicar informe', missing: [] },
};
const document = () => fieldDocumentOf(body)!;
const tramos = () => {
  const section = document().sections[1];
  if (section.kind !== 'repeat') throw new Error('tramos is a repeat');
  return section;
};

describe('the types a report can be', () => {
  it('offers the eight types of the public page, and only CTL-IMP opens here today', () => {
    expect(REPORT_TYPE_OPTIONS).toHaveLength(8);
    expect(REPORT_TYPE_OPTIONS.filter((option) => option.opensHere).map((option) => option.code)).toEqual(['CTL-IMP']);
    expect(REPORT_TYPE_OPTIONS.slice(0, 3).map((option) => option.code)).toEqual(['CTL-IMP', 'IAA', 'CTL-PIS']);
    REPORT_TYPE_OPTIONS.forEach((option) => expect(isFieldReport({ typeLabel: option.label })).toBe(true));
  });
});

describe('what the phone asks the server', () => {
  it('builds the paths under the service, escaping the ids', () => {
    expect(reportDraftPath('s1', 'cli 1', 'srv')).toBe('/workspaces/s1/clients/cli%201/services/srv/reports/draft');
    expect(reportFormsPath('s1', 'c', 'srv/2')).toBe('/workspaces/s1/clients/c/services/srv%2F2/reports/forms');
  });

  it('asks the draft by type, with the report once it is known', () => {
    expect(reportDraftRequest('CTL-IMP', null)).toEqual({ type: 'CTL-IMP' });
    expect(reportDraftRequest('CTL-IMP', body.id)).toEqual({ type: 'CTL-IMP', report_id: body.id });
  });

  it('opens a section with its path, the report and the app’s forms level', () => {
    const request = sectionFormRequest(document(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' });

    expect(request).toEqual({ kind: 'section', type: 'CTL-IMP', section_id: 'tramos', item_id: 't1', key: 'ubicacion', report_id: body.id, forms: FORMS_LEVEL });
  });

  it('a new report has no report_id yet, and a photo rides with where and when it was taken', () => {
    const fresh = fieldDocumentOf({ ...body, id: null })!;

    expect(sectionFormRequest(fresh, { sectionId: 'general', itemId: null, key: 'general' })).not.toHaveProperty('report_id');
    expect(sectionFormRequest(document(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' }, { lat: -12.1, lng: -77, at: '2026-11-05T15:00:00.000Z' })).toMatchObject({ lat: -12.1, lng: -77, at: '2026-11-05T15:00:00.000Z' });
  });

  it('only a section with its own tool (the photos) needs the place', () => {
    expect(sectionNeedsPlace(document(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' })).toBe(true);
    expect(sectionNeedsPlace(document(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' })).toBe(false);
    expect(sectionNeedsPlace(document(), { sectionId: 'nope', itemId: null, key: 'nope' })).toBe(false);
  });

  it('publishing needs a report that exists', () => {
    expect(publishFormRequest(document())).toEqual({ kind: 'publish', report_id: body.id, forms: FORMS_LEVEL });
    expect(publishFormRequest(fieldDocumentOf({ ...body, id: null })!)).toBeNull();
  });
});

describe('reportFormActions', () => {
  const deps = () => {
    const calls: { start: TrackStart; request: unknown }[] = [];
    const placeNow = vi.fn(async () => ({ lat: -12.1, lng: -77, at: '2026-11-05T15:00:00.000Z' }));
    const actions = reportFormActions<{ ok: true }>({ placeNow, open: async (request) => ({ ok: true, request }) as unknown as { ok: true }, track: async (start, call) => { calls.push({ start, request: ((await call()) as unknown as { request: unknown }).request }); return true; } });
    return { calls, placeNow, actions };
  };

  it('opens a section titled by its tramo, reading the place only for the photos', async () => {
    const { calls, placeNow, actions } = deps();

    await actions.openSection(document(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' });
    await actions.openSection(document(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' });

    expect(placeNow).toHaveBeenCalledTimes(1);
    expect(calls[0].start).toEqual({ appName: 'Portal', command: '', action: 'Tramo 1 · Ubicación' });
    expect(calls[0].request).not.toHaveProperty('at');
    expect(calls[1].request).toMatchObject({ key: 'fotos', lat: -12.1, lng: -77, at: '2026-11-05T15:00:00.000Z' });
  });

  it('publishes only a report that exists', async () => {
    const { calls, actions } = deps();

    expect(await actions.openPublish(fieldDocumentOf({ ...body, id: null })!)).toBe(false);
    expect(await actions.openPublish(document())).toBe(true);
    expect(calls).toEqual([{ start: { appName: 'Portal', command: '', action: 'Publicar informe' }, request: { kind: 'publish', report_id: body.id, forms: FORMS_LEVEL } }]);
  });

  it('reportViewOf: the document once it came, and the open repeat', () => {
    expect(reportViewOf(null, null)).toEqual({ report: null, items: undefined });
    expect(reportViewOf({ ok: false, message: 'no' }, 'tramos').report).toBeNull();
    const view = reportViewOf({ ok: true, document: document() }, 'tramos');
    expect(view.items?.id).toBe('tramos');
    expect(reportViewOf({ ok: true, document: document() }, null).items).toBeUndefined();
  });
});

describe('readReportDraft', () => {
  it('reads the document, or the server’s message', () => {
    const read = readReportDraft({ document: body });

    expect(read.ok && read.document.id).toBe(body.id);
    expect(readReportDraft({ error: 'not_found', message: 'Ese servicio ya no está.' })).toEqual({ ok: false, message: 'Ese servicio ya no está.' });
  });

  it('a body it cannot draw, or none, is the generic failure', () => {
    expect(readReportDraft({ document: { id: 'x' } })).toEqual({ ok: false, message: 'No se pudo abrir el informe' });
    expect(readReportDraft(null)).toEqual({ ok: false, message: 'No se pudo abrir el informe' });
  });
});

describe('what the cards say', () => {
  it('a pill per state, and «Opcional» for an empty section nobody owes', () => {
    expect(sectionBadge('done', true)).toEqual({ label: 'Lista', tone: 'ok' });
    expect(sectionBadge('partial', true)).toEqual({ label: 'A medias', tone: 'warn' });
    expect(sectionBadge('empty', true)).toEqual({ label: 'Falta', tone: 'error' });
    expect(sectionBadge('empty', false)).toEqual({ label: 'Opcional', tone: 'neutral' });
    expect(sectionBadge('error', false)).toEqual({ label: 'Error', tone: 'error' });
    expect(STATUS_BADGE.draft.label).toBe('Borrador');
  });

  it('counts the sections and the tramos in words', () => {
    expect(progressLine({ done: 2, total: 4 })).toBe('2 de 4 secciones listas');
    expect(progressLine({ done: 1, total: 1 })).toBe('1 de 1 sección lista');
    expect(progressPercent({ done: 2, total: 3 })).toBe(67);
    expect(progressPercent({ done: 0, total: 0 })).toBe(0);
    expect(reportTypeLabel('CTL-IMP')).toBe('Control de imprimación');
    expect(reportTypeLabel('XYZ')).toBe('XYZ');
    expect(itemsLine(tramos())).toBe('1 tramo');
    expect(itemsLine({ ...tramos(), items: [] })).toBe('Sin tramos todavía');
    expect(itemsLine({ ...tramos(), items: [tramos().items[0], tramos().items[0]] })).toBe('2 tramos');
  });
});
