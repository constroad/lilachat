import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchema } from './appForms';
import { sampledSchema } from './formSamples';
import { PARTIAL_SAMPLE_LINE, OWED_SAMPLE_LINE, sampleColumnsOf, sampleRowMessage, sampleRowsOf, sampleTagOf } from './sampleRows';

/** CTL-IMP's trays as Portal titles them (imprimacionFields.ts). */
const TITLES: Record<string, string> = { pesoSin: 'peso vacío', pesoCon: 'con asfalto', area: 'área' };
const traysSchema: FormSchema = {
  type: 'object',
  properties: Object.fromEntries([1, 2, 3].flatMap((tray) => Object.entries(TITLES).map(([base, title]) => [`${base}${tray}`, { type: 'number', title: `Bandeja ${tray} · ${title}`, 'x-unit': base === 'area' ? 'm²' : 'g' }]))),
  required: [1, 2, 3].flatMap((tray) => Object.keys(TITLES).map((base) => `${base}${tray}`)),
};
const fields = () => formFields({ id: 'guardar_seccion_de_informe', title: 'Bandejas', schema: sampledSchema(traysSchema) } satisfies AppForm);
const statesOf = (values: Record<string, unknown>) => sampleRowsOf(fields(), values).map((row) => row.state);

describe('sampleRowsOf: the state of each tray row (design imp-01)', () => {
  it('nothing typed: tray 1 is owed, trays 2 and 3 are optional', () => {
    expect(statesOf({})).toEqual(['owed', 'optional', 'optional']);
  });

  it('tray 1 complete, tray 2 half filled, tray 3 empty', () => {
    // Arrange
    const values = { pesoSin1: 1560, pesoCon1: 1720, area1: 0.178, pesoSin2: 1705 };
    // Act
    const rows = sampleRowsOf(fields(), values);
    // Assert
    expect(rows.map((row) => row.state)).toEqual(['complete', 'partial', 'optional']);
    expect(rows[0]!.fields.map((field) => field.name)).toEqual(['pesoSin1', 'pesoCon1', 'area1']);
  });

  it('only tray 2 typed: tray 1 is no longer owed', () => {
    expect(statesOf({ pesoSin2: 1705, pesoCon2: 1920, area2: 0.178 })).toEqual(['optional', 'complete', 'optional']);
  });

  it('a blank text counts as empty', () => {
    expect(statesOf({ pesoSin1: '  ', pesoCon1: '' })).toEqual(['owed', 'optional', 'optional']);
  });

  it('a form without samples has no rows', () => {
    const plain = formFields({ id: 'f', title: 'F', schema: { type: 'object', properties: { tramo: { type: 'string' } } } });
    expect(sampleRowsOf(plain, {})).toEqual([]);
  });
});

describe('sampleColumnsOf and sampleTagOf', () => {
  it('the columns are the field titles after «Bandeja N ·», with their unit', () => {
    expect(sampleColumnsOf(fields())).toEqual([{ label: 'Peso vacío', short: 'Vacía', unit: 'g' }, { label: 'Con asfalto', short: 'Con asf.', unit: 'g' }, { label: 'Área', unit: 'm²' }]);
  });

  it('a title without separator drops its trailing number', () => {
    const plain = formFields({ id: 'f', title: 'F', schema: sampledSchema({ type: 'object', properties: { lectura1: { type: 'number', title: 'Lectura 1' }, peso1: { type: 'number', title: 'Peso 1' }, lectura2: { type: 'number', title: 'Lectura 2' }, peso2: { type: 'number', title: 'Peso 2' } } }) });
    expect(sampleColumnsOf(plain).map((column) => column.label)).toEqual(['Lectura', 'Peso']);
  });

  it('the row tag is the initial of the title and the index: «B1»', () => {
    expect(sampleTagOf(sampleRowsOf(fields(), {})[1]!)).toBe('B2');
  });
});

describe('sampleRowMessage', () => {
  it('a half-filled tray asks to finish it or leave it empty, even before saving', () => {
    const row = sampleRowsOf(fields(), { pesoSin2: 1705 })[1]!;
    expect(sampleRowMessage(row, {})).toBe(PARTIAL_SAMPLE_LINE);
  });

  it('the owed tray refused on saving asks to fill it', () => {
    const row = sampleRowsOf(fields(), {})[0]!;
    expect(sampleRowMessage(row, { pesoSin1: 'Escribe un número.' })).toBe(OWED_SAMPLE_LINE);
  });

  it('a value out of range keeps its own error', () => {
    const row = sampleRowsOf(fields(), { pesoSin1: 1560, pesoCon1: 1720, area1: 0 })[0]!;
    expect(sampleRowMessage(row, { area1: 'Mayor que 0.' })).toBe('Mayor que 0.');
  });

  it('a complete or optional tray without errors says nothing', () => {
    const rows = sampleRowsOf(fields(), { pesoSin1: 1560, pesoCon1: 1720, area1: 0.178 });
    expect(rows.map((row) => sampleRowMessage(row, {}))).toEqual([undefined, undefined, undefined]);
  });
});
