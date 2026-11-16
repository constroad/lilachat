import { describe, expect, it } from 'vitest';
import { adjustedZone, isCrossedPolygon, planeCornersOf, polygonAreaM2, type PlanePoint } from './zoneAdjust.js';

const square: PlanePoint[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }];
const distanceOf = (corners: readonly PlanePoint[], from: number, to: number) => Math.hypot(corners[to]!.x - corners[from]!.x, corners[to]!.y - corners[from]!.y);

describe('polygonAreaM2', () => {
  it('is the shoelace area, whichever way the corners go round', () => {
    expect(polygonAreaM2(square)).toBe(9);
    expect(polygonAreaM2([...square].reverse())).toBe(9);
  });
});

describe('planeCornersOf: the AR corners laid on their own plane', () => {
  it('keeps every length of a sloped zone (its real size, not its shadow)', () => {
    const sloped = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0.3, z: 3 }, { x: 0, y: 0.3, z: 3 }];
    const flat = planeCornersOf(sloped);

    expect(distanceOf(flat, 0, 1)).toBeCloseTo(2, 9);
    expect(distanceOf(flat, 1, 2)).toBeCloseTo(Math.hypot(0.3, 3), 9);
    expect(flat[0]).toEqual({ x: 0, y: 0 });
    expect(flat[1]!.y).toBeCloseTo(0, 9);
  });
});

describe('adjustedZone: the tape locks a length, the AR corners move as little as they can', () => {
  it('without a tape it is the AR shape as it came', () => {
    const result = adjustedZone(square, []);

    expect(result.areaM2).toBeCloseTo(9, 6);
    expect(result.shiftM).toBeCloseTo(0, 6);
  });

  it('tapes that agree with each other only rescale the drawing (the AR was off in scale)', () => {
    const result = adjustedZone(square, [{ from: 0, to: 1, meters: 3.09 }, { from: 1, to: 2, meters: 3.09 }]);

    expect(result.scale).toBeCloseTo(1.03, 3);
    expect(result.areaM2).toBeCloseTo(3.09 ** 2, 2);
    expect(result.shiftM).toBeLessThan(0.002);
  });

  it('two sides taped differently: each side measures its own tape, the corners move a few centimeters', () => {
    const result = adjustedZone(square, [{ from: 0, to: 1, meters: 3.1 }, { from: 1, to: 2, meters: 2.95 }]);

    expect(distanceOf(result.corners, 0, 1)).toBeCloseTo(3.1, 2);
    expect(distanceOf(result.corners, 1, 2)).toBeCloseTo(2.95, 2);
    expect(result.areaM2).toBeGreaterThan(9);
    expect(result.areaM2).toBeLessThan(9.2);
    expect(result.shiftM).toBeLessThan(0.08);
  });

  it('two tapes on opposite sides cannot stretch the untaped ones (audit 16/11: −22 % in silence)', () => {
    const quad: PlanePoint[] = [{ x: 2.41, y: -0.5 }, { x: 0.5, y: 3.04 }, { x: -2.4, y: 0.41 }, { x: -0.75, y: -2.94 }];
    const tapes = [{ from: 0, to: 1, meters: 4.012 }, { from: 2, to: 3, meters: 3.842 }];
    const result = adjustedZone(quad, tapes);

    expect(Math.abs(distanceOf(result.corners, 1, 2) / distanceOf(quad, 1, 2) - result.scale)).toBeLessThan(0.03);
    expect(result.areaM2 / (polygonAreaM2(quad) * result.scale ** 2)).toBeGreaterThan(0.97);
  });

  it('a triangle taped on its three sides is exact (Heron), whatever the AR said', () => {
    const triangle: PlanePoint[] = [{ x: 0, y: 0 }, { x: 2.6, y: 0 }, { x: 2.68, y: 1.75 }];
    const [a, b, c] = [2.66, 1.71, 3.28];
    const result = adjustedZone(triangle, [{ from: 0, to: 1, meters: a }, { from: 1, to: 2, meters: b }, { from: 2, to: 0, meters: c }]);
    const half = (a + b + c) / 2;

    expect(result.areaM2).toBeCloseTo(Math.sqrt(half * (half - a) * (half - b) * (half - c)), 3);
    expect(result.tapeGapM).toBeLessThan(0.001);
  });

  it('four taped sides the AR cannot hold: the corners move far and it says so', () => {
    const result = adjustedZone(square, [{ from: 0, to: 1, meters: 3 }, { from: 1, to: 2, meters: 3.4 }, { from: 2, to: 3, meters: 3 }, { from: 3, to: 0, meters: 2.6 }]);

    expect(result.shiftM).toBeGreaterThan(0.1);
  });

  it('a taped diagonal fixes the quad: the area comes out of the tapes', () => {
    const skewed: PlanePoint[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3.08, y: 2.94 }, { x: 0.04, y: 3.06 }];
    const truth: PlanePoint[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }];
    const tapes = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]].map(([from, to]) => ({ from: from!, to: to!, meters: distanceOf(truth, from!, to!) }));
    const result = adjustedZone(skewed, tapes);

    expect(result.areaM2).toBeCloseTo(9, 1);
    expect(result.tapeGapM).toBeLessThan(0.003);
  });

  it('a diagonal typed wrong pulls the corners far: the shift shows it', () => {
    const tapes = [0, 1, 2, 3].map((from) => ({ from, to: (from + 1) % 4, meters: 3 }));
    const result = adjustedZone(square, [...tapes, { from: 0, to: 2, meters: 4.84 }]);

    expect(result.shiftM).toBeGreaterThan(0.25);
  });

  it('an L-shaped patch keeps its notch when two sides are taped', () => {
    const shape: PlanePoint[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }];
    const result = adjustedZone(shape, [{ from: 0, to: 1, meters: 3.05 }, { from: 4, to: 5, meters: 1 }]);

    expect(distanceOf(result.corners, 0, 1)).toBeCloseTo(3.05, 2);
    expect(result.areaM2).toBeGreaterThan(4.9);
    expect(result.areaM2).toBeLessThan(5.2);
    expect(result.crossed).toBe(false);
  });

  it('tapes that cannot close a triangle (1 + 0,95 < 2) end far from their tapes', () => {
    const triangle: PlanePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1.9, y: 0.4 }];
    const result = adjustedZone(triangle, [{ from: 0, to: 1, meters: 1 }, { from: 1, to: 2, meters: 0.95 }, { from: 2, to: 0, meters: 2 }]);

    expect(result.tapeGapM > 0.01 || result.crossed || !result.converged).toBe(true);
  });

  it('says when the solved corners fold over themselves', () => {
    expect(isCrossedPolygon([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }])).toBe(true);
    expect(isCrossedPolygon(square)).toBe(false);
  });

  it('a tape between corners that do not exist, or of no length, is ignored', () => {
    const result = adjustedZone(square, [{ from: 0, to: 9, meters: 2 }, { from: 0, to: 1, meters: 0 }, { from: 1, to: 1, meters: 2 }]);

    expect(result.areaM2).toBeCloseTo(9, 6);
  });

  it('never returns a figure that is not a number', () => {
    const result = adjustedZone([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], [{ from: 0, to: 1, meters: 2 }]);

    expect(Number.isFinite(result.areaM2)).toBe(true);
    expect(result.converged).toBe(false);
  });

  it('32 corners solve fast enough for each keypress', () => {
    const ring = Array.from({ length: 32 }, (_, index) => ({ x: 25 * Math.cos((index * 2 * Math.PI) / 32), y: 25 * Math.sin((index * 2 * Math.PI) / 32) }));
    const tapes = ring.map((_, index) => ({ from: index, to: (index + 1) % 32, meters: distanceOf(ring, index, (index + 1) % 32) * 1.01 }));
    const started = performance.now();
    const result = adjustedZone(ring, tapes);

    expect(result.converged).toBe(true);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
