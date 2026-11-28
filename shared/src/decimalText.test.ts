import { describe, expect, it } from 'vitest';
import { cleanDecimalText, decimalOf, decimalTextFollows } from './decimalText.js';

describe('cleanDecimalText', () => {
  it('keeps a trailing separator so the person can go on typing «3.»', () => {
    expect(cleanDecimalText('3.')).toBe('3.');
    expect(cleanDecimalText('3,')).toBe('3,');
  });

  it('drops letters and a second separator', () => {
    expect(cleanDecimalText('3.1.0')).toBe('3.10');
    expect(cleanDecimalText('a3,5m')).toBe('3,5');
  });
});

describe('decimalOf', () => {
  it('reads a comma or a dot as the decimal separator', () => {
    expect(decimalOf('3,10')).toBe(3.1);
    expect(decimalOf('3.10')).toBe(3.1);
  });

  it('is null for an empty field or a bare separator', () => {
    expect(decimalOf('')).toBeNull();
    expect(decimalOf('  ')).toBeNull();
    expect(decimalOf('.')).toBeNull();
  });
});

describe('decimalTextFollows', () => {
  it('keeps what is typed while it still means the stored value', () => {
    expect(decimalTextFollows('3.', 3)).toBe('3.');
    expect(decimalTextFollows('3.10', 3.1)).toBe('3.10');
  });

  it('takes the stored value when it changed from outside', () => {
    expect(decimalTextFollows('3.1', null)).toBe('');
    expect(decimalTextFollows('3.1', 6)).toBe('6');
  });
});
