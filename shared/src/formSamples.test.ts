import { describe, expect, it } from 'vitest';
import { formFields, validateFormValues, type AppForm, type FormSchema } from './appForms';
import { fieldDocumentOf, sectionFormOf, type FieldDocument } from './fieldDocument';
import { sampledSchema } from './formSamples';

/** CTL-IMP's trays as Portal sends them (imprimacionFields.ts): 3 × (empty weight, with asphalt, area), all required. */
const TRAYS = [1, 2, 3].flatMap((tray) => [`pesoSin${tray}`, `pesoCon${tray}`, `area${tray}`]);
const traysSchema: FormSchema = {
  type: 'object',
  properties: Object.fromEntries(TRAYS.map((name) => [name, { type: 'number', title: name, 'x-unit': name.startsWith('area') ? 'm²' : 'g' }])),
  required: TRAYS,
};
const tray = (index: number, values: [number, number, number]) => ({ [`pesoSin${index}`]: values[0], [`pesoCon${index}`]: values[1], [`area${index}`]: values[2] });
const fieldsOf = (schema: FormSchema) => formFields({ id: 'guardar_seccion_de_informe', title: 'Bandejas', schema } satisfies AppForm);
const errorsOf = (raw: Record<string, unknown>) => {
  const checked = validateFormValues(fieldsOf(sampledSchema(traysSchema)), raw);
  return checked.ok ? {} : checked.errors;
};

describe('trays of a CTL-IMP: one complete is enough (José 19/11)', () => {
  it('tray 1 alone passes: trays 2 and 3 are optional', () => {
    // Arrange
    const raw = tray(1, [1560, 1720, 0.178]);
    // Act
    const checked = validateFormValues(fieldsOf(sampledSchema(traysSchema)), raw);
    // Assert
    expect(checked).toEqual({ ok: true, values: raw });
  });

  it('only tray 2 filled also passes: tray 1 is not owed then', () => {
    expect(errorsOf(tray(2, [1705, 1920, 0.178]))).toEqual({});
  });

  it('nothing typed asks for the first tray, and only for it', () => {
    expect(errorsOf({})).toEqual({ pesoSin1: 'Escribe un número.', pesoCon1: 'Escribe un número.', area1: 'Escribe un número.' });
  });

  it('a half-filled tray is still checked whole', () => {
    // Arrange
    const raw = { ...tray(1, [1560, 1720, 0.178]), pesoSin2: 1705 };
    // Act
    const errors = errorsOf(raw);
    // Assert
    expect(errors).toEqual({ pesoCon2: 'Escribe un número.', area2: 'Escribe un número.' });
  });

  it('a half-filled tray with the others empty asks only for its missing fields', () => {
    expect(errorsOf({ pesoCon3: 1928 })).toEqual({ pesoSin3: 'Escribe un número.', area3: 'Escribe un número.' });
  });

  it('a value out of range keeps its own error', () => {
    // Arrange
    const schema = sampledSchema({ ...traysSchema, properties: { ...traysSchema.properties, area1: { type: 'number', title: 'area1', exclusiveMinimum: 0 } } });
    // Act
    const checked = validateFormValues(fieldsOf(schema), tray(1, [1560, 1720, 0]));
    // Assert
    expect(checked).toEqual({ ok: false, errors: { area1: 'Mayor que 0.' } });
  });

  it('a draft keeps saving what is filled, with no tray owed', () => {
    expect(validateFormValues(fieldsOf(sampledSchema(traysSchema)), {}, { draft: true })).toEqual({ ok: true, values: {} });
  });
});

describe('sampledSchema', () => {
  it('marks each tray and leaves required only the first one', () => {
    // Act
    const schema = sampledSchema(traysSchema);
    // Assert
    expect(schema.required).toEqual(['pesoSin1', 'pesoCon1', 'area1']);
    expect(schema.properties?.area3?.['x-sample']).toBe(3);
    expect(fieldsOf(schema).find((field) => field.name === 'pesoCon2')).toMatchObject({ required: false, sample: 2 });
  });

  it('a form without numbered samples stays as it was', () => {
    // Arrange
    const plain: FormSchema = { type: 'object', properties: { tramo: { type: 'string' }, carril: { type: 'string' } }, required: ['tramo'] };
    // Act + Assert
    expect(sampledSchema(plain)).toEqual(plain);
  });

  it('a lone numbered field is not a sample group', () => {
    const lone: FormSchema = { type: 'object', properties: { lectura1: { type: 'number' }, nota: { type: 'string' } }, required: ['lectura1'] };
    expect(sampledSchema(lone)).toEqual(lone);
  });
});

describe('sectionFormOf applies it only where it was decided', () => {
  const documentOf = (type: string): FieldDocument => {
    const document = fieldDocumentOf({
      id: 'r1', type, title: 'Control', status: 'draft',
      forms: { bandejas: traysSchema },
      sections: [{ id: 'tramos', title: 'Tramos', required: true, state: 'partial', repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }] }, items: [{ id: 't1', title: 'Tramo 1', summary: [], results: [], sections: [{ id: 'bandejas', state: 'empty', values: {} }] }] }],
      publish: { label: 'Publicar informe', missing: [] },
    });
    if (!document) throw new Error('document did not parse');
    return document;
  };
  const path = { sectionId: 'tramos', itemId: 't1', key: 'bandejas' };

  it('CTL-IMP trays: only tray 1 required', () => {
    expect(sectionFormOf(documentOf('CTL-IMP'), path)?.schema.required).toEqual(['pesoSin1', 'pesoCon1', 'area1']);
  });

  it('another report type keeps every field Portal asks for (CON-CAP points stay all owed)', () => {
    expect(sectionFormOf(documentOf('CON-CAP'), path)?.schema.required).toEqual(TRAYS);
  });
});
