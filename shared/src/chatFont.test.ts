import { describe, expect, it } from 'vitest';
import { CHAT_FONT, CHAT_FONT_CHOICES, parseChatFont } from './chatFont.js';

/** Backlog 1 (José, 20/10): the chat's font size, like WhatsApp: Pequeña · Mediana · Grande. */
describe('chat font size', () => {
  it('three sizes, growing, with Mediana as the bubble has always been (15/21)', () => {
    expect(CHAT_FONT_CHOICES).toEqual(['small', 'medium', 'large']);
    expect(CHAT_FONT.medium).toMatchObject({ size: 15, line: 21, label: 'Mediana' });
    expect(CHAT_FONT.small.size).toBeLessThan(CHAT_FONT.medium.size);
    expect(CHAT_FONT.large.size).toBeGreaterThan(CHAT_FONT.medium.size);
    for (const choice of CHAT_FONT_CHOICES) expect(CHAT_FONT[choice].line).toBeGreaterThan(CHAT_FONT[choice].size);
  });
  it('what was stored: a valid choice, or Mediana for anything else', () => {
    expect(parseChatFont('large')).toBe('large');
    expect(parseChatFont('small')).toBe('small');
    expect(parseChatFont(null)).toBe('medium');
    expect(parseChatFont('huge')).toBe('medium');
    expect(parseChatFont(17)).toBe('medium');
  });
});
