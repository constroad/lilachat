import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { splitErrorOf, rebalanceSplit, splitEvenly, splitLineOf, splitFor, splitOf, splitRows, splitStatus, typedAfterEdit } from './appFormSplit.js';

const formWith = (properties: Record<string, FormSchemaProperty>): AppForm => ({ id: 'f', title: 'F', schema: { type: 'object', properties } });

/** agentes' «Completar gasto» (12/11): the total, and the partidas ticked with their amount. */
const expense = formWith({
  monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
  partidas: {
    type: 'array',
    title: 'Partidas',
    items: {
      type: 'object',
      required: ['partidaId'],
      properties: {
        partidaId: { type: 'string', title: 'Partida', enum: ['mat', 'mo', 'eq'], 'x-labels': { mat: 'Materiales', mo: 'Mano de obra', eq: 'Equipos' } },
        monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
      },
    },
  },
});

describe('splitOf: which list splits which total (José 13/11: «ofrecer repartir el monto, debe ser inteligente»)', () => {
  it('a list of ticked partidas whose amount has the name of a number of the form splits that number', () => {
    expect(splitOf(formFields(expense))).toEqual({ list: 'partidas', amount: 'monto', total: 'monto' });
  });

  it('without a total of the same name there is nothing to split', () => {
    const other = formWith({ ...expense.schema.properties, monto: { type: 'string', title: 'Monto' } });
    expect(splitOf(formFields(other))).toBeNull();
  });
});

describe('splitEvenly', () => {
  it('splits to the cent, the leftover cents go to the first ones', () => {
    expect(splitEvenly(500, 2)).toEqual([250, 250]);
    expect(splitEvenly(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitEvenly(505.05, 1)).toEqual([505.05]);
  });

  it('nothing to split for no rows or no total', () => {
    expect(splitEvenly(500, 0)).toEqual([]);
    expect(splitEvenly(0, 2)).toEqual([0, 0]);
  });
});

describe('rebalanceSplit: the rows the person typed stay, the others share what is left', () => {
  it('Materiales typed at 300, Mano de obra adjusts to 200', () => {
    expect(rebalanceSplit(500, [300, 250], [true, false])).toEqual([300, 200]);
  });

  it('what is left goes evenly among the untyped ones', () => {
    expect(rebalanceSplit(500, [100, 0, 0], [true, false, false])).toEqual([100, 200, 200]);
  });

  it('typed beyond the total leaves the others at zero, never negative', () => {
    expect(rebalanceSplit(500, [600, 10], [true, false])).toEqual([600, 0]);
  });

  it('every row typed: nothing moves', () => {
    expect(rebalanceSplit(500, [100, 100], [true, true])).toEqual([100, 100]);
  });
});

describe('splitStatus', () => {
  it('all assigned, missing or over, to the cent', () => {
    expect(splitStatus(500, [300, 200])).toEqual({ assigned: 500, missing: 0 });
    expect(splitStatus(500, [300, 160])).toEqual({ assigned: 460, missing: 40 });
    expect(splitStatus(500, [300, 250])).toEqual({ assigned: 550, missing: -50 });
    expect(splitStatus(100, [33.34, 33.33, 33.33])).toEqual({ assigned: 100, missing: 0 });
  });
});

describe('splitRows: the form rows with their amounts filled', () => {
  const plan = { list: 'partidas', amount: 'monto', total: 'monto' };

  it('two partidas ticked, nothing typed: half each', () => {
    const rows = [{ partidaId: 'mat' }, { partidaId: 'mo' }];
    expect(splitRows(rows, plan, 'partidaId', 500, new Set())).toEqual([{ partidaId: 'mat', monto: 250 }, { partidaId: 'mo', monto: 250 }]);
  });

  it('the typed partida keeps its amount; a typed text amount counts as its number', () => {
    const rows = [{ partidaId: 'mat', monto: '300' }, { partidaId: 'mo', monto: 250 }];
    expect(splitRows(rows, plan, 'partidaId', 500, new Set(['mat']))).toEqual([{ partidaId: 'mat', monto: '300' }, { partidaId: 'mo', monto: 200 }]);
  });

  it('without a total yet, the rows stay as they are', () => {
    const rows = [{ partidaId: 'mat' }];
    expect(splitRows(rows, plan, 'partidaId', 0, new Set())).toEqual(rows);
  });
});

describe('the split line and the typed rows', () => {
  const plan = { list: 'partidas', amount: 'monto', total: 'monto' };

  it('says what is assigned, missing or over, in the total\'s unit', () => {
    expect(splitLineOf(500, [{ monto: 300 }, { monto: 200 }], plan, 'S/')).toEqual({ text: 'Asignado S/ 500.00 de S/ 500.00', tone: 'ok' });
    expect(splitLineOf(500, [{ monto: 300 }, { monto: 160 }], plan, 'S/')).toEqual({ text: 'Faltan S/ 40.00 por asignar de S/ 500.00', tone: 'error' });
    expect(splitLineOf(500, [{ monto: 600 }], plan, 'S/')).toEqual({ text: 'Sobran S/ 100.00: baja alguna partida', tone: 'error' });
    expect(splitLineOf(0, [], plan).tone).toBe('neutral');
  });

  it('only typing the amount keeps a row; another cell does not', () => {
    expect([...typedAfterEdit(new Set(), plan, 'monto', 'mat')]).toEqual(['mat']);
    const none = new Set<string>();
    expect(typedAfterEdit(none, plan, 'nota', 'mat')).toBe(none);
    expect(typedAfterEdit(none, undefined, 'monto', 'mat')).toBe(none);
  });
});

describe('splitFor', () => {
  it('the partidas list splits the typed total, in its unit; another list splits nothing', () => {
    const fields = formFields(expense);
    expect(splitFor(fields, { monto: '505,05' }, 'partidas')).toEqual({ plan: { list: 'partidas', amount: 'monto', total: 'monto' }, total: 505.05, unit: 'S/' });
    expect(splitFor(fields, {}, 'otra')).toBeUndefined();
  });
});

// José 13/11 (via Portal): a service expense split by Lila must match to the cent; without partidas it stays general.
describe('splitErrorOf: the split blocks sending unless it matches the total', () => {
  const fields = formFields(expense);

  it('missing or over blocks, under the list', () => {
    expect(splitErrorOf(fields, { monto: 500, partidas: [{ partidaId: 'mat', monto: 300 }, { partidaId: 'mo', monto: 160 }] })).toEqual({ partidas: 'Repartiste S/ 460.00 de S/ 500.00: faltan S/ 40.00 por asignar.' });
    expect(splitErrorOf(fields, { monto: 500, partidas: [{ partidaId: 'mat', monto: 600 }] })).toEqual({ partidas: 'Sobran S/ 100.00: baja alguna partida.' });
  });

  it('a split to the cent, no partidas or no total does not block', () => {
    expect(splitErrorOf(fields, { monto: 100, partidas: [{ partidaId: 'mat', monto: 33.34 }, { partidaId: 'mo', monto: 33.33 }, { partidaId: 'eq', monto: 33.33 }] })).toEqual({});
    expect(splitErrorOf(fields, { monto: 500, partidas: [] })).toEqual({});
    expect(splitErrorOf(fields, { monto: 500 })).toEqual({});
    expect(splitErrorOf(fields, { partidas: [{ partidaId: 'mat', monto: 10 }] })).toEqual({});
  });

  it('validateFormValues refuses the form with that error', async () => {
    const { validateFormValues } = await import('./appForms.js');
    const checked = validateFormValues(fields, { monto: 500, partidas: [{ partidaId: 'mat', monto: 300 }] });
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.errors.partidas).toMatch(/faltan S\/ 200.00/);
  });
});
