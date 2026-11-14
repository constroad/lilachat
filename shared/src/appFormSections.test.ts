import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { groupedBySection, isBlankAnswer, sectionHasBlankRequired, sectionHasError, sectionOf, sectionSlug } from './appFormSections.js';

const formWith = (properties: Record<string, FormSchemaProperty>, required: string[] = []): AppForm => ({ id: 'f', title: 'F', schema: { type: 'object', properties, required } });

/** agentes' «Revisar gasto» (13/11): the steps, then «Corregir datos» folded. */
const expense = formWith(
  {
    destino: { type: 'string', title: 'Destino', enum: ['P:1', 'S:2'] },
    monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', 'x-section': 'Corregir datos', 'x-collapsed': true },
    fecha: { type: 'string', format: 'date', title: 'Fecha', 'x-section': 'Corregir datos', 'x-collapsed': true },
    nota: { type: 'string', title: 'Nota', 'x-section': 'Corregir datos', 'x-collapsed': true },
  },
  ['destino', 'monto']
);

describe('sectionOf: `x-section` and `x-collapsed` on a field (agentes 13/11)', () => {
  it('reads the header and whether it starts folded', () => {
    expect(sectionOf({ 'x-section': 'Corregir datos', 'x-collapsed': true })).toEqual({ section: { label: 'Corregir datos', collapsed: true } });
    expect(sectionOf({ 'x-section': 'Más' })).toEqual({ section: { label: 'Más', collapsed: false } });
  });

  it('cleans the header and cuts it to 40 characters', () => {
    expect(sectionOf({ 'x-section': '  Corregir   datos  ' }).section?.label).toBe('Corregir datos');
    expect(sectionOf({ 'x-section': 'x'.repeat(60) }).section?.label).toHaveLength(40);
  });

  it('no header, an empty one or one that is not text: the field is not in a section', () => {
    expect(sectionOf({})).toEqual({});
    expect(sectionOf({ 'x-section': '   ' })).toEqual({});
    expect(sectionOf({ 'x-section': 4 })).toEqual({});
    expect(sectionOf({ 'x-collapsed': true })).toEqual({});
  });

  it('formFields carries it on every kind of field', () => {
    const fields = formFields(expense);
    expect(fields.map((field) => field.section?.label)).toEqual([undefined, 'Corregir datos', 'Corregir datos', 'Corregir datos']);
    expect(fields[1]!.section?.collapsed).toBe(true);
  });
});

describe('groupedBySection: the fields beside each other with the same header share one block', () => {
  const fields = formFields(expense);
  const names = (block: { fields: { name: string }[] }) => block.fields.map((field) => field.name).join(',');

  it('the plain field first, then the three under the header, in order', () => {
    const blocks = groupedBySection(fields);
    expect(blocks.map((block) => `${block.kind}:${block.kind === 'section' ? `${block.label}:` : ''}${names(block)}`)).toEqual(['plain:destino', 'section:Corregir datos:monto,fecha,nota']);
    expect(blocks[1]).toMatchObject({ kind: 'section', collapsed: true });
  });

  it('a section starts open when one of its fields does not ask to be folded', () => {
    const mixed = formFields(formWith({ a: { type: 'string', 'x-section': 'S', 'x-collapsed': true }, b: { type: 'string', 'x-section': 'S' } }));
    expect(groupedBySection(mixed)[0]).toMatchObject({ kind: 'section', collapsed: false });
  });

  it('the same header after another field is a second block, not a merge', () => {
    const split = formFields(formWith({ a: { type: 'string', 'x-section': 'S' }, b: { type: 'string' }, c: { type: 'string', 'x-section': 'S' } }));
    expect(groupedBySection(split).map((block) => block.kind)).toEqual(['section', 'plain', 'section']);
  });

  it('a different header starts another block', () => {
    const two = formFields(formWith({ a: { type: 'string', 'x-section': 'A' }, b: { type: 'string', 'x-section': 'B' } }));
    expect(groupedBySection(two).map((block) => (block.kind === 'section' ? block.label : ''))).toEqual(['A', 'B']);
  });

  it('plain fields in a row stay one run, so they can still share a line', () => {
    const plain = formFields(formWith({ a: { type: 'string' }, b: { type: 'string' } }));
    const blocks = groupedBySection(plain);
    expect(blocks.map((block) => block.kind)).toEqual(['plain']);
    expect(names(blocks[0]!)).toBe('a,b');
  });
});

describe('what opens a folded section by itself: nothing required hides (agentes 13/11)', () => {
  const inside = formFields(expense).slice(1);

  it('stays folded while what is inside is filled and has no error', () => {
    expect(sectionHasBlankRequired(inside, { monto: 100, fecha: '2026-11-13' })).toBe(false);
    expect(sectionHasError(inside, {})).toBe(false);
  });

  it('a required field inside that is blank (the voucher did not give the amount) opens it', () => {
    expect(sectionHasBlankRequired(inside, { fecha: '2026-11-13' })).toBe(true);
    expect(sectionHasBlankRequired(inside, { monto: '  ' })).toBe(true);
  });

  it('an empty field that is not required does not', () => {
    expect(sectionHasBlankRequired(inside, { monto: 100 })).toBe(false);
  });

  it('an error under a field inside opens it, also an error under one of its rows', () => {
    expect(sectionHasError(inside, { fecha: 'Elige una fecha.' })).toBe(true);
    expect(sectionHasError(inside, { destino: 'Elige una de las opciones.' })).toBe(false);
    const list = formFields(formWith({ filas: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' } } }, 'x-section': 'S' } }));
    expect(sectionHasError(list, { 'filas[0].n': 'Escribe un número.' })).toBe(true);
    expect(sectionHasError(list, { filas2: 'x' })).toBe(false);
  });
});

describe('sectionSlug', () => {
  it('lowercase, no accents, dashes between words', () => {
    expect(sectionSlug('Corregir datos')).toBe('corregir-datos');
    expect(sectionSlug('  Más opciones (¿opcional?) ')).toBe('mas-opciones-opcional');
  });
});

describe('isBlankAnswer: what counts as not answered', () => {
  it('nothing, a blank text and an empty list are blank; a zero, a false and a word are answers', () => {
    expect([undefined, null, '', '   ', []].every(isBlankAnswer)).toBe(true);
    expect([0, false, 'a', ['x'], { a: 1 }].some(isBlankAnswer)).toBe(false);
  });
});
