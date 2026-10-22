import { describe, expect, it } from 'vitest';
import { followsMyNewRow } from './followMine';

describe('followsMyNewRow (José, 22/10)', () => {
  it('a new last row of mine takes the list down', () => {
    expect(followsMyNewRow(null, 'k2')).toBe(true);
    expect(followsMyNewRow('k1', 'k2')).toBe(true);
  });

  it('opening the chat, the same row, someone else\'s or an empty chat does not', () => {
    expect(followsMyNewRow(undefined, 'k1')).toBe(false);
    expect(followsMyNewRow('k2', 'k2')).toBe(false);
    expect(followsMyNewRow('k2', null)).toBe(false);
    expect(followsMyNewRow('k2', undefined)).toBe(false);
  });
});
