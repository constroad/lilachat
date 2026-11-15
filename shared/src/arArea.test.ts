import { describe, expect, it } from 'vitest';
import { arAimLine, arAreaFigures, arAreaOf, arPlanOf, arProblemLine, type ArPoint } from './arArea.js';

/** A flat 2 m × 1,5 m rectangle on the floor (ARCore: y is up, meters). */
const rectangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 1.5 }, { x: 0, y: 0, z: 1.5 }];
const base = { points: rectangle, tapes: {}, readingsCm: [], stable: true };

describe('arAreaOf: what saves', () => {
  it('one taped side fixes the scale of every side; the area comes out of the shape', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2 } });

    expect(result.areaM2).toBe(3);
    expect(result.sides.map((side) => [side.meters, side.source])).toEqual([[2, 'wincha'], [1.5, 'escala'], [2, 'escala'], [1.5, 'escala']]);
    expect(result.problems).toEqual([]);
    expect(result.canSave).toBe(true);
  });

  it('the same area whichever way the corners go round', () => {
    expect(arAreaOf({ ...base, points: [...rectangle].reverse(), tapes: { 0: 1.5 } }).areaM2).toBe(3);
  });

  it('a sloped street: the area is the one on the ground, not its shadow on a level floor', () => {
    const slope = 0.1;
    const sloped = rectangle.map((point) => ({ ...point, y: point.z * slope }));
    const result = arAreaOf({ ...base, points: sloped, tapes: { 0: 2 } });

    expect(result.areaM2).toBe(Math.round(2 * 1.5 * Math.hypot(1, slope) * 100) / 100);
    expect(result.problems).toEqual([]);
  });

  it('an L-shaped patch (concave) adds only what is inside', () => {
    const shape: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }];
    expect(arAreaOf({ ...base, points: shape, tapes: { 0: 3 } }).areaM2).toBe(5);
  });

  it('a triangle is enough', () => {
    const triangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }];
    expect(arAreaOf({ ...base, points: triangle, tapes: { 0: 2 } }).areaM2).toBe(2);
  });

  it('rounds the area once, from the unrounded shape', () => {
    const odd: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 1.234, y: 0, z: 0 }, { x: 1.234, y: 0, z: 1.111 }, { x: 0, y: 0, z: 1.111 }];
    expect(arAreaOf({ ...base, points: odd, tapes: { 0: 1.234 } }).areaM2).toBe(1.37);
  });

  it('the thickness readings give the volume (between 1 and 50 cm)', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2 }, readingsCm: [5, 5.5, 60] });

    expect(result.thicknessCm).toBe(5.3);
    expect(result.volumeM3).toBe(0.159);
  });
});

describe('arAreaOf: the tape against the AR (José 15/11: 3 % warns, 15 % blocks)', () => {
  it('within 3 % the side is fine and the tape still wins', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2.04 } });

    expect(result.sides[0]).toMatchObject({ meters: 2.04, source: 'wincha', flag: 'ok' });
    expect(result.areaM2).toBe(Math.round(3 * 1.02 ** 2 * 100) / 100);
  });

  it('over 3 %: «AR y wincha no coinciden · manda la wincha», and it can still be saved', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2.2 } });

    expect(result.sides[0]).toMatchObject({ meters: 2.2, flag: 'warn' });
    expect(result.areaM2).toBe(3.63);
    expect(result.canSave).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('over 15 % it does not save: the wrong side was taped', () => {
    const result = arAreaOf({ ...base, tapes: { 1: 2 } });

    expect(result.sides[1]).toMatchObject({ flag: 'block' });
    expect(result.problems).toContain('tape-mismatch');
    expect(result.canSave).toBe(false);
  });

  it('centimeters typed as meters is caught and said', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 200 } });

    expect(result.sides[0]).toMatchObject({ flag: 'block', centimeters: true });
    expect(result.canSave).toBe(false);
  });

  it('two taped sides: the scale is their mean, each keeps its own tape', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2.08, 1: 1.56 } });

    expect(result.sides.map((side) => side.meters)).toEqual([2.08, 1.56, 2.08, 1.56]);
    expect(result.areaM2).toBe(3.24);
  });

  it('without a taped side it shows the AR figure but does not save', () => {
    const result = arAreaOf(base);

    expect(result.areaM2).toBe(3);
    expect(result.problems).toEqual(['no-tape']);
    expect(result.canSave).toBe(false);
  });

  it('a tape on a side that does not exist is ignored', () => {
    expect(arAreaOf({ ...base, tapes: { 7: 2 } }).problems).toEqual(['no-tape']);
  });
});

describe('arAreaOf: what never saves', () => {
  it('fewer than three corners', () => {
    const result = arAreaOf({ ...base, points: rectangle.slice(0, 2), tapes: { 0: 2 } });

    expect(result.problems).toContain('few-corners');
    expect(result.areaM2).toBeNull();
    expect(result.canSave).toBe(false);
  });

  it('crossed corners (a bow tie)', () => {
    const bowTie = [rectangle[0]!, rectangle[2]!, rectangle[1]!, rectangle[3]!];
    expect(arAreaOf({ ...base, points: bowTie, tapes: { 1: 1.5 } }).problems).toContain('crossed');
  });

  it('the same corner marked twice (a side under 10 cm)', () => {
    const twice = [rectangle[0]!, { x: 0.03, y: 0, z: 0 }, ...rectangle.slice(1)];
    expect(arAreaOf({ ...base, points: twice, tapes: { 1: 1.97 } }).problems).toContain('short-side');
  });

  it('a corner off the floor (on a wall, a curb, a car)', () => {
    const lifted = rectangle.map((point, index) => (index === 2 ? { ...point, y: 0.25 } : point));
    expect(arAreaOf({ ...base, points: lifted, tapes: { 0: 2 } }).problems).toContain('off-plane');
  });

  it('the AR lost its place while measuring: the corners may have moved', () => {
    expect(arAreaOf({ ...base, tapes: { 0: 2 }, stable: false }).problems).toContain('tracking-lost');
  });

  it('under 0,05 m² or over 5 000 m² (Portal\'s limits)', () => {
    const tiny = rectangle.map((point) => ({ x: point.x / 10, y: 0, z: point.z / 10 }));
    const huge = rectangle.map((point) => ({ x: point.x * 50, y: 0, z: point.z * 50 }));
    expect(arAreaOf({ ...base, points: tiny, tapes: { 0: 0.2 } }).problems).toContain('too-small');
    expect(arAreaOf({ ...base, points: huge, tapes: { 0: 100 } }).problems).toContain('too-large');
  });

  it('a point that is not a number never makes a figure', () => {
    const broken = rectangle.map((point, index) => (index === 1 ? { ...point, x: Number.NaN } : point));
    const result = arAreaOf({ ...base, points: broken, tapes: { 0: 2 } });
    expect(result.canSave).toBe(false);
    expect(result.areaM2).toBeNull();
  });
});

describe('arAreaFigures and the lines', () => {
  it('what Portal gets: the area alone and the thickness', () => {
    const figures = arAreaFigures(arAreaOf({ ...base, tapes: { 0: 2 }, readingsCm: [5] }));
    expect(figures).toMatchObject({ areaM2: 3, thicknessCm: 5, volumeM3: 0.15, line: '3,00 m² · 0,150 m³' });
  });

  it('every problem has a line for the person', () => {
    for (const problem of ['few-corners', 'short-side', 'crossed', 'off-plane', 'tracking-lost', 'too-small', 'too-large', 'no-tape', 'tape-mismatch'] as const) {
      expect(arProblemLine(problem).length).toBeGreaterThan(10);
    }
  });
});

describe('arPlanOf: the plan from above (la-03)', () => {
  it('fits the zone in the box keeping its proportions, with a margin', () => {
    const plan = arPlanOf(rectangle, { width: 300, height: 200 }, 20);
    const xs = plan.map((point) => point.x);
    const ys = plan.map((point) => point.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...xs)).toBeLessThanOrEqual(280);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...ys)).toBeLessThanOrEqual(180);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    expect(width / height).toBeCloseTo(2 / 1.5, 5);
  });

  it('nothing to draw with fewer than two corners or a broken point', () => {
    expect(arPlanOf(rectangle.slice(0, 1), { width: 100, height: 100 }, 10)).toEqual([]);
    expect(arPlanOf([rectangle[0]!, { x: Number.NaN, y: 0, z: 0 }], { width: 100, height: 100 }, 10)).toEqual([]);
  });
});

describe('arAimLine: what la-02 tells the person', () => {
  it('guides by what the AR sees, in order', () => {
    expect(arAimLine({ state: 'searching', floor: false }, 0)).toMatch(/Mueve el teléfono/);
    expect(arAimLine({ state: 'tracking', floor: false }, 0)).toMatch(/Apunta al piso/);
    expect(arAimLine({ state: 'tracking', floor: true, distance: 7.5 }, 1)).toMatch(/Acércate/);
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2 }, 0)).toBe('Apunta a la esquina 1');
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2 }, 3)).toBe('Apunta a la esquina 4 o toca «Cerrar»');
  });
});
