import { describe, expect, it } from 'vitest';
import { mergeHidden, sinOcultos } from './hiddenRows';

/** «Eliminar para mí» (FL9): se oculta en ESTE teléfono, el resto lo sigue viendo. */
describe('sinOcultos', () => {
  it('saca los ocultos y deja lo pendiente (no tiene seq todavía)', () => {
    const filas = [{ seq: 1 }, { seq: 2 }, { clientKey: 'p1' }, { seq: 3 }];

    expect(sinOcultos(filas, new Set([2]))).toEqual([{ seq: 1 }, { clientKey: 'p1' }, { seq: 3 }]);
  });

  it('sin ocultos devuelve la MISMA lista (no rompe la memoización)', () => {
    const filas = [{ seq: 1 }];

    expect(sinOcultos(filas, new Set())).toBe(filas);
  });
});

/** What another device of mine hid comes from the server (José, 13/11). */
describe('mergeHidden', () => {
  it('adds what is new and keeps the SAME set when nothing is (no extra render)', () => {
    const current = new Set([2, 5]);

    expect([...mergeHidden(current, [5, 9])].sort((a, b) => a - b)).toEqual([2, 5, 9]);
    expect(mergeHidden(current, [2, 5])).toBe(current);
    expect(mergeHidden(current, [])).toBe(current);
  });
});
