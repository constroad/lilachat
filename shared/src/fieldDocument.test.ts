import { describe, expect, it } from 'vitest';
import { applySavedSection, channelValuesOf, fieldDocumentOf, withoutGroupSend, nextSection, photoKindOf, progressOf, publishBlockers, requiresLocation, SECTION_TOOL, sectionFormOf, sectionsProgressOf, itemFormTitle, type RepeatSection } from './fieldDocument';

/** The document Portal's `informe_de_campo` answers (spec INFORMES-DESDE-LILACHAT §3.1), for a CTL-IMP with one tramo. */
const generalForm = { type: 'object', properties: { liquido: { type: 'string', title: 'Líquido', oneOf: [{ const: 'MC-30', title: 'MC-30' }, { const: 'EMULSION', title: 'Emulsión' }] }, proyecto: { type: 'string', title: 'Proyecto' } }, required: ['liquido', 'proyecto'] };
const ubicacionForm = { type: 'object', properties: { tramo: { type: 'string', title: 'Tramo' }, carril: { type: 'string', title: 'Carril' } }, required: ['tramo'] };
const bandejasForm = { type: 'object', properties: { pesoSin1: { type: 'number', title: 'Peso sin asfalto 1', 'x-unit': 'g' }, pesoCon1: { type: 'number', title: 'Peso con asfalto 1', 'x-unit': 'g' }, area1: { type: 'number', title: 'Área 1', 'x-unit': 'm²' } }, required: ['pesoSin1', 'pesoCon1', 'area1'] };
const firmasForm = { type: 'object', properties: { responsableNombre: { type: 'string', title: 'Responsable' } } };
const photosForm = { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción', maxLength: 200 } }, required: ['foto'] };

const body = {
  id: '6aed0a1b2c3d4e5f60718293', type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: generalForm, ubicacion: ubicacionForm, bandejas: bandejasForm, fotos: photosForm, firmas: firmasForm },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: ['Av. Los Incas · MC-30'], results: [], form: 'general', values: { liquido: 'MC-30', proyecto: 'Av. Los Incas' } },
    {
      id: 'tramos', title: 'Tramos', required: true, state: 'partial', summary: ['1 tramo'],
      repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }] },
      items: [{ id: 't1', title: 'Tramo 1', summary: ['Km 12+000 a 12+350'], results: [{ label: 'Tasa de riego', value: '1.02 lt/m²', tone: 'ok' }], sections: [{ id: 'ubicacion', state: 'done', values: { tramo: 'Km 12+000' } }, { id: 'bandejas', state: 'empty', values: {} }, { id: 'fotos', state: 'done', values: { fotos: [{ id: 'f1', url: 'https://lila.constroad.com/f/1.jpg' }] } }] }],
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
    expect(tramos.kind === 'repeat' && tramos.items[0].sections.map((section) => [section.title, section.form, section.state, section.tool ?? ''])).toEqual([['Ubicación', 'ubicacion', 'done', ''], ['Bandejas', 'bandejas', 'empty', ''], ['Fotos', 'fotos', 'done', 'agregar_foto_de_informe']]);
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
    expect(channelValuesOf(empty, { sectionId: 'general', itemId: null, key: 'general' })).toEqual({ proyecto: 'Av. Los Incas' });
  });

  it('a published report comes from Portal as «completed» and reads as published (Portal 05/11)', () => {
    expect(fieldDocumentOf({ ...body, status: 'completed' })?.status).toBe('published');
    expect(fieldDocumentOf({ ...body, status: 'published' })?.status).toBe('published');
  });

  it('reads the document as Portal really sends it (06/11): the repeat flat beside `kind`, no tramos yet, the rest off', () => {
    const portal = {
      id: null, type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
      forms: { general: generalForm, ubicacion: ubicacionForm, bandejas: bandejasForm, fotos: photosForm, firmas: firmasForm },
      sections: [
        { kind: 'form', id: 'general', title: 'Datos generales', form: 'general', required: true, enabled: true, state: 'partial', summary: ['Mejoramiento del Corredor Vial Pachacútec'], results: [], values: { proyecto: 'Mejoramiento del Corredor Vial Pachacútec' } },
        { kind: 'repeat', id: 'tramos', title: 'Tramos', template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe' }], items: [], min: 1, required: true, enabled: false, state: 'empty', summary: ['0 tramos'], itemTitle: 'Tramo', addLabel: 'Agregar tramo' },
        { kind: 'form', id: 'firmas', title: 'Responsables y firmas', form: 'firmas', required: false, enabled: false, state: 'empty', summary: [], results: [], values: {} },
      ],
      publish: { label: 'Publicar informe', missing: ['Faltan datos generales: cliente, proyecto, responsable, fecha.', 'Falta un tramo con sus 3 bandejas.', 'Falta al menos una foto.'] },
    };

    const document = fieldDocumentOf(portal)!;

    expect(document).not.toBeNull();
    const tramos = document.sections[1];
    expect(tramos.kind === 'repeat' && [tramos.itemTitle, tramos.addLabel, tramos.min, tramos.enabled, tramos.template.length, tramos.template[2].tool]).toEqual(['Tramo', 'Agregar tramo', 1, false, 3, 'agregar_foto_de_informe']);
    expect(progressOf(document)).toEqual({ done: 0, total: 3 });
    expect(nextSection(document)).toEqual({ sectionId: 'general', itemId: null, key: 'general' });
    expect(document.publish.missing).toHaveLength(3);
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

describe('what the channel already knows (José, 06/11)', () => {
  const generalPath = { sectionId: 'general', itemId: null, key: 'general' };
  const channelForm = { type: 'object', properties: { liquido: { type: 'string', title: 'Líquido' }, cliente: { type: 'string', title: 'Cliente' }, proyecto: { type: 'string', title: 'Proyecto' }, responsable: { type: 'string', title: 'Responsable' } }, required: ['liquido', 'cliente', 'proyecto', 'responsable'] };
  const channelDocument = (values: Record<string, string>) => fieldDocumentOf({ ...body, forms: { ...body.forms, general: channelForm }, sections: [{ ...body.sections[0], values }, ...body.sections.slice(1)] })!;

  it('the form does not ask for the client nor the project, and does not require them', () => {
    const form = sectionFormOf(channelDocument({ cliente: 'Consorcio Vial', proyecto: 'Corredor Pachacútec' }), generalPath)!;
    expect(Object.keys(form.schema.properties ?? {})).toEqual(['liquido', 'responsable']);
    expect(form.schema.required).toEqual(['liquido', 'responsable']);
  });

  it('their values stay apart, to ride with the answers: Portal blanks what a saved section leaves out', () => {
    expect(channelValuesOf(channelDocument({ cliente: 'Consorcio Vial', proyecto: 'Corredor Pachacútec', responsable: 'Ana' }), generalPath)).toEqual({ cliente: 'Consorcio Vial', proyecto: 'Corredor Pachacútec' });
  });

  it('a value Portal does not have is not invented, and another section has none', () => {
    expect(channelValuesOf(channelDocument({ cliente: 'Consorcio Vial', proyecto: '' }), generalPath)).toEqual({ cliente: 'Consorcio Vial' });
    expect(channelValuesOf(channelDocument({}), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' })).toEqual({});
  });
});

describe('sectionFormOf', () => {
  /** Audit 12/11: a section said «Enviar» although it only keeps a part of the draft. */
  it('saves with «Guardar», and a photo with «Guardar foto»', () => {
    expect(sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' })?.submitLabel).toBe('Guardar');
    expect(sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' })?.submitLabel).toBe('Guardar foto');
  });

  it('is the section tool with the saved values as defaults, titled by its tramo', () => {
    const form = sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' })!;

    expect(form.id).toBe(SECTION_TOOL);
    expect(form.title).toBe('Tramo 1 · Ubicación');
    expect(form.schema.properties?.tramo).toMatchObject({ title: 'Tramo', default: 'Km 12+000' });
    expect(form.schema.properties?.carril).not.toHaveProperty('default');
    expect(form.schema.required).toEqual(['tramo']);
  });

  it('the photos open with their own tool, one photo at a time', () => {
    const form = sectionFormOf(parsed(), { sectionId: 'tramos', itemId: 't1', key: 'fotos' })!;

    expect(form.id).toBe('agregar_foto_de_informe');
    expect(form.schema.properties?.foto).not.toHaveProperty('default');
  });

  it('a section named like its item is not said twice (E2E 12/11: «Punto · Punto»)', () => {
    expect(itemFormTitle('Punto', 'Punto')).toBe('Punto');
    expect(itemFormTitle('Punto 1', 'Punto')).toBe('Punto 1');
    expect(itemFormTitle('Tramo 1', 'Ubicación')).toBe('Tramo 1 · Ubicación');
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

describe('publishBlockers', () => {
  it('publishing waits for Portal\'s missing list, for the queue and for the signal', () => {
    expect(publishBlockers(parsed(), [])).toEqual(['Falta una foto en Tramo 1']);
    expect(publishBlockers(parsed(), ['a save'])).toEqual(['Falta una foto en Tramo 1', 'Hay cambios sin enviar.']);
    expect(publishBlockers(parsed(), [], true)).toEqual(['Falta una foto en Tramo 1', 'Publicar necesita señal.']);
  });
});

describe('a control de pista (contract 06/11): the units come from the dispatches, four photos with their place', () => {
  const unidadForm = { type: 'object', properties: { horaLlegada: { type: 'string', title: 'Hora de llegada', format: 'time' }, tempLlegada: { type: 'number', title: 'Temp. de llegada', 'x-unit': '°C' }, escantillonCm: { type: 'number', title: 'Escantillón', 'x-unit': 'cm' } }, required: ['horaLlegada', 'tempLlegada', 'escantillonCm'] };
  const photoEntry = (kind: string) => ({ id: `foto-${kind}`, title: `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind, requireLocation: true });
  const unitsOf = (items: unknown[], extra: Record<string, unknown>) => ({
    id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'empty', summary: [], itemTitle: 'Unidad', addLabel: '', canAdd: false, min: 1, page: { current: 2, total: 3 },
    template: [{ id: 'datos', title: 'Datos', required: true, form: 'unidad' }, photoEntry('ingreso'), photoEntry('temperatura'), photoEntry('vacia'), photoEntry('escantillon')],
    items, ...extra,
  });
  const pista = (items: unknown[] = [], extra: Record<string, unknown> = {}) => fieldDocumentOf({
    id: null, type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
    forms: { general: generalForm, unidad: unidadForm, fotos: photosForm },
    sections: [{ ...body.sections[0], values: {} }, unitsOf(items, extra)],
    publish: { label: 'Publicar informe', missing: ['Falta una unidad'], warnings: ['2 despachos del pedido sin fila'] },
  })!;
  const units = (document: ReturnType<typeof pista>) => document.sections[1] as RepeatSection;
  const dispatch = { id: 'd1', title: 'QAP-103', summary: ['Salió 07:10 · 15 m³'], results: [], sections: [] };
  const photoPath = { sectionId: 'unidades', itemId: 'd1', key: 'foto-ingreso' };

  it('reads the page, that nobody adds a unit, the kind and the place each photo asks for, and the warnings', () => {
    const document = pista([dispatch]);

    expect(units(document)).toMatchObject({ canAdd: false, page: { current: 2, total: 3 }, items: [{ id: 'd1', title: 'QAP-103' }] });
    expect(units(document).template[1]).toEqual({ id: 'foto-ingreso', title: 'Foto de ingreso', required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: 'ingreso', requireLocation: true });
    expect(document.publish).toEqual({ label: 'Publicar informe', missing: ['Falta una unidad'], warnings: ['2 despachos del pedido sin fila'] });
    expect(photoKindOf(document, photoPath)).toBe('ingreso');
    expect(photoKindOf(document, { ...photoPath, key: 'datos' })).toBeUndefined();
    expect(requiresLocation(document, photoPath)).toBe(true);
    expect(requiresLocation(document, { ...photoPath, itemId: null })).toBe(true);
    expect(requiresLocation(document, { ...photoPath, key: 'datos' })).toBe(false);
  });

  it('the repeat keeps the results Portal computed over all the units (Carros, Volumen, Terminadas)', () => {
    const results = [{ label: 'Carros', value: '4', tone: 'neutral' }, { label: 'Terminadas', value: '1', tone: 'ok' }];
    expect(units(pista([], { results })).results).toEqual(results);
    expect(units(pista([], {})).results).toEqual([]);
  });

  it('a repeat adds by default; an empty «Agregar» or `canAdd: false` takes the button away, and a bad page is no page', () => {
    expect(units(parsed()).canAdd).toBe(true);
    expect(parsed().publish.warnings).toEqual([]);
    expect(units(pista([], { canAdd: undefined, addLabel: '' })).canAdd).toBe(false);
    expect(units(pista([], { canAdd: false, addLabel: 'Agregar' })).canAdd).toBe(false);
    expect(units(pista([], { canAdd: undefined, addLabel: 'Agregar' })).canAdd).toBe(true);
    expect(units(pista([], { page: { current: 0, total: 3 } })).page).toBeUndefined();
    expect(units(pista([], { page: { current: 4, total: 3 } })).page).toBeUndefined();
  });

  /** Audit 12/11 on the APK: «1 de 28 secciones listas» with six cards on screen, because each of five units counted its five parts. */
  it('the line counts the cards a person sees, not the parts of every unit', () => {
    // Arrange
    const units5 = [1, 2, 3, 4, 5].map((n) => ({ ...dispatch, id: `d${n}` }));
    // Act
    const progress = sectionsProgressOf(pista(units5));
    // Assert
    expect(progressOf(pista(units5)).total).toBe(26);
    expect(progress).toEqual({ done: 1, total: 2 });
    expect(sectionsProgressOf(pista(units5, { state: 'done' }))).toEqual({ done: 2, total: 2 });
  });

  /** A unit with no plate yet came as «Unidad 1 · » and the form said «Unidad 1 · · Datos» (audit 12/11). */
  it('a title that ends in its separator loses it', () => {
    const document = pista([{ ...dispatch, title: 'Unidad 1 · ' }, { ...dispatch, id: 'd2', title: ' · QAP-103' }]);
    expect(units(document).items.map((item) => item.title)).toEqual(['Unidad 1', 'QAP-103']);
    expect(sectionFormOf(document, { sectionId: 'unidades', itemId: 'd1', key: 'datos' })?.title).toBe('Unidad 1 · Datos');
  });

  it('with no unit yet nobody owes the first one: the units come from the dispatches, not from «Agregar»', () => {
    const empty = pista([]);
    expect(progressOf(empty)).toEqual({ done: 1, total: 1 });
    expect(nextSection(empty)).toBeNull();
    expect(progressOf(pista([dispatch]))).toEqual({ done: 1, total: 6 });
    expect(nextSection(pista([dispatch]))).toEqual({ sectionId: 'unidades', itemId: 'd1', key: 'datos' });
  });
});

describe('withoutGroupSend (José 12/11: «lo de enviar por whatsapp solo admins en lilachat»)', () => {
  const withSend = () => fieldDocumentOf({ ...body, forms: { ...body.forms, fotos: { ...photosForm, properties: { ...photosForm.properties, enviarAlGrupo: { type: 'boolean', title: 'Enviar al grupo', default: false } }, required: ['foto', 'enviarAlGrupo'] } } })!;

  it('a member does not see «Enviar al grupo»; the rest of the photo form stays', () => {
    const form = withoutGroupSend(withSend(), false).forms.fotos!;

    expect(Object.keys(form.properties ?? {})).toEqual(['foto', 'descripcion']);
    expect(form.required).toEqual(['foto']);
  });

  it('an admin keeps it, and a document without it is left as it was', () => {
    expect(withoutGroupSend(withSend(), true).forms.fotos!.properties).toHaveProperty('enviarAlGrupo');
    const plain = parsed();
    expect(withoutGroupSend(plain, false)).toEqual(plain);
  });
});

/**
 * Portal d85a6e57: «Agregar tramo» brings `repeat.nextValues: { progresivaDesde }` with the end of
 * the last tramo. The new tramo's form opens with it written; the person can change it.
 */
describe('a new tramo opens where the last one ended', () => {
  const withNext = (nextValues: unknown) => {
    const ubicacion = { type: 'object', properties: { progresivaDesde: { type: 'string', title: 'Desde' }, progresivaHasta: { type: 'string', title: 'Hasta' } } };
    const tramos = { ...body.sections[1], repeat: { ...body.sections[1].repeat, nextValues } };
    return fieldDocumentOf({ ...body, forms: { ...body.forms, ubicacion }, sections: [body.sections[0], tramos, body.sections[2]] })!;
  };
  const newTramo = { sectionId: 'tramos', key: 'ubicacion', itemId: null };

  it('fills the new tramo with the values Portal sent, only in the section that has those fields', () => {
    // Arrange
    const document = withNext({ progresivaDesde: '12+350' });
    // Act
    const form = sectionFormOf(document, newTramo);
    const bandejas = sectionFormOf(document, { ...newTramo, key: 'bandejas' });
    // Assert
    expect(form?.schema.properties?.progresivaDesde?.default).toBe('12+350');
    expect(form?.schema.properties?.progresivaHasta?.default).toBeUndefined();
    expect(Object.values(bandejas?.schema.properties ?? {}).some((one) => one.default === '12+350')).toBe(false);
  });

  it('leaves an existing tramo as it was saved, and ignores what is not a plain value', () => {
    // Arrange
    const document = withNext({ progresivaDesde: { km: 12 }, tramo: 'x'.repeat(500) });
    // Act
    const fresh = sectionFormOf(document, newTramo);
    const saved = sectionFormOf(withNext({ progresivaDesde: '12+350' }), { ...newTramo, itemId: 't1' });
    // Assert
    expect(fresh?.schema.properties?.progresivaDesde?.default).toBeUndefined();
    expect(saved?.schema.properties?.progresivaDesde?.default).toBeUndefined();
  });
});
