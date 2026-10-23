import { describe, expect, it } from 'vitest';
import { WINK_ART, WINK_PROPS, type WinkArt } from './winkArt.js';
import { WINKS } from './winks.js';

const insideBox = (art: WinkArt) => {
  const [, , width = 0, height = 0] = art.viewBox.split(' ').map(Number);
  return { width, height };
};

/** José, 21/10: every wink is a full-body character, not an emoji; the props are drawn the same way. */
describe('the wink characters and props', () => {
  it('every character wink has its drawing (or its prop tile), with both arms, both legs, a body and a head, each with its joint inside the drawing', () => {
    for (const wink of WINKS) {
      if (wink.kind !== 'character') continue;
      // A prop tile (the water balloon) has no body; an art tile (the dog under the rain) is checked like any character.
      if (wink.tile && wink.tile in WINK_PROPS) {
        expect(WINK_PROPS[wink.tile as keyof typeof WINK_PROPS], wink.id).toBeDefined();
        continue;
      }
      const art = WINK_ART[(wink.tile ?? wink.id) as keyof typeof WINK_ART];
      expect(art, wink.id).toBeDefined();
      const names = art.parts.map((part) => part.part);
      for (const needed of ['arm-left', 'arm-right', 'leg-left', 'leg-right', 'body', 'head'] as const) expect(names, `${wink.id} ${needed}`).toContain(needed);
      const box = insideBox(art);
      for (const part of art.parts) {
        expect(part.markup.length, `${wink.id} ${part.part}`).toBeGreaterThan(0);
        expect(part.pivot[0]).toBeGreaterThanOrEqual(0);
        expect(part.pivot[0]).toBeLessThanOrEqual(box.width);
        expect(part.pivot[1]).toBeGreaterThanOrEqual(0);
        expect(part.pivot[1]).toBeLessThanOrEqual(box.height);
      }
    }
  });

  it('the faces that act (the pig, the galán, the coffee) have eyes and a mouth riding on the head, and the galán holds his rose apart', () => {
    for (const id of ['piggy', 'piggy-back', 'sweetheart', 'cuppa'] as const) {
      const face = WINK_ART[id].parts.filter((part) => part.parent === 'head').map((part) => part.part);
      expect(face, id).toEqual(expect.arrayContaining(['eye-left', 'eye-right', 'mouth']));
    }
    expect(WINK_ART.sweetheart.parts.find((part) => part.part === 'held')).toMatchObject({ parent: 'arm-right' });
  });

  it('seen from behind, the pig shows its tail on top of everything', () => {
    expect(WINK_ART['piggy-back'].parts.at(-1)?.part).toBe('tail');
  });

  it('a parent is always drawn before the parts riding on it', () => {
    for (const [id, art] of Object.entries(WINK_ART)) {
      art.parts.forEach((part, index) => {
        if (part.parent) expect(art.parts.findIndex((other) => other.part === part.parent), `${id} ${part.part}`).toBeLessThan(index);
      });
    }
  });

  it('nothing outside plain vector shapes: no images, scripts or links', () => {
    for (const art of [...Object.values(WINK_ART), ...Object.values(WINK_PROPS)]) {
      for (const part of art.parts) expect(part.markup).not.toMatch(/<(image|script|foreignObject|a)\b|href=|\son\w+=/i);
    }
  });
});
