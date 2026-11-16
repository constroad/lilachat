import { describe, expect, it } from 'vitest';
import { arAreaOf, zoneSolutionOf, type ArPoint } from './arArea.js';
import { correctedZone, savedTapesOf, zoneCorrectionOf, zoneGeometryField, zoneGeometryOf, zoneGeometryOfArea, zoneGeometryInput, zoneGeometryString } from './zoneGeometry.js';

const rectangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 1.5 }, { x: 0, y: 0, z: 1.5 }];
const measured = arAreaOf({ points: rectangle, tapes: { 0: 2.05 }, diagonals: [{ from: 0, to: 2, meters: 2.5 }], readingsCm: [], stable: true });

describe('zoneGeometryField: what Portal keeps to correct a zone later', () => {
  it('goes as one JSON string with the corners on the plane, each side and its tape, and the diagonals', () => {
    const field = zoneGeometryField(measured)!;
    const parsed = JSON.parse(field);

    expect(parsed.v).toBe(1);
    expect(parsed.esquinas).toHaveLength(4);
    expect(parsed.lados[0]).toEqual({ arM: 2, winchaM: 2.05 });
    expect(parsed.lados[1]).toEqual({ arM: 1.5 });
    expect(parsed.diagonales).toEqual([{ desde: 0, hasta: 2, winchaM: 2.5 }]);
    expect(field.length).toBeLessThan(4096);
  });

  it('a failed measure has nothing to keep', () => {
    expect(zoneGeometryField(arAreaOf({ points: rectangle.slice(0, 2), tapes: {}, readingsCm: [], stable: true }))).toBeUndefined();
  });
});

describe('zoneGeometryOf: reading it back from Portal', () => {
  it('a round trip recomputes the same area', () => {
    const geometry = zoneGeometryOf(zoneGeometryField(measured))!;
    const input = zoneGeometryInput(geometry);

    expect(input.tapes).toEqual({ 0: 2.05 });
    expect(input.diagonals).toEqual([{ from: 0, to: 2, meters: 2.5 }]);
    expect(geometry.corners).toHaveLength(4);
    expect(zoneSolutionOf(input).areaM2).toBe(measured.areaM2);
  });

  it('takes an object too (Portal may send it parsed)', () => {
    expect(zoneGeometryOf(JSON.parse(zoneGeometryField(measured)!))).not.toBeNull();
  });

  it('refuses anything off its shape: another version, too few corners, sides that do not match, numbers out of range', () => {
    const base = JSON.parse(zoneGeometryField(measured)!);
    expect(zoneGeometryOf({ ...base, v: 2 })).toBeNull();
    expect(zoneGeometryOf({ ...base, esquinas: base.esquinas.slice(0, 2), lados: base.lados.slice(0, 2) })).toBeNull();
    expect(zoneGeometryOf({ ...base, lados: base.lados.slice(0, 3) })).toBeNull();
    expect(zoneGeometryOf({ ...base, lados: [{ arM: 0 }, ...base.lados.slice(1)] })).toBeNull();
    expect(zoneGeometryOf({ ...base, esquinas: [{ x: Number.NaN, y: 0 }, ...base.esquinas.slice(1)] })).toBeNull();
    expect(zoneGeometryOf('{not json')).toBeNull();
    expect(zoneGeometryOf(undefined)).toBeNull();
  });

  it('drops a diagonal between neighbors or off the zone, keeps the rest', () => {
    const base = JSON.parse(zoneGeometryField(measured)!);
    const geometry = zoneGeometryOf({ ...base, diagonales: [{ desde: 0, hasta: 1, winchaM: 2 }, { desde: 0, hasta: 9, winchaM: 2 }, { desde: 1, hasta: 3, winchaM: 2.5 }] })!;
    expect(geometry.diagonals).toEqual([{ from: 1, to: 3, meters: 2.5 }]);
  });
});

describe('zoneGeometryString: Portal v1 is strict', () => {
  it('sends only its keys, and the diagonals only when there are some', () => {
    const plain = arAreaOf({ points: rectangle, tapes: { 0: 2 }, readingsCm: [], stable: true });
    expect(Object.keys(JSON.parse(zoneGeometryField(plain)!)).sort()).toEqual(['esquinas', 'lados', 'v']);
    const reread = zoneGeometryOf({ ...JSON.parse(zoneGeometryField(measured)!), extra: 1 })!;
    expect(Object.keys(JSON.parse(zoneGeometryString(reread)!)).sort()).toEqual(['diagonales', 'esquinas', 'lados', 'v']);
  });

  it('32 corners with every diagonal fit in 4 KB', () => {
    const ring: ArPoint[] = Array.from({ length: 32 }, (_, index) => ({ x: -123.4567 + 50 * Math.cos(index / 5), y: 0, z: -123.4567 + 50 * Math.sin(index / 5) }));
    const many = arAreaOf({ points: ring, tapes: Object.fromEntries(ring.map((_, index) => [index, 9.87])), readingsCm: [], stable: true });
    const geometry = { ...zoneGeometryOfArea(many)!, diagonals: Array.from({ length: 29 }, (_, offset) => ({ from: 0, to: offset + 2, meters: 123.456 })) };
    expect(zoneGeometryString(geometry)).toBeDefined();
  });
});

describe('correctedZone: a side corrected after saving (José 16/11)', () => {
  const saved = zoneGeometryOf(zoneGeometryField(arAreaOf({ points: rectangle, tapes: {}, readingsCm: [], stable: true })))!;

  it('a new tape on a saved zone recomputes it with the same engine as the measure', () => {
    const corrected = correctedZone(saved, { 0: 2.1 }, {});
    const measuredAgain = arAreaOf({ points: rectangle, tapes: { 0: 2.1 }, readingsCm: [], stable: true });

    expect(corrected.solution.areaM2).toBe(measuredAgain.areaM2);
    expect(corrected.geometry.sides[0]).toEqual({ arMeters: 2, tapeMeters: 2.1 });
  });

  it('taking a tape off goes back to the AR, and the diagonals ride along', () => {
    const taped = correctedZone(saved, { 0: 2.1 }, { 2: 2.5 });
    const untaped = correctedZone(taped.geometry, {}, {});

    expect(taped.geometry.diagonals).toEqual([{ from: 0, to: 2, meters: 2.5 }]);
    expect(untaped.solution.areaM2).toBe(3);
    expect(untaped.solution.problems).toEqual(['no-tape']);
  });

  it('starts from the tapes the zone was saved with', () => {
    const withTape = zoneGeometryOf(zoneGeometryField(measured))!;
    expect(savedTapesOf(withTape)).toEqual({ tapes: { 0: 2.05 }, diagonals: { 2: 2.5 } });
  });
});

describe('zoneCorrectionOf: what «Guardar cambios» sends for a corrected zone', () => {
  const saved = zoneGeometryOf(zoneGeometryField(arAreaOf({ points: rectangle, tapes: {}, readingsCm: [], stable: true })))!;

  it('the new area, «AR + wincha», and the geometry with the tape', () => {
    const { correction } = zoneCorrectionOf(saved, { 0: 2.1 }, {});

    expect(correction).toMatchObject({ areaM2: 3.31, method: 'ar-app' });
    expect(JSON.parse(correction!.geometry).lados[0]).toEqual({ arM: 2, winchaM: 2.1 });
  });

  it('a correction the engine refuses sends nothing', () => {
    const { correction, solution } = zoneCorrectionOf(saved, { 0: 2.1, 1: 0.5 }, {});

    expect(solution.problems).toContain('tape-mismatch');
    expect(correction).toBeNull();
  });
});
