import { describe, expect, it } from 'vitest';
import { arAimLine, arAreaFigures, arAreaOf, arLiveLabel, arPlanOf, arProblemLine, arScanProgress, closedRing, isArWarning, visibleRuns, type ArPoint } from './arArea.js';

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

  it('the scale weighs each taped side by its length: a short side cannot swing the whole zone', () => {
    const square: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0.5 }, { x: 0, y: 0, z: 0.5 }];
    const result = arAreaOf({ ...base, points: square, tapes: { 0: 5, 1: 0.55 } });
    expect(result.areaM2).toBe(Math.round(2.5 * (5.55 / 5.5) ** 2 * 100) / 100);
  });

  it('two taped sides that disagree with each other by more than 15 % do not save', () => {
    const square: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 5 }, { x: 0, y: 0, z: 5 }];
    const result = arAreaOf({ ...base, points: square, tapes: { 0: 5.7, 1: 4.4 } });
    expect(result.problems).toContain('tape-mismatch');
    expect(result.canSave).toBe(false);
  });

  it('two taped sides: the scale is their mean, each keeps its own tape', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2.08, 1: 1.56 } });

    expect(result.sides.map((side) => side.meters)).toEqual([2.08, 1.56, 2.08, 1.56]);
    expect(result.areaM2).toBe(3.24);
  });

  it('without a taped side it saves the AR figure and only warns (José 15/11: «en plena obra no se va a estar validando»)', () => {
    const result = arAreaOf(base);

    expect(result.areaM2).toBe(3);
    expect(result.problems).toEqual(['no-tape']);
    expect(isArWarning('no-tape')).toBe(true);
    expect(result.canSave).toBe(true);
  });

  it('a tape on a side that does not exist is ignored', () => {
    expect(arAreaOf({ ...base, tapes: { 7: 2 } }).problems).toEqual(['no-tape']);
  });
});

describe('arAreaOf: what never saves (and what only warns)', () => {
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

  it('a corner on a non-neighbor side, or a spike that comes back, never saves', () => {
    const onSide: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 5 }, { x: 2.5, y: 0, z: 0.02 }];
    const spike: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 3 }, { x: 6, y: 0, z: 3.05 }, { x: 4.2, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }];
    expect(arAreaOf({ ...base, points: onSide, tapes: { 0: 5 } }).problems).toContain('degenerate');
    expect(arAreaOf({ ...base, points: spike, tapes: { 0: 4 } }).problems).toContain('degenerate');
  });

  it('a corner that landed on another level (a curb top, a car roof), even in a triangle', () => {
    const triangle: ArPoint[] = [{ x: 0, y: 0, z: 0, floorY: 0 }, { x: 4, y: 0, z: 0, floorY: 0 }, { x: 0, y: 0.16, z: 4, floorY: 0.16 }];
    expect(arAreaOf({ ...base, points: triangle, tapes: { 0: 4 } }).problems).toContain('off-plane');
  });

  it('a corner off the floor (on a wall, a curb, a car) warns but saves; with a real fault it still does not', () => {
    const lifted = rectangle.map((point, index) => (index === 2 ? { ...point, y: 0.25 } : point));
    const result = arAreaOf({ ...base, points: lifted, tapes: { 0: 2 } });
    expect(result.problems).toContain('off-plane');
    expect(result.canSave).toBe(true);
    expect(arAreaOf({ ...base, points: lifted, tapes: { 0: 2 }, stable: false }).canSave).toBe(false);
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
    for (const problem of ['few-corners', 'short-side', 'crossed', 'degenerate', 'off-plane', 'tracking-lost', 'too-small', 'too-large', 'no-tape', 'tape-mismatch'] as const) {
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
    expect(arAimLine({ state: 'tracking', floor: false, floorM2: 2 }, 0)).toMatch(/Apunta al piso/);
    expect(arAimLine({ state: 'tracking', floor: true, distance: 7.5 }, 1)).toMatch(/Acércate/);
  });
});

describe('visibleRuns', () => {
  const at = (x: number, visible = true) => ({ x, y: 0, visible });

  it('draws every side when all the corners are on screen', () => {
    expect(visibleRuns([at(1), at(2), at(3)])).toEqual([[at(1), at(2), at(3)]]);
  });

  it('splits the sides at a corner behind the camera and drops a lone corner', () => {
    expect(visibleRuns([at(1), at(2), at(0, false), at(4), at(5, false), at(6)])).toEqual([[at(1), at(2)]]);
    expect(visibleRuns([at(1), at(0, false), at(3), at(4)])).toEqual([[at(3), at(4)]]);
  });

  it('draws nothing with fewer than two visible corners', () => {
    expect(visibleRuns([])).toEqual([]);
    expect(visibleRuns([at(1), at(0, false)])).toEqual([]);
  });
});

describe('closedRing (José 15/11: a 5th corner on the 1st closed the zone by hand)', () => {
  const square: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }];

  it('drops a last corner marked on top of the first: it closes, it is not a side', () => {
    expect(closedRing([...square, { x: 0.03, y: 0, z: 0.02 }])).toEqual(square);
  });

  it('uses the same 15 cm on the floor as the native snap: a corner tapped 12 cm off the first still closes', () => {
    expect(closedRing([...square, { x: 0.12, y: 0.05, z: 0 }])).toEqual(square);
    expect(closedRing([...square, { x: 0.16, y: 0, z: 0 }])).toHaveLength(5);
  });

  it('keeps every corner when the last one is a real corner', () => {
    expect(closedRing(square)).toEqual(square);
    expect(closedRing([...square, { x: -0.5, y: 0, z: 0.5 }])).toHaveLength(5);
  });

  it('never drops below three corners', () => {
    const triangle = square.slice(0, 3);
    expect(closedRing([...triangle.slice(0, 2), { x: 0.02, y: 0, z: 0 }])).toHaveLength(3);
  });
});

describe('the scan and the aim (José 15/11: scan first, tap the screen, close on the first corner)', () => {
  it('fills the scan up to one square meter of floor', () => {
    expect(arScanProgress(undefined)).toBe(0);
    expect(arScanProgress(0.25)).toBe(0.25);
    expect(arScanProgress(4)).toBe(1);
    expect(arScanProgress(-1)).toBe(0);
  });

  it('asks to scan before the first corner, then to tap the screen', () => {
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2, floorM2: 0.3 }, 0)).toBe('Mueve el teléfono despacio sobre el piso para escanearlo.');
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2, floorM2: 1.2 }, 0)).toBe('Toca la pantalla para marcar la esquina 1');
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2, floorM2: 1.2 }, 3)).toBe('Toca para marcar la esquina 4, o apunta a la 1 para cerrar');
  });

  it('with the zone closed in the AR, asks to confirm or undo (José 15/11: like his reference app)', () => {
    expect(arAimLine({ state: 'tracking', floor: false, closed: true }, 4)).toBe('Zona cerrada: revisa el contorno y toca «Listo», o «Deshacer» para corregir.');
  });

  it('says it closes when the aim snapped to the first corner', () => {
    expect(arAimLine({ state: 'tracking', floor: true, distance: 2, floorM2: 2, closing: true }, 4)).toBe('Toca para cerrar la zona');
  });

  it('writes the live length in meters with a comma', () => {
    expect(arLiveLabel(1.384)).toBe('1,38 m');
    expect(arLiveLabel(null)).toBeNull();
  });
});
