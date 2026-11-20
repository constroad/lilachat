import { describe, expect, it } from 'vitest';
import type { EphemeralAnswer } from './botCommands';
import { fieldDocumentOf, type FieldDocument, type SectionPath } from './fieldDocument';
import { MEASURE_FIELD, photoMeasureOf, splitPhotoMeasure, withPhotoMeasure } from './unitMeasure';

const KINDS = ['ingreso', 'temperatura', 'escantillon', 'vacia'];
const template = [
  { id: 'datos', title: 'Datos', required: true, form: 'unidad' },
  ...KINDS.map((kind) => ({ id: `foto-${kind}`, title: `Foto de ${kind}`, required: true, form: 'fotos', tool: 'agregar_foto_de_informe', photoKind: kind })),
];

function documentOf(values: Record<string, unknown> = {}, type = 'CTL-PIS'): FieldDocument {
  return fieldDocumentOf({
    id: 'r1', type, title: 'Control de pista', status: 'draft',
    forms: {
      unidad: { type: 'object', properties: { horaLlegada: { type: 'string', title: 'Hora', format: 'time' }, tempLlegada: { type: 'number', title: 'Temperatura', minimum: 0, maximum: 250 }, escantillonCm: { type: 'number', title: 'Escantillón' } } },
      fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción' } } },
    },
    sections: [{ id: 'unidades', kind: 'repeat', title: 'Unidades', required: true, state: 'partial', summary: [], results: [], itemTitle: 'Unidad', addLabel: '', min: 1, template, items: [{ id: 'd1', title: 'Unidad 1 · AAA', summary: [], results: [], sections: [{ id: 'datos', state: 'partial', values }, ...KINDS.map((kind) => ({ id: `foto-${kind}`, state: 'empty', values: { fotos: [] } }))] }] }],
    publish: { label: 'Publicar', missing: [] },
  })!;
}

const pathOf = (kind: string): SectionPath => ({ sectionId: 'unidades', itemId: 'd1', key: `foto-${kind}` });
const photoForm = (): EphemeralAnswer => ({ commandId: 'c', appName: 'Lilachat', command: '', state: 'form', response: { responseType: 'form', form: { id: 'agregar_foto_de_informe', title: 'Foto', schema: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' }, descripcion: { type: 'string', title: 'Descripción' } } } } } });

describe('the measure of a unit photo (José 20/11)', () => {
  it('the temperature photo carries °C and the escantillón photo cm', () => {
    const document = documentOf();
    expect(photoMeasureOf(document, pathOf('temperatura'))?.measure).toEqual({ field: 'tempLlegada', unit: '°C', title: 'Temperatura (°C)' });
    expect(photoMeasureOf(document, pathOf('escantillon'))?.measure.field).toBe('escantillonCm');
  });

  it('the ingreso and empty-truck photos carry none, nor a report that is not a CTL-PIS', () => {
    expect(photoMeasureOf(documentOf(), pathOf('ingreso'))).toBeNull();
    expect(photoMeasureOf(documentOf(), pathOf('vacia'))).toBeNull();
    expect(photoMeasureOf(documentOf({}, 'CTL-IMP'), pathOf('temperatura'))).toBeNull();
    expect(photoMeasureOf(documentOf(), { ...pathOf('temperatura'), itemId: 'nope' })).toBeNull();
  });

  it('puts the numeric field right under the photo, with its unit, range and saved value', () => {
    // Arrange
    const document = documentOf({ tempLlegada: 148 });
    // Act
    const answer = withPhotoMeasure(photoForm(), document, pathOf('temperatura'));
    // Assert
    const properties = answer?.response?.form?.schema.properties ?? {};
    expect(Object.keys(properties)).toEqual(['foto', MEASURE_FIELD, 'descripcion']);
    expect(properties[MEASURE_FIELD]).toEqual({ type: 'number', title: 'Temperatura (°C)', 'x-unit': '°C', minimum: 0, maximum: 250, default: 148 });
  });

  it('leaves any other form as it was', () => {
    const form = photoForm();
    expect(withPhotoMeasure(form, documentOf(), pathOf('ingreso'))).toBe(form);
    expect(withPhotoMeasure(null, documentOf(), pathOf('temperatura'))).toBeNull();
  });
});

describe('saving the photo with its measure', () => {
  it('sends the photo without the measure and the unit data with all it had', () => {
    // Arrange
    const document = documentOf({ horaLlegada: '08:02', tempLlegada: 148 });
    // Act
    const split = splitPhotoMeasure(document, pathOf('escantillon'), { foto: 'kept', [MEASURE_FIELD]: '5,1' }, () => '09:00');
    // Assert
    expect(split.photoValues).toEqual({ foto: 'kept' });
    expect(split.data).toEqual({ path: { sectionId: 'unidades', itemId: 'd1', key: 'datos' }, values: { horaLlegada: '08:02', tempLlegada: 148, escantillonCm: 5.1 } });
  });

  it('fills the arrival hour the data did not have', () => {
    const split = splitPhotoMeasure(documentOf(), pathOf('temperatura'), { foto: 'kept', [MEASURE_FIELD]: 150 }, () => '08:20');
    expect(split.data?.values).toEqual({ horaLlegada: '08:20', tempLlegada: 150 });
  });

  it('saves no data when the measure was left empty or is not a number', () => {
    expect(splitPhotoMeasure(documentOf(), pathOf('temperatura'), { foto: 'kept', [MEASURE_FIELD]: '' }, () => '08:20')).toEqual({ photoValues: { foto: 'kept' }, data: null });
    expect(splitPhotoMeasure(documentOf(), pathOf('temperatura'), { foto: 'kept', [MEASURE_FIELD]: 'abc' }, () => '08:20').data).toBeNull();
    expect(splitPhotoMeasure(documentOf(), pathOf('ingreso'), { foto: 'kept' }, () => '08:20')).toEqual({ photoValues: { foto: 'kept' }, data: null });
  });
});
