import { describe, expect, it } from 'vitest';
import { FORMS_LEVEL } from './appForms';
import { isFieldReport } from './clientAccess';
import { fieldDocumentOf } from './fieldDocument';
import { locationMapLink } from './sharedLocation';
import { draftToContinue, itemsLine, removePhotoRequest, pageLine, placeFieldValue, progressLine, progressPercent, publishFormRequest, readObservationDraft, readReportDraft, REPORT_TYPE_OPTIONS, reportDraftPath, reportDraftRequest, openPublishForm, reportFormsPath, reportTypeLabel, reportViewOf, sectionBadge, sectionFormRequest, staleAnswerIds, STATUS_BADGE, type TrackStart } from './reportCreation';

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
  it('offers the eight types of the public page, and CTL-IMP and CTL-PIS open here', () => {
    expect(REPORT_TYPE_OPTIONS).toHaveLength(9);
    expect(REPORT_TYPE_OPTIONS.filter((option) => option.opensHere).map((option) => option.code)).toEqual(['CTL-IMP', 'CTL-PIS']);
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

  it('publishing needs a report that exists', () => {
    expect(publishFormRequest(document())).toEqual({ kind: 'publish', report_id: body.id, forms: FORMS_LEVEL });
    expect(publishFormRequest(fieldDocumentOf({ ...body, id: null })!)).toBeNull();
  });
});

describe('placeFieldValue', () => {
  const NOW = '2026-11-06T10:00:00.000Z';

  it('is the link to the map of where the device is', () => {
    expect(placeFieldValue({ lat: -12.0464, lng: -77.0428, at: NOW })).toBe(locationMapLink({ lat: -12.0464, lng: -77.0428 }));
  });

  it('without a position there is nothing to write', () => {
    expect(placeFieldValue({ at: NOW })).toBeNull();
    expect(placeFieldValue({ lat: 0, at: NOW })).toBeNull();
  });

  it('the equator and the Greenwich meridian are places', () => {
    expect(placeFieldValue({ lat: 0, lng: 0, at: NOW })).toBe(locationMapLink({ lat: 0, lng: 0 }));
  });
});

describe('openPublishForm', () => {
  it('publishes only a report that exists, titled by the action', async () => {
    const calls: { start: TrackStart; request: unknown }[] = [];
    const deps = { open: async (request: unknown) => ({ ok: true, request }), track: async (start: TrackStart, call: () => Promise<{ ok: boolean; request: unknown }>) => { calls.push({ start, request: (await call()).request }); return true; } };
    expect(await openPublishForm(deps, document())).toBe(true);
    expect(calls[0]).toEqual({ start: { appName: 'Portal', command: '', action: 'Publicar informe' }, request: { kind: 'publish', report_id: document().id, forms: FORMS_LEVEL } });
    expect(await openPublishForm(deps, { ...document(), id: null })).toBe(false);
    expect(calls).toHaveLength(1);
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
  it('what waits in the queue says so, and a refused one is an error', () => {
    expect(sectionBadge('partial', true, 'k1').label).toBe('Pendiente de enviar');
    expect(sectionBadge('error', true, 'k1').label).toBe('Error');
  });

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
    expect(itemsLine({ ...tramos(), itemTitle: 'Unidad', items: [] })).toBe('Sin unidades todavía');
    expect(itemsLine({ ...tramos(), itemTitle: 'Unidad', items: [tramos().items[0]!, tramos().items[0]!] })).toBe('2 unidades');
    expect(itemsLine({ ...tramos(), items: [tramos().items[0], tramos().items[0]] })).toBe('2 tramos');
  });
});

describe('staleAnswerIds', () => {
  const answer = (commandId: string, state: 'pending' | 'answered' | 'failed' | 'form') => ({ commandId, state });

  it('keeps the newest answer and names the answered ones before it', () => {
    expect(staleAnswerIds([answer('a', 'answered'), answer('b', 'answered'), answer('c', 'answered')])).toEqual(['a', 'b']);
  });

  it('an answer still running or refused stays on screen, even if older', () => {
    expect(staleAnswerIds([answer('a', 'pending'), answer('b', 'failed'), answer('c', 'form'), answer('d', 'answered')])).toEqual([]);
  });

  it('nothing to clear with one answer or none', () => {
    expect(staleAnswerIds([answer('a', 'answered')])).toEqual([]);
    expect(staleAnswerIds([])).toEqual([]);
  });
});

describe('the units of a control de pista (06/11)', () => {
  it('asks a page of units past the first, and says which page is on screen', () => {
    expect(reportDraftRequest('CTL-PIS', null, 1)).toEqual({ type: 'CTL-PIS' });
    expect(reportDraftRequest('CTL-PIS', body.id, 2)).toEqual({ type: 'CTL-PIS', report_id: body.id, page: 2 });
    expect(pageLine({ ...tramos(), page: { current: 2, total: 3 } })).toBe('Página 2 de 3');
    expect(pageLine({ ...tramos(), page: { current: 1, total: 1 } })).toBeNull();
    expect(pageLine(tramos())).toBeNull();
  });

  it('the photo\'s own key rides when its section opens: Portal tells a photo sent twice from a second one', () => {
    const place = { lat: -12, lng: -77, at: '2026-11-06T12:00:00.000Z' };
    expect(sectionFormRequest(document(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' }, place, 'k1')).toMatchObject({ client_key: 'k1', lat: -12, lng: -77 });
    expect(sectionFormRequest(document(), { sectionId: 'general', itemId: null, key: 'general' })).not.toHaveProperty('client_key');
  });

  it('CTL-PIS says what it asks per truck, and opens here since Portal shipped it (06/11)', () => {
    expect(REPORT_TYPE_OPTIONS.find((option) => option.code === 'CTL-PIS')).toMatchObject({ caption: 'Llegada, temperaturas, escantillón y 4 fotos por volquete', opensHere: true });
  });
});

describe('draftToContinue (José 06/11: a draft row opened «Ver el PDF» and nothing else)', () => {
  const draft = { id: 'r1', title: 'Control de imprimación', date: '2026-11-06', status: { label: 'Borrador', tone: 'neutral' as const } };

  it('a draft of a type filled here reopens its document', () => {
    expect(draftToContinue({ reports: [draft] }, 'r1')).toEqual({ type: 'CTL-IMP', reportId: 'r1' });
  });

  it('it reads the type from the label when the title is another', () => {
    expect(draftToContinue({ reports: [{ ...draft, title: 'Tramo norte', typeLabel: 'Control de pista' }] }, 'r1')).toEqual({ type: 'CTL-PIS', reportId: 'r1' });
  });

  it('a published report keeps its sheet', () => {
    expect(draftToContinue({ reports: [{ ...draft, status: { label: 'Completado', tone: 'ok' as const } }] }, 'r1')).toBeNull();
  });

  it('a type that lives in Portal keeps its sheet, and an unknown row opens nothing', () => {
    expect(draftToContinue({ reports: [{ ...draft, title: 'Acta de conformidad' }] }, 'r1')).toBeNull();
    expect(draftToContinue({ reports: [draft] }, 'r9')).toBeNull();
  });
});

describe('removePhotoRequest', () => {
  it('names the report and the photo, and what this app can draw', () => {
    expect(removePhotoRequest('r1', 'f1')).toEqual({ kind: 'remove_photo', report_id: 'r1', photo_id: 'f1', forms: FORMS_LEVEL });
  });
});

describe('readObservationDraft', () => {
  it('reads Portal\'s observation document, and says why when there is none', () => {
    const document = { id: 'r1', type: 'REG-OBS', title: 'Registro', status: 'draft', forms: {}, sections: [{ id: 'observaciones', items: [] }], map: { streets: [] }, publish: { label: 'Publicar', missing: [] } };
    expect(readObservationDraft({ document })).toEqual({ ok: true, document: expect.objectContaining({ id: 'r1', observations: [] }) });
    expect(readObservationDraft({ error: 'x', message: 'Esa herramienta no está aprobada' })).toEqual({ ok: false, message: 'Esa herramienta no está aprobada' });
    expect(readObservationDraft(null)).toEqual({ ok: false, message: 'No se pudo abrir el informe' });
  });

  it('the registry is a field report a restricted member may see', () => {
    expect(isFieldReport({ typeLabel: 'Registro de observaciones' })).toBe(true);
  });
});
