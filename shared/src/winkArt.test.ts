import { describe, expect, it } from 'vitest';
import { WINK_ART } from './winkArt.js';
import { WINKS } from './winks.js';

/** José, 21/10: every wink is a full-body character, not an emoji. */
describe('the wink characters', () => {
  it('every character wink has its drawing, with both arms, both legs, a body and a head, each with its joint inside the drawing', () => {
    for (const wink of WINKS) {
      if (wink.kind !== 'character') continue;
      const art = WINK_ART[wink.id];
      expect(art, wink.id).toBeDefined();
      const names = art!.parts.map((part) => part.part);
      for (const needed of ['arm-left', 'arm-right', 'leg-left', 'leg-right', 'body', 'head'] as const) expect(names, `${wink.id} ${needed}`).toContain(needed);
      for (const part of art!.parts) {
        expect(part.markup.length, `${wink.id} ${part.part}`).toBeGreaterThan(0);
        expect(part.pivot[0]).toBeGreaterThanOrEqual(0);
        expect(part.pivot[0]).toBeLessThanOrEqual(240);
        expect(part.pivot[1]).toBeGreaterThanOrEqual(0);
        expect(part.pivot[1]).toBeLessThanOrEqual(320);
      }
    }
  });

  it('nothing outside plain vector shapes: no images, scripts or links', () => {
    for (const art of Object.values(WINK_ART)) {
      for (const part of art!.parts) expect(part.markup).not.toMatch(/<(image|script|foreignObject|a)\b|href=/i);
    }
  });
});
