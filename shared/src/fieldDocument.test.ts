import { describe, expect, it } from 'vitest';
import { afterSave, applySavedSection, fieldDocumentOf, nextSection, nextSave, progressOf, publishBlockers, queueSave, SECTION_TOOL, sectionFormOf, type PendingSave } from './fieldDocument';

/** The document Portal's `informe_de_campo` answers (spec INFORMES-DESDE-LILACHAT §3.1), for a CTL-IMP with one tramo. */
const generalForm = { type: 'object', properties: { liquido: { type: 'string', title: 'Líquido', oneOf: [{ const: 'MC-30', title: 'MC-30' }, { const: 'EMULSION', title: 'Emulsión' }] }, proyecto: { type: 'string', title: 'Proyecto' } }, required: ['liquido', 'proyecto'] };
const ubicacionForm = { type: 'object', properties: { tramo: { type: 'string', title: 'Tramo' }, carril: { type: 'string', title: 'Carril' } }, required: ['tramo'] };
const bandejasForm = { type: 'object', properties: { pesoSin1: { type: 'number', title: 'Peso sin asfalto 1', 'x-unit': 'g' }, pesoCon1: { type: 'number', title: 'Peso con asfalto 1', 'x-unit': 'g' }, area1: { type: 'number', title: 'Área 1', 'x-unit': 'm²' } }, required: ['pesoSin1', 'pesoCon1', 'area1'] };
const firmasForm = { type: 'object', properties: { responsableNombre: { type: 'string', title: 'Responsable' } } };

const body = {
  id: '6aed0a1b2c3d4e5f60718293', type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: generalForm, ubicacion: ubicacionForm, bandejas: bandejasForm, firmas: firmasForm },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: ['Av. Los Incas · MC-30'], results: [], form: 'general', values: { liquido: 'MC-30', proyecto: 'Av. Los Incas' } },
    {
      id: 'tramos', title: 'Tramos', required: true, state: 'partial', summary: ['1 tramo'],
      repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }] },
      items: [{ id: 't1', title: 'Tramo 1', summary: ['Km 12+000 a 12+350'], results: [{ label: 'Tasa de riego', value: '1.02 lt/m²', tone: 'ok' }], sections: [{ id: 'ubicacion', state: 'done', values: { tramo: 'Km 12+000' } }, { id: 'bandejas', state: 'empty', values: {} }] }],
    },
    { id: 'firmas', title: 'Responsables y firmas', required: false, state: 'empty', summary: [], results: [], form: 'firmas', values: {} },
  ],
  publish: { label: 'Publicar informe', missing: ['Falta una foto en Tramo 1'] },
};

const parsed = () => fieldDocumentOf(body)!;

describe('fieldDocumentOf', () => {
  it('reads the document, and a tramo takes titles and forms from the template', () => {
    const document = parsed();

    expect(document.id).toBe(body.id);
    expect(document.sections.map((section) => section.id)).toEqual(['general', 'tramos', 'firmas']);
    const tramos = document.sections[1];
    expect(tramos.kind === 'repeat' && tramos.items[0].sections.map((section) => [section.title, section.form, section.state])).toEqual([['Ubicación', 'ubicacion', 'done'], ['Bandejas', 'bandejas', 'empty']]);
    expect(tramos.kind === 'repeat' && tramos.items[0].results[0]).toEqual({ label: 'Tasa de riego', value: '1.02 lt/m²', tone: 'ok' });
  });

  it('refuses a section whose form is missing, and a form the engine cannot draw', () => {
    expect(fieldDocumentOf({ ...body, sections: [{ ...body.sections[0], form: 'nope' }] })).toBeNull();
    const tooWide = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`f${index}`, { type: 'string', title: `Campo ${index}` }]));
    expect(fieldDocumentOf({ ...body, forms: { ...body.forms, general: { type: 'object', properties: tooWide } } })).toBeNull();
  });

  it('a document not created yet has a null id and only «general» enabled', () => {
    const empty = fieldDocumentOf({ ...body, id: null, sections: [{ ...body.sections[0], state: 'empty', values: { proyecto: 'Av. Los Incas' } }, { ...body.sections[1], enabled: false, items: [] }, { ...body.sections[2], enabled: false }] })!;

    expect(empty.id).toBeNull();
    expect(empty.sections.map((section) => section.enabled)).toEqual([true, false, false]);
    expect(nextSection(empty)).toEqual({ sectionId: 'general', itemId: null, key: 'general' });
    expect(sectionFormOf(empty, { sectionId: 'general', itemId: null, key: 'general' })?.schema.properties?.proyecto).toMatchObject({ default: 'Av. Los Incas' });
  });

  it('refuses what is not a document', () => {
    expect(fieldDocumentOf(null)).toBeNull();
    expect(fieldDocumentOf({ id: 'x' })).toBeNull();
    expect(fieldDocumentOf({ ...body, status: 'weird' })).toBeNull();
  });
});

describe('progress and what comes next', () => {
  it('counts the required sections, inside each tramo too', () => {
    expect(progressOf(parsed())).toEqual({ done: 2, total: 3 });
  });

  it('a repeat without tramos still owes its first tramo', () => {
    const document = fieldDocumentOf({ ...body, sections: [body.sections[0], { ...body.sections[1], items: [] }, body.sections[2]] })!;

    expect(progressOf(document)).toEqual({ done: 1, total: 3 });
    expect(nextSection(document)).toEqual({ sectionId: 'tramos', itemId: null, key: 'ubicacion' });
  });

  it('points at the first required section not done, and at nothing when all are', () => {
    expect(nextSection(parsed())).toEqual({ sectionId: 'tramos', itemId: 't1', key: 'bandejas' });
    const done = applySavedSection(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'bandejas' }, { pesoSin1: 1, pesoCon1: 2, area1: 3 }, 'k1');
    const allDone = { ...done, sections: done.sections.map((section) => (section.kind === 'repeat' ? { ...section, items: section.items.map((item) => ({ ...item, sections: item.sections.map((one) => ({ ...one, state: 'done' as const })) })) } : section)) };
    expect(nextSection(allDone)).toBeNull();
  });
});

describe('sectionFormOf', () => {
  it('is the section tool with the saved values as defaults, titled by its tramo', () => {
    const form = sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' })!;

    expect(form.id).toBe(SECTION_TOOL);
    expect(form.title).toBe('Tramo 1 · Ubicación');
    expect(form.schema.properties?.tramo).toMatchObject({ title: 'Tramo', default: 'Km 12+000' });
    expect(form.schema.properties?.carril).not.toHaveProperty('default');
    expect(form.schema.required).toEqual(['tramo']);
  });

  it('a new tramo opens its first section empty', () => {
    const form = sectionFormOf(parsed(), { sectionId: 'tramos', itemId: null, key: 'ubicacion' })!;

    expect(form.title).toBe('Tramo · Ubicación');
    expect(form.schema.properties?.tramo).not.toHaveProperty('default');
  });

  it('is null for a path the document does not have', () => {
    expect(sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't9', key: 'bandejas' })).toBeNull();
    expect(sectionFormOf(parsed(), { sectionId: 'general', itemId: null, key: 'bandejas' })).toBeNull();
  });
});

describe('applySavedSection', () => {
  it('keeps the values on the phone before Portal answers, marked as pending', () => {
    const document = applySavedSection(parsed(), { sectionId: 'general', itemId: null, key: 'general' }, { liquido: 'EMULSION', proyecto: 'Av. Los Incas' }, 'k-general');
    const general = document.sections[0];

    expect(general.kind === 'form' && general.values).toEqual({ liquido: 'EMULSION', proyecto: 'Av. Los Incas' });
    expect(general.kind === 'form' && general.pending).toBe('k-general');
    expect(general.kind === 'form' && general.state).toBe('partial');
  });

  it('leaves the document alone for a path it does not have', () => {
    const document = parsed();

    expect(applySavedSection(document, { sectionId: 'tramos', itemId: 't9', key: 'bandejas' }, { pesoSin1: 1 }, 'k')).toBe(document);
  });
});

describe('the queue of saves', () => {
  const save = (key: string, clientKey: string, values = {}): PendingSave => ({ path: { sectionId: 'tramos', itemId: 't1', key }, values, clientKey });

  it('keeps one save per section, the newest, in the order they first came', () => {
    const queue = queueSave(queueSave(queueSave([], save('ubicacion', 'a')), save('bandejas', 'b')), save('ubicacion', 'c', { tramo: 'Km 13' }));

    expect(queue.map((one) => [one.path.key, one.clientKey])).toEqual([['ubicacion', 'c'], ['bandejas', 'b']]);
    expect(nextSave(queue)?.values).toEqual({ tramo: 'Km 13' });
    expect(nextSave([])).toBeNull();
  });

  it('decides after each answer: confirm, retry, drop or flush', () => {
    expect(afterSave(200)).toBe('confirm');
    expect(afterSave(409)).toBe('confirm');
    expect(afterSave(null)).toBe('retry');
    expect(afterSave(503)).toBe('retry');
    expect(afterSave(422)).toBe('drop');
    expect(afterSave(404)).toBe('drop');
    expect(afterSave(401)).toBe('flush');
  });

  it('publishing waits for Portal\'s missing list and for the queue', () => {
    expect(publishBlockers(parsed(), [])).toEqual(['Falta una foto en Tramo 1']);
    expect(publishBlockers(parsed(), [save('bandejas', 'b')])).toEqual(['Falta una foto en Tramo 1', 'Hay cambios sin enviar.']);
  });
});
