import { describe, expect, it } from 'vitest';
import { arCornerName, arDiagonalRows, arAimLine, arAreaFigures, arAreaOf, arMethodOf, arPerimeterM, arShotLabels, arSummaryChips, arLiveChips, arShotPanel, shotPanelField, shotPanelOf, shotLabelsField, shotLabelsOf, arLiveLabel, arPlanOf, arProblemLine, arScanProgress, closedRing, isArWarning, visibleRuns, type ArPoint } from './arArea.js';

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

  it('each taped side keeps its tape (José 16/11); the corners no tape touched stay where the AR put them', () => {
    const strip: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0.5 }, { x: 0, y: 0, z: 0.5 }];
    const result = arAreaOf({ ...base, points: strip, tapes: { 0: 5, 1: 0.55 } });

    expect(result.sides.map((side) => [side.meters, side.source])).toEqual([[5, 'wincha'], [0.55, 'wincha'], [5.01, 'escala'], [0.5, 'escala']]);
    expect(result.areaM2).toBeGreaterThan(2.6);
    expect(result.areaM2).toBeLessThan(2.65);
    expect(result.problems).toEqual([]);
  });

  it('two tapes on opposite sides do not stretch the untaped ones (audit 16/11)', () => {
    const quad: ArPoint[] = [[2.41, -0.5], [0.5, 3.04], [-2.4, 0.41], [-0.75, -2.94]].map(([x, z]) => ({ x: x!, y: 0, z: z! }));
    const result = arAreaOf({ ...base, points: quad, tapes: { 0: 4.012, 2: 3.842 } });

    expect(result.areaM2! / 14.95).toBeGreaterThan(0.97);
    expect(result.areaM2! / 14.95).toBeLessThan(1.03);
  });

  it('a square whose sides and diagonal disagree with the AR does not save; a diagonal typed wrong is flagged (audit 16/11)', () => {
    const square: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }];
    const sides = { 0: 2.6, 1: 2.6, 2: 2.6, 3: 2.6 };
    const typo = { 0: 3, 1: 3, 2: 3, 3: 3 };

    expect(arAreaOf({ ...base, points: square, tapes: sides, diagonals: [{ from: 0, to: 2, meters: 4.84 }] }).canSave).toBe(false);
    expect(arAreaOf({ ...base, points: square, tapes: typo, diagonals: [{ from: 0, to: 2, meters: 4.84 }] }).problems).toEqual(['tape-bends']);
  });

  it('a large zone taped exactly saves: the AR drifts with distance (audit 16/11: a 36 m zone was blocked)', () => {
    const quad: ArPoint[] = [[17.912, -2.397], [-2.641, 13.141], [-17.888, -0.866], [-0.246, -13.41]].map(([x, z]) => ({ x: x!, y: 0, z: z! }));
    const result = arAreaOf({ ...base, points: quad, tapes: { 0: 25.835, 1: 20.786, 2: 21.612, 3: 21.261 }, diagonals: [{ from: 0, to: 2, meters: 35.939 }] });

    expect(result.canSave).toBe(true);
    expect(result.areaM2! / 474.21).toBeCloseTo(1, 2);
  });

  it('one short tape scales the whole zone: it saves but asks for the longest side', () => {
    const block: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, { x: 6, y: 0, z: 5 }, { x: 0.5, y: 0, z: 5 }, { x: 0, y: 0, z: 4.5 }];
    const result = arAreaOf({ ...base, points: block, tapes: { 3: 0.72 } });

    expect(result.problems).toEqual(['tape-short']);
    expect(result.canSave).toBe(true);
  });

  it('a diagonal along a straight edge is not offered: a millimeter of tape would move the area', () => {
    const notched: ArPoint[] = [[0, 0], [3, -0.02], [6, 0], [6, 2], [0, 2]].map(([x, z]) => ({ x: x!, y: 0, z: z! }));
    expect(arDiagonalRows(arAreaOf({ ...base, points: notched })).map((row) => row.label)).toEqual(['Diagonal A–D']);
  });

  it('a taped triangle is exact: Heron, not the AR (José 15/11: 2,66 · 1,71 · 3,28)', () => {
    const triangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2.6, y: 0, z: 0 }, { x: 2.68, y: 0, z: 1.75 }];
    const result = arAreaOf({ ...base, points: triangle, tapes: { 0: 2.66, 1: 1.71, 2: 3.28 } });

    expect(result.areaM2).toBe(2.27);
    expect(result.problems).toEqual([]);
  });

  it('a taped diagonal fixes a quad whose four sides were taped', () => {
    const skewed: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 3.05, y: 0, z: 2.95 }, { x: 0.05, y: 0, z: 3.05 }];
    const result = arAreaOf({ ...base, points: skewed, tapes: { 0: 3, 1: 3, 2: 3, 3: 3 }, diagonals: [{ from: 0, to: 2, meters: Math.hypot(3, 3) }] });

    expect(result.areaM2).toBe(9);
    expect(result.diagonals).toEqual([expect.objectContaining({ from: 0, to: 2, flag: 'ok' })]);
    expect(result.problems).toEqual([]);
  });

  it('four taped sides the AR angles cannot hold: it saves but asks for a diagonal', () => {
    const square: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }];
    const result = arAreaOf({ ...base, points: square, tapes: { 0: 3, 1: 3.3, 2: 3, 3: 2.9 } });

    expect(result.problems).toEqual(['tape-bends']);
    expect(isArWarning('tape-bends')).toBe(true);
    expect(result.canSave).toBe(true);
  });

  it('tapes that cannot close any zone (1 + 0,95 is shorter than 2) do not save', () => {
    const triangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1.9, y: 0, z: 0.4 }];
    const result = arAreaOf({ ...base, points: triangle, tapes: { 0: 1, 1: 0.95, 2: 2 } });

    expect(result.problems).toContain('tape-contradicts');
    expect(result.canSave).toBe(false);
  });

  it('keeps the AR corners laid on their plane, to correct the zone later', () => {
    const result = arAreaOf({ ...base, tapes: { 0: 2 } });

    expect(result.plane.map(({ x, y }) => [Math.round(x * 1000) / 1000, Math.abs(Math.round(y * 1000) / 1000)])).toEqual([[0, 0], [2, 0], [2, 1.5], [0, 1.5]]);
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

  it('a zone with no taped side goes as «AR»; one with a tape, as «AR + wincha» (José 15/11)', () => {
    expect(arMethodOf(arAreaOf({ ...base, tapes: {}, readingsCm: [] }))).toBe('ar');
    expect(arMethodOf(arAreaOf({ ...base, tapes: { 0: 2 }, readingsCm: [] }))).toBe('ar-app');
  });

  it('a tape that blocks still says the zone was taped', () => {
    expect(arMethodOf(arAreaOf({ ...base, tapes: { 0: 9 }, readingsCm: [] }))).toBe('ar-app');
  });

  it('every problem has a line for the person', () => {
    for (const problem of ['few-corners', 'short-side', 'crossed', 'degenerate', 'off-plane', 'tracking-lost', 'too-small', 'too-large', 'no-tape', 'tape-mismatch', 'tape-bends', 'tape-contradicts', 'tape-short'] as const) {
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

describe('the photo\'s meters (José 15/11: «no se muestra el metraje», like his reference app)', () => {
  const side = (index: number, meters: number) => ({ index, arMeters: meters, meters, source: 'escala' as const, flag: 'ok' as const });
  const corners = [{ x: 100, y: 100, visible: true }, { x: 300, y: 100, visible: true }, { x: 300, y: 500, visible: true }, { x: 100, y: 500, visible: true }];

  it('each side\'s final meters at its middle, as fractions of the frame', () => {
    expect(arShotLabels(corners, { width: 400, height: 1000 }, [side(0, 0.8), side(1, 0.85), side(2, 0.67), side(3, 0.62)])).toEqual([
      { x: 0.5, y: 0.1, text: '1 · 0,80 m' }, { x: 0.75, y: 0.3, text: '2 · 0,85 m' }, { x: 0.5, y: 0.5, text: '3 · 0,67 m' }, { x: 0.25, y: 0.3, text: '4 · 0,62 m' },
    ]);
  });

  it('José 16/11, five corners with one off the photo: every side keeps its meters, on the part of it that shows', () => {
    // Corner 3 (between sides 2 and 3) fell to the right of the frame, as in his living-room test.
    const five = [{ x: 100, y: 400, visible: true }, { x: 300, y: 400, visible: true }, { x: 500, y: 500, visible: false }, { x: 250, y: 600, visible: true }, { x: 50, y: 550, visible: true }];
    const labels = arShotLabels(five, { width: 400, height: 1000 }, [side(0, 2.32), side(1, 1.5), side(2, 1.2), side(3, 0.93), side(4, 1.42)]);

    expect(labels.map((label) => label.text)).toEqual(['1 · 2,32 m', '2 · 1,50 m', '3 · 1,20 m', '4 · 0,93 m', '5 · 1,42 m']);
    // Side 2 runs from (300,400) out to (500,500): its visible part ends at x=400, so its middle is at x=350.
    expect(labels[1]).toMatchObject({ x: 0.875, y: 0.425 });
    // Side 3 comes back from (500,500) to (250,600): it enters the frame at x=400; the middle of what shows is x=325.
    expect(labels[2]).toMatchObject({ x: 0.8125, y: 0.57 });
    expect(labels.every((label) => label.x >= 0 && label.x <= 1 && label.y >= 0 && label.y <= 1)).toBe(true);
  });

  it('a side wholly off the photo still writes its meters, at the edge nearest to it', () => {
    const outside = [{ x: 100, y: 100, visible: true }, { x: 300, y: 100, visible: true }, { x: 600, y: 300, visible: false }, { x: 700, y: 600, visible: false }, { x: 100, y: 500, visible: true }];
    const labels = arShotLabels(outside, { width: 400, height: 1000 }, [side(0, 1), side(1, 1), side(2, 1), side(3, 1), side(4, 1)]);

    expect(labels.map((label) => label.text)).toHaveLength(5);
    expect(labels[2]).toMatchObject({ x: 1, y: 0.45 });
  });

  it('a corner behind the camera has no place on the photo: its sides go at the corner that shows', () => {
    const behind = arShotLabels([...corners.slice(0, 3), { x: 0, y: 0, visible: false }], { width: 400, height: 1000 }, [side(0, 1), side(1, 1), side(2, 1), side(3, 1)]);

    expect(behind.map((label) => label.text)).toEqual(['1 · 1,00 m', '2 · 1,00 m', '3 · 1,00 m', '4 · 1,00 m']);
    expect(behind[2]).toMatchObject({ x: 0.75, y: 0.5 });
    expect(behind[3]).toMatchObject({ x: 0.25, y: 0.1 });
  });

  it('a ring that does not match the sides writes nothing', () => {
    expect(arShotLabels(corners.slice(0, 3), { width: 400, height: 1000 }, [side(0, 1), side(1, 1), side(2, 1), side(3, 1)])).toEqual([]);
    expect(arShotLabels(undefined, { width: 400, height: 1000 }, [side(0, 1)])).toEqual([]);
    expect(arShotLabels(corners, { width: 0, height: 0 }, [side(0, 1), side(1, 1), side(2, 1), side(3, 1)])).toEqual([]);
  });

  it('travels as one form field and comes back only when it is sane', () => {
    const labels = [{ x: 0.5, y: 0.1, text: '1 · 0,80 m' }];
    expect(shotLabelsOf(shotLabelsField(labels))).toEqual(labels);
    expect(shotLabelsOf('[{"x":2,"y":0.1,"text":"1 · 0,80 m"}]')).toEqual([]);
    expect(shotLabelsOf('[{"x":0.5,"y":0.1,"text":"<script>"}]')).toEqual([]);
    expect(shotLabelsOf('nope')).toEqual([]);
    expect(shotLabelsOf(JSON.stringify(Array.from({ length: 40 }, () => labels[0])))).toHaveLength(32);
    expect(shotLabelsField([])).toBeUndefined();
  });

  it('the perimeter is the sum of the final sides', () => {
    expect(arPerimeterM([side(0, 0.8), side(1, 0.85), side(2, 0.67), side(3, 0.62)])).toBeCloseTo(2.94, 5);
  });

  it('the summary chips: area, volume only with a thickness, perimeter and sides when known', () => {
    expect(arSummaryChips({ areaM2: 0.53, volumeM3: null, perimeterM: 2.94, sides: 4 })).toEqual([
      { label: 'Área', value: '0,53 m²' }, { label: 'Perímetro', value: '2,94 m' }, { label: 'Lados', value: '4' },
    ]);
    expect(arSummaryChips({ areaM2: 0.53, volumeM3: 0.027, perimeterM: null, sides: null })).toEqual([
      { label: 'Área', value: '0,53 m²' }, { label: 'Volumen', value: '0,027 m³' },
    ]);
    expect(arSummaryChips({ areaM2: 0.05, volumeM3: 0, perimeterM: null, sides: null })).toContainEqual({ label: 'Volumen', value: '0,000 m³' });
  });
});

describe('the AR\'s live chips (José 15/11: «chips de resumen», like his reference app)', () => {
  it('while drawing: the traced meters, the side being drawn included', () => {
    expect(arLiveChips({ sides: [0.8, 0.85], live: 0.5 })).toEqual([{ label: 'Trazado', value: '2,15 m' }, { label: 'Esquinas', value: '3' }]);
  });

  it('closed: the AR\'s area (before any tape); with fewer than two corners: nothing', () => {
    expect(arLiveChips({ sides: [0.8, 0.85, 0.67], live: 0.62, closed: true, areaM2: 0.534 })).toEqual([{ label: 'Área AR', value: '0,53 m²' }, { label: 'Lados', value: '4' }]);
    expect(arLiveChips({ sides: [], live: null })).toEqual([]);
    expect(arLiveChips({ live: 1.2 })).toEqual([]);
  });
});

describe('the photo\'s summary in a corner (José 15/11: «no dentro de la figura», like his reference app)', () => {
  it('area and perimeter, one line each; never the volume, which an edit can change after the photo', () => {
    expect(arShotPanel({ areaM2: 2.27, perimeterM: 7.65 })).toEqual(['Área 2,27 m²', 'Perímetro 7,65 m']);
    expect(arShotPanel({ areaM2: 2.27, perimeterM: null })).toEqual(['Área 2,27 m²']);
  });

  it('travels as one field and comes back only when sane', () => {
    const panel = ['Área 2,27 m²', 'Perímetro 7,65 m'];
    expect(shotPanelOf(shotPanelField(panel))).toEqual(panel);
    expect(shotPanelOf('["<b>"]')).toEqual([]);
    expect(shotPanelOf(JSON.stringify(['a', 'b', 'c', 'd', 'e']))).toEqual([]);
    expect(shotPanelOf(42)).toEqual([]);
    expect(shotPanelField([])).toBeUndefined();
  });
});

describe('the diagonals to tape (José 16/11: complex shapes in the street)', () => {
  it('names the corners A, B, C… and offers a fan of diagonals from A', () => {
    const pentagon: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 5, y: 0, z: 3 }, { x: 2, y: 0, z: 5 }, { x: -1, y: 0, z: 3 }];
    const rows = arDiagonalRows(arAreaOf({ ...base, points: pentagon, tapes: { 0: 4 }, diagonals: [{ from: 3, to: 0, meters: 5.39 }] }));

    expect(arCornerName(0)).toBe('A');
    expect(arCornerName(26)).toBe('27');
    expect(rows.map((row) => [row.label, row.taped])).toEqual([['Diagonal A–C', false], ['Diagonal A–D', true]]);
    expect(rows[0]!.meters).toBe(Math.round(Math.hypot(5, 3) * 100) / 100);
    expect(rows[1]).toMatchObject({ meters: 5.39, flag: 'ok' });
  });

  it('a zone with only its diagonal taped still went through the tape: «AR + wincha»', () => {
    expect(arMethodOf(arAreaOf({ ...base, diagonals: [{ from: 0, to: 2, meters: 2.5 }] }))).toBe('ar-app');
  });

  it('a triangle has no diagonal to offer', () => {
    const triangle: ArPoint[] = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }];
    expect(arDiagonalRows(arAreaOf({ ...base, points: triangle, tapes: {} }))).toEqual([]);
  });

  it('a diagonal between neighbors, or off the zone, is ignored', () => {
    const result = arAreaOf({ ...base, diagonals: [{ from: 0, to: 1, meters: 2 }, { from: 0, to: 9, meters: 2 }, { from: 3, to: 0, meters: 1.5 }] });
    expect(result.diagonals).toEqual([]);
    expect(result.problems).toEqual(['no-tape']);
  });
});
