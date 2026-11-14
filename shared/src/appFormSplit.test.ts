import { describe, expect, it } from 'vitest';
import { formFields, type AppForm, type FormSchemaProperty } from './appForms.js';
import { splitErrorOf, rebalanceSplit, sharePercent, splitByWeights, splitEvenly, splitHintOf, splitBalanced, splitLineOf, splitFor, splitOf, splitRows, splitStatus, typedAfterEdit } from './appFormSplit.js';

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

// agentes 13/11: Portal rounds each part to the cent and the LAST row takes what is left, so the cards agree to the cent.
describe('splitEvenly', () => {
  it('splits to the cent, the last row takes what is left', () => {
    expect(splitEvenly(500, 2)).toEqual([250, 250]);
    expect(splitEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitEvenly(100, 6)).toEqual([16.67, 16.67, 16.67, 16.67, 16.67, 16.65]);
    expect(splitEvenly(505.05, 1)).toEqual([505.05]);
  });

  it('nothing to split for no rows or no total', () => {
    expect(splitEvenly(500, 0)).toEqual([]);
    expect(splitEvenly(0, 2)).toEqual([0, 0]);
  });
});

describe('splitByWeights: each row rounded to the cent, the last one with weight takes the rest', () => {
  it('60 and 40 of 100', () => {
    expect(splitByWeights(100, [60, 40])).toEqual([60, 40]);
    expect(splitByWeights(500, [3, 2])).toEqual([300, 200]);
  });

  it('weights that do not divide the total: the last row closes the sum', () => {
    expect(splitByWeights(100, [1, 1, 1])).toEqual([33.33, 33.33, 33.34]);
    expect(splitByWeights(10, [2, 1])).toEqual([6.67, 3.33]);
  });

  it('a row with no weight gets 0.00 and the leftover goes to the last row WITH weight', () => {
    expect(splitByWeights(100, [1, 1, 0])).toEqual([50, 50, 0]);
    expect(splitByWeights(100, [1, 1, 1, 0])).toEqual([33.33, 33.33, 33.34, 0]);
    expect(splitByWeights(100, [0, 1, 2])).toEqual([0, 33.33, 66.67]);
  });

  it('weights all zero, negative or not numbers: equal shares', () => {
    expect(splitByWeights(100, [0, 0])).toEqual([50, 50]);
    expect(splitByWeights(100, [Number.NaN, -3])).toEqual([50, 50]);
  });

  it('a few cents among many rows never goes negative and still adds up', () => {
    const shares = splitByWeights(0.05, Array.from({ length: 8 }, () => 1));
    expect(shares.every((share) => share >= 0)).toBe(true);
    expect(Math.round(shares.reduce((sum, share) => sum + share, 0) * 100)).toBe(5);
  });

  it('no rows, nothing; no total, zeros', () => {
    expect(splitByWeights(100, [])).toEqual([]);
    expect(splitByWeights(0, [1, 2])).toEqual([0, 0]);
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

  it('with weights the untyped rows share what is left by them («Según partida»)', () => {
    expect(rebalanceSplit(500, [0, 0], [false, false], [60, 40])).toEqual([300, 200]);
    expect(rebalanceSplit(500, [100, 0, 0], [true, false, false], [9, 3, 1])).toEqual([100, 300, 100]);
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

  it('«Según partida»: the rows share the total by the weight of each partida', () => {
    const rows = [{ partidaId: 'mat' }, { partidaId: 'mo' }];
    expect(splitRows(rows, plan, 'partidaId', 500, new Set(), { mat: 3, mo: 2 })).toEqual([{ partidaId: 'mat', monto: 300 }, { partidaId: 'mo', monto: 200 }]);
  });

  it('weighted, a typed partida stays and the other takes what is left whatever its weight', () => {
    const rows = [{ partidaId: 'mat', monto: '100' }, { partidaId: 'mo' }, { partidaId: 'eq' }];
    expect(splitRows(rows, plan, 'partidaId', 500, new Set(['mat']), { mat: 1, mo: 3, eq: 1 })).toEqual([{ partidaId: 'mat', monto: '100' }, { partidaId: 'mo', monto: 300 }, { partidaId: 'eq', monto: 100 }]);
  });

  it('weighted, a partida the weights do not know counts as 0; none known: equal shares', () => {
    const rows = [{ partidaId: 'mat' }, { partidaId: 'mo' }];
    expect(splitRows(rows, plan, 'partidaId', 500, new Set(), { mat: 1 })).toEqual([{ partidaId: 'mat', monto: 500 }, { partidaId: 'mo', monto: 0 }]);
    expect(splitRows(rows, plan, 'partidaId', 500, new Set(), {})).toEqual([{ partidaId: 'mat', monto: 250 }, { partidaId: 'mo', monto: 250 }]);
  });
});

describe('splitHintOf: the weights agentes sends with the list (`x-split`, 13/11)', () => {
  const hint = { weights: { mat: 60, mo: 40 }, modeField: 'reparto', weightedValue: 'Según partida' };

  it('reads the weights, the field that picks the mode and the value that asks for them', () => {
    expect(splitHintOf(hint)).toEqual(hint);
  });

  it('keeps only weights that are finite and not negative', () => {
    expect(splitHintOf({ ...hint, weights: { mat: 60, mo: -1, eq: Number.NaN, tx: '5', ok: 0 } })?.weights).toEqual({ mat: 60, ok: 0 });
  });

  it('a hint with no mode field, no value or no weights is no hint', () => {
    expect(splitHintOf({ weights: { mat: 1 }, weightedValue: 'x' })).toBeUndefined();
    expect(splitHintOf({ weights: { mat: 1 }, modeField: 'm' })).toBeUndefined();
    expect(splitHintOf({ modeField: 'm', weightedValue: 'x' })).toBeUndefined();
    expect(splitHintOf('nope')).toBeUndefined();
    expect(splitHintOf(undefined)).toBeUndefined();
  });
});

describe('splitBalanced: the rows the app sent already add up', () => {
  const plan = { list: 'partidas', amount: 'monto', total: 'monto' };

  it('to the cent: kept; missing or over: not', () => {
    expect(splitBalanced(100, [{ monto: 33.34 }, { monto: 33.33 }, { monto: 33.33 }], plan)).toBe(true);
    expect(splitBalanced(100, [{ monto: 60 }, { monto: 30 }], plan)).toBe(false);
    expect(splitBalanced(100, [{ monto: 60 }, { monto: 50 }], plan)).toBe(false);
    expect(splitBalanced(100, [{ partidaId: 'mat' }], plan)).toBe(false);
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

  describe('with the weights of «Según partida»', () => {
    const weighted = formWith({
      reparto: { type: 'string', title: 'Reparto', enum: ['Una partida', 'Partes iguales', 'Según partida', 'A mano'], 'x-refresh': true },
      monto: { type: 'number', title: 'Monto', 'x-unit': 'S/' },
      partidas: { ...expense.schema.properties!.partidas!, 'x-split': { weights: { mat: 60, mo: 40 }, modeField: 'reparto', weightedValue: 'Según partida' } },
    });
    const fields = formFields(weighted);

    it('the plan carries the hint, and the split the mode and the weights only in the weighted mode', () => {
      expect(splitOf(fields)?.hint).toEqual({ weights: { mat: 60, mo: 40 }, modeField: 'reparto', weightedValue: 'Según partida' });
      expect(splitFor(fields, { monto: 100, reparto: 'Según partida' }, 'partidas')).toMatchObject({ mode: 'Según partida', weights: { mat: 60, mo: 40 } });
      const equal = splitFor(fields, { monto: 100, reparto: 'Partes iguales' }, 'partidas');
      expect(equal?.mode).toBe('Partes iguales');
      expect(equal?.weights).toBeUndefined();
    });

    it('a list without a hint has no mode', () => {
      expect(splitFor(formFields(expense), { monto: 100 }, 'partidas')?.mode).toBeUndefined();
    });
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

describe('sharePercent: a row\'s share of the total in whole percent (design gst-02: «Materiales (60 %)»)', () => {
  it('rounds to the nearest whole percent', () => {
    expect(sharePercent(300, 500)).toBe(60);
    expect(sharePercent(200, 500)).toBe(40);
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
  });

  it('a row of nothing is 0 %, and one that takes more than the total says so', () => {
    expect(sharePercent(0, 500)).toBe(0);
    expect(sharePercent(600, 500)).toBe(120);
  });

  it('has no share without a total or with an amount that is not a number', () => {
    expect(sharePercent(10, 0)).toBeNull();
    expect(sharePercent(10, -5)).toBeNull();
    expect(sharePercent(Number.NaN, 100)).toBeNull();
  });
});
