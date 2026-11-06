import { describe, expect, it } from 'vitest';
import { fieldDocumentOf, type FieldDocument, type RepeatItem, type RepeatSection } from './fieldDocument';
import { reportFormAnswer } from './reportSaves';
import { ARRIVED_LABEL, arrivalHourOf, dataSectionOf, isUnitsRepeat, photoSlotsOf, unitBadgeOf, unitCountsLine, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf } from './reportUnits';

/** The units of a control de pista as Portal lists them (06/11): rows by arrival, then the dispatches not here yet. */
const form = (name: string) => ({ type: 'object', properties: { [name]: { type: 'string', title: name } } });
const photoEntry = (kind: string) => ({ id: `foto-${kind}`, title: `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind, requireLocation: true });
const photo = (url: string) => ({ id: url, url: `https://x/${url}.jpg` });
const unit = (id: string, title: string, summary: string[], sections: unknown[]) => ({ id, title, summary, results: [], sections });
const body = {
  id: 'r1', type: 'CTL-PIS', title: 'Control de pista', status: 'draft',
  forms: { general: form('pedido'), unidad: form('horaLlegada'), fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: [], results: [], form: 'general', values: {} },
    {
      id: 'unidades', kind: 'repeat', results: [], title: 'Unidades', required: true, state: 'partial', summary: [], itemTitle: 'Unidad', addLabel: '', min: 1,
      template: [{ id: 'datos', title: 'Datos', required: true, form: 'unidad' }, photoEntry('ingreso'), photoEntry('temperatura'), photoEntry('vacia'), photoEntry('escantillon')],
      items: [
        unit('d1', 'Unidad 1 · QAP-101', ['Terminó 09:12', 'Guía G1 · 15 m³'], [{ id: 'datos', state: 'done', values: {} }, { id: 'foto-ingreso', state: 'done', values: { fotos: [photo('a')] } }, { id: 'foto-temperatura', state: 'done', values: { fotos: [photo('b')] } }, { id: 'foto-vacia', state: 'done', values: { fotos: [photo('c')] } }, { id: 'foto-escantillon', state: 'done', values: { fotos: [photo('d')] } }]),
        unit('d2', 'Unidad 2 · QAP-102', ['Guía G2 · 15 m³'], [{ id: 'datos', state: 'done', values: { horaLlegada: '07:30' } }, { id: 'foto-ingreso', state: 'empty', values: { fotos: [photo('e')] } }]),
        unit('d3', 'QAP-103', ['Salió 07:10 · 15 m³ · Guía G3'], []),
      ],
    },
  ],
  publish: { label: 'Publicar informe', missing: [] },
};
const units = (): RepeatSection => fieldDocumentOf(body)!.sections[1] as RepeatSection;
const itemOf = (id: string): RepeatItem => units().items.find((one) => one.id === id)!;

describe('the units of a control de pista', () => {
  it('is a repeat nobody adds to, with photos by kind; the tramos of an imprimación are not', () => {
    expect(isUnitsRepeat(units())).toBe(true);
    expect(isUnitsRepeat({ ...units(), canAdd: true })).toBe(false);
    expect(isUnitsRepeat({ ...units(), template: [units().template[0]!] })).toBe(false);
  });

  it('a unit left the plant, is working, or finished with its «vacía» photo, even before Portal marks the section done', () => {
    expect(unitStateOf(itemOf('d3'))).toBe('waiting');
    expect(unitStateOf(itemOf('d2'))).toBe('working');
    expect(unitStateOf(itemOf('d1'))).toBe('finished');
    const pending = { ...itemOf('d2'), sections: itemOf('d2').sections.map((one) => (one.id === 'foto-vacia' ? { ...one, values: { fotos: [photo('p')] } } : one)) };
    expect(unitStateOf(pending)).toBe('finished');
  });

  /** José 06/11, a pedido of 12: the arrival order depends on nothing, so the pending ones are only listed. */
  it('groups by what each one needs: on site, to tap when it arrives, at the plant, and finished', () => {
    // Arrange
    const atPlant = { ...itemOf('d3'), id: 'd4', title: 'QAP-104', summary: ['En planta'] };
    // Act
    const groups = unitGroupsOf({ ...units(), items: [...units().items, atPlant] });
    // Assert
    expect(groups.onSite.map((one) => one.id)).toEqual(['d2']);
    expect(groups.waiting.map((one) => one.id)).toEqual(['d3']);
    expect(groups.atPlant.map((one) => one.id)).toEqual(['d4']);
    expect(groups.finished.map((one) => one.id)).toEqual(['d1']);
    expect(ARRIVED_LABEL).toBe('Llegó');
  });

  it('a unit at the plant is not a unit to tap, and anything else stays as it was', () => {
    expect(unitStateOf({ ...itemOf('d3'), summary: ['En planta'] })).toBe('atPlant');
    expect(unitStateOf({ ...itemOf('d3'), summary: ['Salió 07:10 · En planta nueva'] })).toBe('waiting');
  });

  it('a unit ended by its «vacía» photo with another photo missing stays on site, where the person sees it', () => {
    // Arrange
    const missing = { ...itemOf('d1'), sections: itemOf('d1').sections.map((one) => (one.id === 'foto-escantillon' ? { ...one, state: 'empty' as const, values: {} } : one)) };
    // Act
    const groups = unitGroupsOf({ ...units(), items: [missing] });
    // Assert
    expect(unitStateOf(missing)).toBe('finished');
    expect(groups.onSite.map((one) => one.id)).toEqual(['d1']);
    expect(groups.finished).toEqual([]);
  });

  it('counts each group in one line, without the empty ones', () => {
    const [one, two] = [itemOf('d1'), itemOf('d2')];
    expect(unitCountsLine({ onSite: [one, two], waiting: [one], atPlant: [], finished: [one] })).toBe('2 en pista · 1 por llegar · 1 terminó');
    expect(unitCountsLine({ onSite: [], waiting: [], atPlant: [one], finished: [one, two] })).toBe('1 en planta · 2 terminaron');
    expect(unitCountsLine({ onSite: [], waiting: [], atPlant: [], finished: [] })).toBe('');
  });

  it('reads the kicker and the plate from the title, and the pill from the state or Portal\'s «Terminó»', () => {
    expect(unitTitleOf({ title: 'Unidad 1 · QAP-101' })).toEqual({ kicker: 'Unidad 1', plate: 'QAP-101' });
    expect(unitTitleOf({ title: 'QAP-103' })).toEqual({ kicker: null, plate: 'QAP-103' });
    expect(unitBadgeOf(itemOf('d1'))).toEqual({ label: 'Terminó 09:12', tone: 'ok' });
    expect(unitBadgeOf(itemOf('d2'))).toEqual({ label: 'En pista', tone: 'warn' });
    expect(unitBadgeOf(itemOf('d3'))).toEqual({ label: 'Por llegar', tone: 'neutral' });
    expect(unitBadgeOf({ ...itemOf('d1'), summary: [] })).toEqual({ label: 'Terminó', tone: 'ok' });
    expect(unitLineOf(itemOf('d1'))).toBe('Guía G1 · 15 m³');
  });

  it('one slot per photo kind in the template\'s order, with its last photo; the data section is the one without a tool', () => {
    const slots = photoSlotsOf(itemOf('d2'));
    expect(slots.map((slot) => [slot.section.photoKind, slot.done, slot.photo?.url ?? null])).toEqual([['ingreso', true, 'https://x/e.jpg'], ['temperatura', false, null], ['vacia', false, null], ['escantillon', false, null]]);
    expect(dataSectionOf(itemOf('d2'))?.id).toBe('datos');
    expect(photoSlotsOf(itemOf('d3'))).toHaveLength(4);
  });
});

/** E2E 06/11: «Llegó» tapped at 12:22 opened with 12:13, the hour of the last draft; with no signal it would be hours old. */
describe('the hour of «Llegó»', () => {
  const noon = new Date(2026, 10, 6, 12, 22).toISOString();
  const timeForm = { type: 'object', properties: { horaLlegada: { type: 'string', format: 'time', title: 'Hora de llegada' }, horaInicio: { type: 'string', format: 'time', title: 'Inicio' } }, required: ['horaLlegada'] };
  const waiting = (values: Record<string, string>): FieldDocument => {
    const [general, repeat] = body.sections;
    const items = [unit('d9', 'QAP-109', ['Salió 07:10'], [{ id: 'datos', state: 'empty', values }])];
    return fieldDocumentOf({ ...body, forms: { ...body.forms, unidad: timeForm }, sections: [general, { ...repeat, items }] })!;
  };
  const path = { sectionId: 'unidades', itemId: 'd9', key: 'datos' };
  const propertiesOf = (document: FieldDocument, hour?: string) => {
    const answer = reportFormAnswer(document, path, undefined, undefined, hour);
    return answer?.response.responseType === 'form' ? answer.response.form.schema.properties : undefined;
  };

  it('is the phone\'s clock for a unit with nothing written', () => {
    expect(arrivalHourOf(waiting({}), path, noon)).toBe('12:22');
  });

  it('pads the hour as the form reads it', () => {
    expect(arrivalHourOf(waiting({}), path, new Date(2026, 10, 6, 7, 5).toISOString())).toBe('07:05');
  });

  it('leaves alone a unit already on site, a photo and anything outside a unit', () => {
    expect(arrivalHourOf(fieldDocumentOf(body)!, { sectionId: 'unidades', itemId: 'd2', key: 'datos' }, noon)).toBeUndefined();
    expect(arrivalHourOf(fieldDocumentOf(body)!, { sectionId: 'unidades', itemId: 'd2', key: 'foto-ingreso' }, noon)).toBeUndefined();
    expect(arrivalHourOf(fieldDocumentOf(body)!, { sectionId: 'general', itemId: null, key: 'general' }, noon)).toBeUndefined();
  });

  it('fills only the required hour, and the optional ones stay to be chosen', () => {
    const properties = propertiesOf(waiting({}), '12:22');
    expect(properties?.horaLlegada).toMatchObject({ default: '12:22' });
    expect(properties?.horaInicio).not.toHaveProperty('default');
  });

  it('the hour the driver marked stays: Portal sends it and the clock does not replace it', () => {
    expect(propertiesOf(waiting({ horaLlegada: '11:58' }), '12:22')?.horaLlegada).toMatchObject({ default: '11:58' });
  });
});
