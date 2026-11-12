import { describe, expect, it } from 'vitest';
import { formFields, initialValues, validateFormValues, type AppForm, type FormField } from './appForms.js';
import { togglePick } from './appFormRows.js';

/**
 * agentes' «Completar gasto» (12/11): each row of «partidas» picks ONE partida, so José saw a
 * dropdown and could not pick a second one. A list whose rows are keyed by one choice is a set
 * of checks: one row per option ticked, its amount beside it.
 */
const partidas = [{ const: 'p1', title: 'IMPRIMACION MC30' }, { const: 'p2', title: 'CARPETA ASFALTICA' }, { const: 'p3', title: 'SEÑALIZACION' }];
const expenseForm = (rowFields: Record<string, unknown>, required: string[] = ['partidaId']): AppForm => ({
  id: 'completar_gasto',
  title: 'Completar gasto',
  schema: {
    type: 'object',
    properties: {
      reparto: { type: 'string', title: 'Repartir', enum: ['Una partida', 'Partes iguales', 'Según partida', 'A mano'], 'x-refresh': true, default: 'A mano' },
      partidas: { type: 'array', title: 'Partidas', minItems: 1, items: { type: 'object', properties: { partidaId: { type: 'string', title: 'Partida', oneOf: partidas }, ...rowFields }, required } },
    },
    required: ['reparto', 'partidas'],
  },
});
const listOf = (form: AppForm) => formFields(form).find((field) => field.name === 'partidas') as Extract<FormField, { kind: 'list' }>;
const amountField = { monto: { type: 'number', title: 'Monto', exclusiveMinimum: 0, 'x-unit': 'S/', 'x-width': 'half' } };

describe('a list keyed by one choice (the expense partidas)', () => {
  it('is picked by its choice, one row per option at most, for «Partes iguales» and «A mano»', () => {
    // Act
    const equal = listOf(expenseForm({}));
    const byHand = listOf(expenseForm(amountField, ['partidaId', 'monto']));
    // Assert
    expect(equal).toMatchObject({ kind: 'list', pickBy: 'partidaId', min: 1, max: 3 });
    expect(byHand).toMatchObject({ kind: 'list', pickBy: 'partidaId', max: 3 });
  });

  it('is not picked when the rows carry more than a short field beside the choice, or two choices', () => {
    // Arrange
    const note = { nota: { type: 'string', title: 'Nota', maxLength: 2000 } };
    const twoChoices = { otra: { type: 'string', title: 'Otra', enum: ['a', 'b'] } };
    // Act
    const withNote = listOf(expenseForm(note));
    const withTwo = listOf(expenseForm(twoChoices, ['partidaId', 'otra']));
    // Assert
    expect(withNote.pickBy).toBeUndefined();
    expect(withTwo.pickBy).toBeUndefined();
  });

  it('a tick adds the row in the options order and a second tick takes it out, keeping the other amounts', () => {
    // Arrange
    const field = listOf(expenseForm(amountField, ['partidaId', 'monto']));
    // Act
    const two = togglePick(field, togglePick(field, [], 'p3'), 'p1');
    const typed = two.map((row) => (row.partidaId === 'p3' ? { ...row, monto: 40 } : row));
    const back = togglePick(field, typed, 'p1');
    // Assert
    expect(two.map((row) => row.partidaId)).toEqual(['p1', 'p3']);
    expect(back).toEqual([{ partidaId: 'p3', monto: 40 }]);
  });

  it('starts with nothing ticked and asks for at least one', () => {
    // Arrange
    const fields = formFields(expenseForm({}));
    // Act
    const start = initialValues(fields);
    const empty = validateFormValues(fields, { reparto: 'Partes iguales', partidas: [] });
    // Assert
    expect(start.partidas).toEqual([]);
    expect(empty.ok).toBe(false);
  });

  it('sends the rows as agentes reads them, and asks the amount of each ticked one by hand', () => {
    // Arrange
    const fields = formFields(expenseForm(amountField, ['partidaId', 'monto']));
    // Act
    const missing = validateFormValues(fields, { reparto: 'A mano', partidas: [{ partidaId: 'p1', monto: 50 }, { partidaId: 'p2' }] });
    const sent = validateFormValues(fields, { reparto: 'A mano', partidas: [{ partidaId: 'p1', monto: '50' }, { partidaId: 'p2', monto: 30.5 }] });
    // Assert
    expect(missing.ok).toBe(false);
    expect(sent).toEqual({ ok: true, values: { reparto: 'A mano', partidas: [{ partidaId: 'p1', monto: 50 }, { partidaId: 'p2', monto: 30.5 }] } });
  });

  it('draws the four ways to split in two columns instead of a list to open', () => {
    // Act
    const reparto = formFields(expenseForm({})).find((field) => field.name === 'reparto');
    // Assert
    expect(reparto).toMatchObject({ kind: 'choice', segmented: false, searchable: false, columns: 2 });
  });
});
