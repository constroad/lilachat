import { describe, expect, it } from 'vitest';
import { formFields, validateFormSpec, validateFormValues, type FormField } from './appForms.js';
import { ACTION_KEY, isDraftSubmit, submitChosen, submitsOf } from './appFormSubmits.js';

describe('submitsOf: the buttons the app declared (`x-submits`, agentes 13/11)', () => {
  it('reads ids and labels, in order', () => {
    expect(submitsOf([{ id: 'registrar', label: 'Registrar gasto' }, { id: 'borrador', label: 'Guardar borrador' }])).toEqual([
      { id: 'registrar', label: 'Registrar gasto' },
      { id: 'borrador', label: 'Guardar borrador' },
    ]);
  });

  it('keeps a `draft` mark and drops a repeated id, an id with capitals, an empty label and what is not an object', () => {
    expect(submitsOf([{ id: 'a', label: 'A', draft: true }, { id: 'a', label: 'Otra' }, { id: 'B', label: 'B' }, { id: 'c', label: '  ' }, 'x', null, 7])).toEqual([{ id: 'a', label: 'A', draft: true }]);
  });

  it('cleans the label and cuts it to 40 characters; at most three buttons', () => {
    expect(submitsOf([{ id: 'a', label: '  Registrar   gasto ' }])[0]!.label).toBe('Registrar gasto');
    expect(submitsOf([{ id: 'a', label: 'x'.repeat(60) }])[0]!.label).toHaveLength(40);
    expect(submitsOf(['a', 'b', 'c', 'd'].map((id) => ({ id, label: id }))).map((submit) => submit.id)).toEqual(['a', 'b', 'c']);
  });

  it('something that is not a list declares nothing', () => {
    expect(submitsOf(undefined)).toEqual([]);
    expect(submitsOf({ id: 'a', label: 'A' })).toEqual([]);
  });
});

describe('submitChosen and isDraftSubmit', () => {
  const submits = submitsOf([{ id: 'registrar', label: 'Registrar' }, { id: 'borrador', label: 'Borrador' }, { id: 'luego', label: 'Luego', draft: true }]);

  it('the declared button pressed; an id nobody declared, or none, is the first (the strict one)', () => {
    expect(submitChosen(submits, 'borrador')?.id).toBe('borrador');
    expect(submitChosen(submits, 'hackeado')?.id).toBe('registrar');
    expect(submitChosen(submits, undefined)?.id).toBe('registrar');
    expect(submitChosen([], 'x')).toBeUndefined();
    expect(submitChosen(undefined, 'x')).toBeUndefined();
  });

  it('«borrador» is a draft by its name, another by its mark; «registrar» is not', () => {
    expect(isDraftSubmit(submits[1])).toBe(true);
    expect(isDraftSubmit(submits[2])).toBe(true);
    expect(isDraftSubmit(submits[0])).toBe(false);
    expect(isDraftSubmit(undefined)).toBe(false);
  });

  it('the key under which the app receives it', () => {
    expect(ACTION_KEY).toBe('_accion');
  });
});

const formBody = (extra: Record<string, unknown> = {}, schemaExtra: Record<string, unknown> = {}) => ({
  id: 'gasto',
  title: 'Revisar gasto',
  submit_label: 'Registrar gasto',
  ...extra,
  schema: {
    type: 'object',
    required: ['monto'],
    properties: {
      monto: { type: 'number', title: 'Monto', 'x-unit': 'S/', 'x-section': 'Corregir datos', 'x-collapsed': true },
      nota: { type: 'string', title: 'Nota' },
    },
    ...schemaExtra,
  },
});

describe('validateFormSpec carries the buttons of the form', () => {
  const declared = [{ id: 'registrar', label: 'Registrar gasto' }, { id: 'borrador', label: 'Guardar borrador' }];

  it('from the schema, like `x-preview`', () => {
    const checked = validateFormSpec(formBody({}, { 'x-submits': declared }));
    expect(checked.ok && checked.form.submits).toEqual(declared);
    expect(checked.ok && checked.form.submitLabel).toBe('Registrar gasto');
  });

  it('or from the form itself, beside `submit_label`', () => {
    const checked = validateFormSpec(formBody({ 'x-submits': declared }));
    expect(checked.ok && checked.form.submits).toEqual(declared);
  });

  it('the first button names the form\'s button for an older Lilachat when `submit_label` is missing', () => {
    const { submit_label: _gone, ...bare } = formBody({}, { 'x-submits': declared });
    const checked = validateFormSpec(bare);
    expect(checked.ok && checked.form.submitLabel).toBe('Registrar gasto');
  });

  it('a form without them has none, and a malformed list is no list (the form still opens)', () => {
    const none = validateFormSpec(formBody());
    expect(none.ok && none.form.submits).toBeUndefined();
    const broken = validateFormSpec(formBody({}, { 'x-submits': 'registrar' }));
    expect(broken.ok && broken.form.submits).toBeUndefined();
  });

  it('formFields reads the section of a field from the validated form', () => {
    const checked = validateFormSpec(formBody());
    const fields = checked.ok ? formFields(checked.form) : [];
    expect(fields[0]!.section).toEqual({ label: 'Corregir datos', collapsed: true });
    expect(fields[1]!.section).toBeUndefined();
  });
});

describe('validateFormValues as a draft: it saves what is filled', () => {
  const checked = validateFormSpec({
    id: 'gasto',
    title: 'Gasto',
    schema: {
      type: 'object',
      required: ['monto', 'partidas'],
      properties: {
        monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
        nota: { type: 'string', title: 'Nota', maxLength: 5 },
        partidas: {
          type: 'array',
          title: 'Partidas',
          items: {
            type: 'object',
            required: ['partidaId', 'monto'],
            properties: { partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra' } }, monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' } },
          },
        },
      },
    },
  });
  const fields: FormField[] = checked.ok ? formFields(checked.form) : [];

  it('an empty form is refused as a registration and accepted as a draft', () => {
    expect(validateFormValues(fields, {}).ok).toBe(false);
    expect(validateFormValues(fields, {}, { draft: true })).toEqual({ ok: true, values: {} });
  });

  it('the split need not add up in a draft, and a row with no amount is kept', () => {
    const input = { monto: 500, partidas: [{ partidaId: 'mat', monto: 100 }, { partidaId: 'mo' }] };
    expect(validateFormValues(fields, input).ok).toBe(false);
    expect(validateFormValues(fields, input, { draft: true })).toEqual({ ok: true, values: { monto: 500, partidas: [{ partidaId: 'mat', monto: 100 }, { partidaId: 'mo' }] } });
  });

  it('what is filled is still checked: a text too long stays an error in a draft', () => {
    const draft = validateFormValues(fields, { nota: 'demasiado largo' }, { draft: true });
    expect(draft.ok).toBe(false);
    expect(!draft.ok && draft.errors.nota).toBeDefined();
  });
});
