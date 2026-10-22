import { describe, expect, it } from 'vitest';
import { winkPlayKey } from './winkPlay';

describe('winkPlayKey', () => {
  it('two previews in a row (same seed) get different keys, so the second one animates from the start', () => {
    // Arrange
    const first = { seq: 0, run: 1 };
    const second = { seq: 0, run: 2 };
    // Act
    const keys = [winkPlayKey(first), winkPlayKey(second)];
    // Assert
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('«Ver otra vez» on the same message twice also restarts it', () => {
    expect(winkPlayKey({ seq: 42, run: 7 })).not.toBe(winkPlayKey({ seq: 42, run: 8 }));
  });

  it('the same run keeps its key across renders (no restart mid-animation)', () => {
    expect(winkPlayKey({ seq: 42, run: 7 })).toBe(winkPlayKey({ seq: 42, run: 7 }));
  });
});
