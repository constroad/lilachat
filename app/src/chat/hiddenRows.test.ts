import { describe, expect, it } from 'vitest';
import { mergeHidden, withoutHidden } from './hiddenRows';

/** «Eliminar para mí» (FL9): hidden on THIS phone, everyone else still sees it. */
describe('withoutHidden', () => {
  it('drops the hidden ones and keeps the pending (no seq yet)', () => {
    const rows = [{ seq: 1 }, { seq: 2 }, { clientKey: 'p1' }, { seq: 3 }];

    expect(withoutHidden(rows, new Set([2]))).toEqual([{ seq: 1 }, { clientKey: 'p1' }, { seq: 3 }]);
  });

  it('with nothing hidden it returns the SAME list (memoization holds)', () => {
    const rows = [{ seq: 1 }];

    expect(withoutHidden(rows, new Set())).toBe(rows);
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
