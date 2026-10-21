import { describe, expect, it } from 'vitest';
import { DANCES, loopsFor, type PartMotion } from './winkDances.js';

const tracks = (motion: PartMotion) => [motion.rotate, motion.x, motion.y].filter((values): values is readonly number[] => values !== undefined);

/** José, 21/10: «personajes de cuerpo entero que tengan movimiento de cuerpo, no simplemente girarlo». The sketches use them in windows. */
describe('the dances of the wink characters', () => {
  it('every track loops without a jump: it ends where it starts', () => {
    for (const [name, dance] of Object.entries(DANCES)) {
      expect(dance.loopMs, name).toBeGreaterThan(0);
      for (const motion of [dance.whole, ...Object.values(dance.parts)].filter((value): value is PartMotion => value !== undefined)) {
        for (const values of tracks(motion)) {
          expect(values.length, name).toBeGreaterThanOrEqual(2);
          expect(values.at(-1), name).toBe(values[0]);
        }
      }
    }
  });

  it('loops until the wink ends, at least once', () => {
    expect(loopsFor(6500, 2200)).toBe(3);
    expect(loopsFor(6500, 1200)).toBe(6);
    expect(loopsFor(1000, 1200)).toBe(1);
  });
});

describe('dances move around the drawn pose', () => {
  it('every track starts at 0: the rest pose is the drawing, the gag', () => {
    for (const [name, dance] of Object.entries(DANCES)) {
      for (const motion of [dance.whole, ...Object.values(dance.parts)].filter((value): value is PartMotion => value !== undefined)) {
        for (const values of tracks(motion)) expect(values[0], name).toBe(0);
      }
    }
  });
});
