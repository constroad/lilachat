import { describe, expect, it } from 'vitest';
import { formFields, type FormSchema } from './appForms';
import { compactSectionSchema, isCompactReport, LANE_CHIPS } from './compactReportForms';
import { fieldDocumentOf, sectionFormOf, type FieldDocument } from './fieldDocument';

/** CTL-IMP's «ubicacion» as Portal sends it (imprimacionFields.ts). */
const placeSchema: FormSchema = {
  type: 'object',
  properties: {
    tramo: { type: 'string', title: 'Tramo', maxLength: 200 },
    carril: { type: 'string', title: 'Carril', maxLength: 200 },
    progresivaDesde: { type: 'string', title: 'Progresiva de', maxLength: 200, 'x-width': 'half' },
    progresivaHasta: { type: 'string', title: 'Progresiva al', maxLength: 200, 'x-width': 'half' },
    horaInicio: { type: 'string', format: 'time', title: 'Hora inicio', 'x-width': 'half' },
    horaFinal: { type: 'string', format: 'time', title: 'Hora final', 'x-width': 'half' },
  },
  required: ['tramo'],
};

describe('compactSectionSchema (design imp-01, José 19/11)', () => {
  it('CTL-IMP «ubicacion»: the progresivas go before the lane, which gets its chips', () => {
    // Act
    const schema = compactSectionSchema('CTL-IMP', 'ubicacion', placeSchema);
    // Assert
    expect(Object.keys(schema.properties ?? {})).toEqual(['tramo', 'progresivaDesde', 'progresivaHasta', 'carril', 'horaInicio', 'horaFinal']);
    expect(schema.properties?.carril?.['x-chips']).toEqual(LANE_CHIPS);
    expect(schema.required).toEqual(['tramo']);
  });

  it('the lane stays a text: what it saves is the same string Portal reads', () => {
    const lane = formFields({ id: 'f', title: 'Ubicación', schema: compactSectionSchema('CTL-IMP', 'ubicacion', placeSchema) }).find((field) => field.name === 'carril');
    expect(lane).toMatchObject({ kind: 'text', chips: ['Derecho', 'Izquierdo', 'Ambos'] });
  });

  it('another report type or section is left as it came', () => {
    expect(compactSectionSchema('CON-CAP', 'ubicacion', placeSchema)).toBe(placeSchema);
    expect(compactSectionSchema('CTL-IMP', 'material', placeSchema)).toBe(placeSchema);
  });

  it('a schema without the listed fields keeps its own order', () => {
    const other: FormSchema = { type: 'object', properties: { nota: { type: 'string' }, tramo: { type: 'string' } } };
    expect(Object.keys(compactSectionSchema('CTL-IMP', 'ubicacion', other).properties ?? {})).toEqual(['tramo', 'nota']);
  });

  it('only CTL-IMP is compact', () => {
    expect(isCompactReport('CTL-IMP')).toBe(true);
    expect(isCompactReport('CON-CAP')).toBe(false);
  });
});

describe('x-chips on a text field', () => {
  it('bad chips are ignored: a list of short strings only', () => {
    const fields = formFields({ id: 'f', title: 'F', schema: { type: 'object', properties: { a: { type: 'string', 'x-chips': ['Sí', 3, ''] as unknown as string[] }, b: { type: 'string', 'x-chips': 'x' as unknown as string[] } } } });
    expect(fields.map((field) => (field.kind === 'text' ? field.chips : null))).toEqual([['Sí'], undefined]);
  });
});

describe('sectionFormOf marks the CTL-IMP sections compact', () => {
  const documentOf = (type: string): FieldDocument => {
    const document = fieldDocumentOf({
      id: 'r1', type, title: 'Control', status: 'draft',
      forms: { ubicacion: placeSchema },
      sections: [{ id: 'tramos', title: 'Tramos', required: true, state: 'partial', repeat: { itemTitle: 'Tramo', addLabel: 'Agregar tramo', min: 1, template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }] }, items: [{ id: 't1', title: 'Tramo 1', summary: [], results: [], sections: [{ id: 'ubicacion', state: 'empty', values: { carril: 'Derecho' } }] }] }],
      publish: { label: 'Publicar informe', missing: [] },
    });
    if (!document) throw new Error('document did not parse');
    return document;
  };
  const path = { sectionId: 'tramos', itemId: 't1', key: 'ubicacion' };

  it('CTL-IMP: compact, chips and the saved lane as default', () => {
    // Act
    const form = sectionFormOf(documentOf('CTL-IMP'), path);
    // Assert
    expect(form?.compact).toBe(true);
    expect(form?.schema.properties?.carril).toMatchObject({ default: 'Derecho', 'x-chips': LANE_CHIPS });
  });

  it('another report keeps the plain form', () => {
    const form = sectionFormOf(documentOf('CON-CAP'), path);
    expect(form?.compact).toBeUndefined();
    expect(form?.schema.properties?.carril?.['x-chips']).toBeUndefined();
  });
});
