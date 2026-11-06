import { describe, expect, it } from 'vitest';
import { fieldDocumentOf, type RepeatItem, type RepeatSection } from './fieldDocument';
import { ARRIVED_LABEL, dataSectionOf, isUnitsRepeat, photoSlotsOf, unitBadgeOf, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf } from './reportUnits';

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

  it('groups the ones to tap when they arrive apart from the ones on site, the working ones first', () => {
    const groups = unitGroupsOf(units());
    expect(groups.waiting.map((one) => one.id)).toEqual(['d3']);
    expect(groups.arrived.map((one) => one.id)).toEqual(['d2', 'd1']);
    expect(ARRIVED_LABEL).toBe('Llegó');
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
