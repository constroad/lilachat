import { describe, expect, it } from 'vitest';
import { indexInRange } from './listIndex.js';

describe('indexInRange', () => {
  it('takes a row the list holds', () => {
    expect(indexInRange(0, 1)).toBe(true);
    expect(indexInRange(4, 5)).toBe(true);
  });
  it('refuses the report of 09/11 and other impossible rows', () => {
    expect(indexInRange(4, 1)).toBe(false);
    expect(indexInRange(0, 0)).toBe(false);
    expect(indexInRange(-1, 3)).toBe(false);
    expect(indexInRange(1.5, 3)).toBe(false);
    expect(indexInRange(Number.NaN, 3)).toBe(false);
  });
});
