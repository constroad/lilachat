import { describe, expect, it } from 'vitest';
import { photoAreaFigures, photoAreaOf, photoPointOf, photoSideLabel, screenPointOf, tapeKey, tapeMeters, thicknessAverage, type PhotoPoint } from './photoArea.js';

/**
 * Design la-05 (APK, no AR): the zone's photo from above, its corners touched,
 * and the tape (wincha) fixing the real lengths. One measured side gives the
 * scale; the rest come from it until they are measured too.
 */
const rectangle: PhotoPoint[] = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 430 }, { x: 100, y: 430 }];

describe('photoAreaOf', () => {
  it('one side with the tape fixes the scale; the area and the other sides come from it', () => {
    // Arrange / Act
    const result = photoAreaOf(rectangle, { 0: 2 }, []);
    // Assert
    expect(result).toEqual({
      sides: [{ index: 0, meters: 2, source: 'wincha' }, { index: 1, meters: 1.65, source: 'escala' }, { index: 2, meters: 2, source: 'escala' }, { index: 3, meters: 1.65, source: 'escala' }],
      areaM2: 3.3, thicknessCm: null, volumeM3: null, readings: 0,
    });
  });

  it('every side measured: the scale is their average, and the volume comes from the mean thickness (3.30 m² · 0.168 m³)', () => {
    const result = photoAreaOf(rectangle, { 0: 2, 1: 1.65, 2: 2, 3: 1.65 }, [5, 5.2, 5.1, 5.1]);
    expect(result?.sides.every((side) => side.source === 'wincha')).toBe(true);
    expect(result).toMatchObject({ areaM2: 3.3, thicknessCm: 5.1, volumeM3: 0.168, readings: 4 });
  });

  it('nothing until there are three corners and one side with the tape; a side outside the shape or zero does not count', () => {
    expect(photoAreaOf(rectangle.slice(0, 2), { 0: 2 }, [])).toBeNull();
    expect(photoAreaOf(rectangle, {}, [])).toBeNull();
    expect(photoAreaOf(rectangle, { 7: 2, 1: 0 }, [])).toBeNull();
    expect(photoAreaOf([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }], { 0: 2 }, [])).toBeNull();
  });

  it('the corners in either order give the same area', () => {
    expect(photoAreaOf([...rectangle].reverse(), { 1: 1.65 }, [])?.areaM2).toBe(3.3);
  });
});

describe('thicknessAverage', () => {
  it('averages the readings in range to one decimal and ignores the rest', () => {
    expect(thicknessAverage([5, 5.2, 5.1, 5.1])).toBe(5.1);
    expect(thicknessAverage([0, 80, 6])).toBe(6);
    expect(thicknessAverage([])).toBeNull();
  });
});

describe('photoAreaFigures', () => {
  it('goes to Portal as the area alone, with its thickness, and the line the screen shows', () => {
    const result = photoAreaOf(rectangle, { 0: 2 }, [5, 5.2, 5.1, 5.1])!;
    expect(photoAreaFigures(result)).toEqual({ areaM2: 3.3, thicknessCm: 5.1, volumeM3: 0.168, line: '3,30 m² · 0,168 m³', large: false });
    expect(photoAreaFigures({ ...result, thicknessCm: null, volumeM3: null })).toEqual({ areaM2: 3.3, line: '3,30 m²', large: false });
  });
});

describe('photoSideLabel', () => {
  it('names the side by number and length', () => {
    expect(photoSideLabel({ index: 0, meters: 2, source: 'wincha' })).toBe('L1 2,00 m');
    expect(photoSideLabel({ index: 3, meters: 1.6549, source: 'escala' })).toBe('L4 1,65 m');
  });
});

describe('tapeKey', () => {
  it('types a length with one decimal point, up to two decimals, and deletes from the end', () => {
    expect(tapeKey('', '1')).toBe('1');
    expect(tapeKey('1', '.')).toBe('1.');
    expect(tapeKey('1.', '.')).toBe('1.');
    expect(tapeKey('1.6', '5')).toBe('1.65');
    expect(tapeKey('1.65', '9')).toBe('1.65');
    expect(tapeKey('', '.')).toBe('0.');
    expect(tapeKey('1.65', 'borrar')).toBe('1.6');
    expect(tapeKey('', 'borrar')).toBe('');
    expect(tapeKey('123', '4')).toBe('123');
  });

  it('reads the typed length in meters, or null until it is one', () => {
    expect(tapeMeters('1.65')).toBe(1.65);
    expect(tapeMeters('0.')).toBeNull();
    expect(tapeMeters('')).toBeNull();
    expect(tapeMeters('0')).toBeNull();
  });
});

describe('photoPointOf', () => {
  it('turns a touch on the fitted photo into the photo\'s own pixels, and ignores a touch off the photo', () => {
    // A 4000×3000 photo shown in a 400×400 box: 400×300, 50 px above and below.
    const box = { width: 400, height: 400 };
    const photo = { width: 4000, height: 3000 };
    expect(photoPointOf({ x: 200, y: 200 }, box, photo)).toEqual({ x: 2000, y: 1500 });
    expect(photoPointOf({ x: 0, y: 50 }, box, photo)).toEqual({ x: 0, y: 0 });
    expect(photoPointOf({ x: 200, y: 20 }, box, photo)).toBeNull();
  });

  it('and back: a photo point is drawn where it was touched', () => {
    expect(screenPointOf({ x: 2000, y: 1500 }, { width: 400, height: 400 }, { width: 4000, height: 3000 })).toEqual({ x: 200, y: 200 });
  });
});
