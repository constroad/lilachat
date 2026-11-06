import { describe, expect, it } from 'vitest';
import { CARD_MAX_WIDTH, cardWidthOf } from './cardWidth';

describe('a card fits the row with air on the right (José 06/11: «se están pegando mucho al lado derecho»)', () => {
  it('a phone gives it what is left after the avatar and the right margin', () => {
    expect(cardWidthOf(392)).toBe(304);
    expect(cardWidthOf(360)).toBe(272);
  });

  it('a tablet or a turned phone keeps the card at its usual size', () => {
    expect(cardWidthOf(800)).toBe(CARD_MAX_WIDTH);
  });

  it('a very narrow window still leaves a card that can be read', () => {
    expect(cardWidthOf(240)).toBe(200);
  });
});
