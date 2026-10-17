import { describe, expect, it } from 'vitest';
import { sinOcultos } from './ocultos';

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
