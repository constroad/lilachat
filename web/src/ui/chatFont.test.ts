import { describe, expect, it } from 'vitest';
import { chatFontPixels, readChatFont } from './chatFont';

describe('chat font on the web', () => {
  it('one pixel under the app: Mediana stays the 14 px bubble it was', () => {
    expect(chatFontPixels('medium')).toEqual({ size: 14, line: 20 });
    expect(chatFontPixels('large').size).toBe(16);
  });
  it('what this browser stored, or Mediana (also when storage throws)', () => {
    expect(readChatFont({ getItem: () => 'small' })).toBe('small');
    expect(readChatFont({ getItem: () => 'otra' })).toBe('medium');
    expect(readChatFont({ getItem: () => { throw new Error('bloqueado'); } })).toBe('medium');
  });
});
