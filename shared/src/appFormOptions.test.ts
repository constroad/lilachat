import { describe, expect, it } from 'vitest';
import { FORMS_LEVEL, formFields, formLevelOf, initialValues, validateFormSpec, validateFormValues, type AppForm, type FormSchemaProperty } from './appForms.js';
import { choiceOptions, draftValues, keptAfterRefresh, optionsForRow, previewReplyOf, rowTitleOf } from './appFormOptions.js';

/**
 * Fuel consumption (agentes 2483da7, 30/10): Wilson picks the week's orders,
 * then a start and an end reading per tank, each reading with the tape's photos.
 */
const PEN = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const OIL = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const reading = (id: string, tank: string, title: string, extra: Record<string, unknown> = {}) => ({ const: id, title, 'x-match': { tanque: tank }, 'x-thumb': `https://lila.constroad.com/t/${id}.jpg`, 'x-photos': [`https://lila.constroad.com/f/${id}-1.jpg`, `https://lila.constroad.com/f/${id}-2.jpg`], ...extra });
const READINGS = [reading('r1', PEN, '23 oct · 82 cm'), reading('r2', PEN, '29 oct · 31 cm'), reading('r3', OIL, '23 oct · 140 cm'), reading('r4', PEN, '22 oct · 85 cm', { 'x-disabled': true, description: 'Usada como fin del consumo del 22/10' })];
const form = (properties: Record<string, FormSchemaProperty>, extra: Record<string, unknown> = {}): AppForm => ({ id: 'consumo', title: 'Registrar consumo', schema: { type: 'object', properties, required: Object.keys(properties), ...extra } });
const orders: FormSchemaProperty = {
  type: 'array',
  title: 'Pedidos del periodo',
  minItems: 1,
  items: { type: 'string', oneOf: [{ const: 'p1', title: 'PED-2026-1214 · 64 m³' }, { const: 'p2', title: 'PED-2026-1220 · 58 m³' }, { const: 'p9', title: 'PED-2026-1209 · 40 m³', description: 'Usado en el consumo del 22/10', 'x-disabled': true } as never] },
};
const readings: FormSchemaProperty = {
  type: 'array',
  title: 'Lecturas por tanque',
  'x-fixed-rows': true,
  'x-row-title': 'tanque',
  default: [{ tanque: PEN }, { tanque: OIL }],
  items: { type: 'object', required: ['tanque', 'inicioId', 'finId'], properties: { tanque: { type: 'string', oneOf: [{ const: PEN, title: 'PEN-1 · Asfalto' }, { const: OIL, title: 'Petróleo · Diésel B5' }] }, inicioId: { type: 'string', title: 'Lectura de inicio', oneOf: READINGS }, finId: { type: 'string', title: 'Lectura de fin', oneOf: READINGS } } },
};

describe('choiceOptions with the rich extras', () => {
  it('keeps an https thumbnail, up to 6 https photos, the row match and the disabled mark with its reason', () => {
    // Arrange
    const property: FormSchemaProperty = { type: 'string', oneOf: [reading('r1', PEN, '23 oct'), { const: 'x', title: 'Sin https', 'x-thumb': 'http://inseguro/t.jpg', 'x-photos': ['http://a', ...Array.from({ length: 8 }, (_, index) => `https://lila.constroad.com/${index}.jpg`)] } as never, READINGS[3]] };
    // Act
    const options = choiceOptions(property)!;
    // Assert
    expect(options[0]).toEqual({ value: 'r1', label: '23 oct', thumb: 'https://lila.constroad.com/t/r1.jpg', photos: ['https://lila.constroad.com/f/r1-1.jpg', 'https://lila.constroad.com/f/r1-2.jpg'], match: { tanque: PEN } });
    expect(options[1].thumb).toBeUndefined();
    expect(options[1].photos).toHaveLength(6);
    expect(options[2]).toMatchObject({ disabled: true, sub: 'Usada como fin del consumo del 22/10' });
  });
  it('a plain enum stays as before, without extras', () => {
    expect(choiceOptions({ type: 'string', enum: ['a'], 'x-labels': { a: 'Uno' } })).toEqual([{ value: 'a', label: 'Uno' }]);
  });
});

describe('multi-select (type array + items.oneOf)', () => {
  it('is a «multi» field, with minItems as its minimum and every option as its maximum', () => {
    // Act
    const [field] = formFields(form({ pedidos: orders }));
    // Assert
    expect(field).toMatchObject({ kind: 'multi', name: 'pedidos', min: 1, max: 3, required: true });
  });
  it('sends the picks once each; refuses an unknown one, a disabled one and too few', () => {
    // Arrange
    const fields = formFields(form({ pedidos: orders }));
    // Act / Assert
    expect(validateFormValues(fields, { pedidos: ['p1', 'p2', 'p1'] })).toEqual({ ok: true, values: { pedidos: ['p1', 'p2'] } });
    expect(validateFormValues(fields, { pedidos: ['p1', 'zz'] })).toEqual({ ok: false, errors: { pedidos: 'Elige entre las opciones.' } });
    expect(validateFormValues(fields, { pedidos: ['p9'] })).toEqual({ ok: false, errors: { pedidos: 'Esa opción ya no se puede elegir.' } });
    expect(validateFormValues(fields, { pedidos: [] })).toEqual({ ok: false, errors: { pedidos: 'Elige al menos una.' } });
  });
  it('an empty oneOf is a choice with no options yet, not a broken form (Test without orders, 31/10)', () => {
    // Arrange
    const empty: FormSchemaProperty = { type: 'array', title: 'Pedidos del periodo', minItems: 1, items: { type: 'string', oneOf: [] } };
    const spec = form({ pedidos: empty, lectura: { type: 'string', oneOf: [] } });
    // Act
    const fields = formFields(spec);
    // Assert
    expect(validateFormSpec(spec)).toMatchObject({ ok: true });
    expect(fields[0]).toMatchObject({ kind: 'multi', options: [], min: 0, max: 0 });
    expect(fields[1]).toMatchObject({ kind: 'choice', options: [] });
    expect(validateFormValues(fields, { pedidos: [], lectura: '' })).toEqual({ ok: false, errors: { lectura: 'Elige una opción.' } });
  });
  it('a oneOf without any const is still not a choice', () => {
    expect(choiceOptions({ type: 'string', oneOf: [{ title: 'sin const' }] })).toBeNull();
  });
  it('a single choice refuses a disabled option too', () => {
    const fields = formFields(form({ lectura: { type: 'string', oneOf: READINGS } }));
    expect(validateFormValues(fields, { lectura: 'r4' })).toEqual({ ok: false, errors: { lectura: 'Esa opción ya no se puede elegir.' } });
  });
});

describe('fixed rows per tank (x-fixed-rows, x-row-title, x-match)', () => {
  it('no tanks in the period: an empty default is a list with no rows, not a broken form', () => {
    // Arrange
    const spec = form({ lecturas: { ...readings, default: [] } });
    // Act
    const [field] = formFields(spec);
    // Assert
    expect(validateFormSpec(spec)).toMatchObject({ ok: true });
    expect(field).toMatchObject({ kind: 'list', fixedRows: true, min: 0, max: 0 });
    expect(validateFormValues([field], { lecturas: [] })).toMatchObject({ ok: true });
  });
  it('a row per default item, no adding nor removing, titled by its tank', () => {
    // Act
    const [field] = formFields(form({ lecturas: readings }));
    // Assert
    expect(field).toMatchObject({ kind: 'list', fixedRows: true, rowTitle: 'tanque', min: 2, max: 2 });
    expect(initialValues([field]).lecturas).toEqual([{ tanque: PEN }, { tanque: OIL }]);
    if (field.kind !== 'list') throw new Error('list');
    expect(rowTitleOf(field, { tanque: OIL })).toBe('Petróleo · Diésel B5');
  });
  it('each row offers only the readings of its own tank, and the server holds it', () => {
    // Arrange
    const [field] = formFields(form({ lecturas: readings }));
    if (field.kind !== 'list') throw new Error('list');
    const start = field.fields.find((one) => one.name === 'inicioId');
    if (start?.kind !== 'choice') throw new Error('choice');
    // Act
    const forOil = optionsForRow(start.options, { tanque: OIL }).map((option) => option.value);
    const sent = validateFormValues([field], { lecturas: [{ tanque: PEN, inicioId: 'r3', finId: 'r2' }, { tanque: OIL, inicioId: 'r3', finId: 'r3' }] });
    // Assert
    expect(forOil).toEqual(['r3']);
    expect(sent).toEqual({ ok: false, errors: { 'lecturas[0].inicioId': 'Esa opción no va en esta fila.' } });
  });
});

describe('x-refresh and x-preview', () => {
  it('marks the fields that ask for the form again and keeps the preview tool of the schema', () => {
    // Arrange
    const raw = { id: 'consumo', title: 'Registrar consumo', schema: { type: 'object', 'x-preview': { tool: 'revisar_consumo' }, properties: { desde: { type: 'string', format: 'date', 'x-refresh': true }, pedidos: orders } } };
    // Act
    const checked = validateFormSpec(raw);
    // Assert
    if (!checked.ok) throw new Error(checked.message);
    expect(checked.form.preview).toBe('revisar_consumo');
    expect(formFields(checked.form)[0]).toMatchObject({ kind: 'date', refresh: true });
  });
  it('after a refresh keeps only what still exists in the new options', () => {
    // Arrange
    const fields = formFields(form({ pedidos: orders, lecturas: readings, nota: { type: 'string' } }));
    // Act
    const kept = keptAfterRefresh(fields, { pedidos: ['p1', 'gone'], lecturas: [{ tanque: PEN, inicioId: 'r1', finId: 'old' }, { tanque: OIL, inicioId: 'r3' }], nota: 'hola' });
    // Assert
    expect(kept).toEqual({ pedidos: ['p1'], lecturas: [{ tanque: PEN, inicioId: 'r1' }, { tanque: OIL, inicioId: 'r3' }], nota: 'hola' });
  });
  it('fixed rows follow the app\'s new rows, each keeping what was picked in the row of the same tank', () => {
    // Arrange: the new period only has PEN-1.
    const fields = formFields(form({ lecturas: { ...readings, default: [{ tanque: PEN }] } }));
    // Act
    const kept = keptAfterRefresh(fields, { lecturas: [{ tanque: OIL, inicioId: 'r3' }, { tanque: PEN, inicioId: 'r1' }] });
    // Assert
    expect(kept).toEqual({ lecturas: [{ tanque: PEN, inicioId: 'r1' }] });
  });
  it('a form with any of these needs a Lilachat of level 3; an older one is told to update', () => {
    expect(FORMS_LEVEL).toBe(3);
    expect(formLevelOf(form({ pedidos: orders }))).toBe(3);
    expect(formLevelOf(form({ nota: { type: 'string' } }, { 'x-preview': { tool: 'revisar' } }))).toBe(3);
    expect(formLevelOf(form({ nota: { type: 'string' } }))).toBe(1);
  });
});

describe('the draft that travels to refresh or to sum up', () => {
  it('carries only the form\'s own answers, without photos nor the place', () => {
    // Arrange
    const fields = formFields(form({ pedidos: orders, lecturas: readings, foto: { type: 'string', 'x-input': 'photo' }, donde: { type: 'object', 'x-input': 'location' } }));
    // Act
    const draft = draftValues(fields, { pedidos: ['p1'], lecturas: [{ tanque: PEN, inicioId: 'r1' }], foto: 'file-1', donde: { lat: 1, lng: 2, precision: 3 }, otro: 'x' });
    // Assert
    expect(draft).toEqual({ pedidos: ['p1'], lecturas: [{ tanque: PEN, inicioId: 'r1' }] });
  });
});

describe('previewReplyOf', () => {
  it('keeps the kit blocks (up to 8) and one message per field', () => {
    // Arrange
    const body = { blocks: [{ type: 'metric', value: '8.68', unit: 'gl/m³', label: 'Rendimiento', tone: 'warn' }, { type: 'nope' }, { type: 'text', text: '17 % sobre el promedio', tone: 'warn' }], errors: { 'lecturas[0].finId': 'La lectura de fin va después del inicio.', mal: 3 } };
    // Act
    const reply = previewReplyOf(body);
    // Assert
    expect(reply.blocks.map((block) => block.type)).toEqual(['metric', 'text']);
    expect(reply.errors).toEqual({ 'lecturas[0].finId': 'La lectura de fin va después del inicio.' });
  });
  it('anything else is an empty summary, never an error for the person', () => {
    expect(previewReplyOf('basura')).toEqual({ blocks: [], errors: {} });
  });
});
