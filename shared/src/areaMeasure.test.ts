import { describe, expect, it } from 'vitest';
import { APPROXIMATE_FROM_M, AREA_DRAFT_MAX_AGE_MS, AREA_METHOD_LABELS, IPHONE_MEASURE_STEPS, areaDraftKey, areaFigures, fieldPlaceLine, isApproximatePlace, measureMethodFor, parseArea, parseLength, parseThickness, restoredAreaDraft, type AreaDraft } from './areaMeasure.js';

/**
 * José 12/11, option B: an iPhone has no APK, so the area is measured with
 * Apple's «Medición» app and typed in Lilachat. Lilachat says step by step
 * what to open, how to measure, and how to come back to save. The limits are
 * Portal's (from its 68 real areas), so both sides refuse the same numbers.
 */
describe('parseLength (a side, as typed or pasted from Medición)', () => {
  it.each([
    ['3,25', 3.25],
    ['3.25', 3.25],
    ['3,25 m', 3.25],
    ['3.25m', 3.25],
    [' 12 ', 12],
    ['325 cm', 3.25],
    ['0,1', 0.1],
    ['500', 500],
  ])('reads «%s» as %s m', (typed, meters) => {
    expect(parseLength(typed)).toBeCloseTo(meters, 6);
  });

  it.each(['', 'abc', '0', '-2', '3 ft', '1.2.3', '0,09', '500,01', '8 cm'])('refuses «%s»', (typed) => {
    expect(parseLength(typed)).toBeNull();
  });
});

describe('parseArea and parseThickness', () => {
  it('an area typed straight from Medición, in m²', () => {
    expect(parseArea('17,6')).toBe(17.6);
    expect(parseArea('17,6 m²')).toBe(17.6);
    expect(parseArea('17.6 m2')).toBe(17.6);
  });

  it('refuses an area under 0,05 m² or over 5 000 m²', () => {
    expect(parseArea('0,04')).toBeNull();
    expect(parseArea('5000,01')).toBeNull();
    expect(parseArea('5000')).toBe(5000);
  });

  it('the thickness is 1 to 50 cm', () => {
    expect(parseThickness('5')).toBe(5);
    expect(parseThickness('7,5 cm')).toBe(7.5);
    expect(parseThickness('0,5')).toBeNull();
    expect(parseThickness('51')).toBeNull();
  });
});

describe('areaFigures (what Lilachat computes, never typed)', () => {
  it('length × width, rounded to two decimals', () => {
    expect(areaFigures({ mode: 'sides', length: '3,2', width: '1,5', area: '', thickness: '' })).toEqual({ lengthM: 3.2, widthM: 1.5, areaM2: 4.8, line: '3,20 m × 1,50 m = 4,80 m²', large: false });
  });

  it('rounds 2,333 × 1,111 to 2,59 m²', () => {
    expect(areaFigures({ mode: 'sides', length: '2,333', width: '1,111', area: '', thickness: '' })?.areaM2).toBe(2.59);
  });

  it('a direct area keeps no sides', () => {
    expect(areaFigures({ mode: 'direct', length: '9', width: '9', area: '17,6', thickness: '' })).toEqual({ areaM2: 17.6, line: '17,60 m²', large: false });
  });

  it('with a thickness, the volume is area × thickness / 100, to three decimals', () => {
    expect(areaFigures({ mode: 'sides', length: '3,2', width: '1,5', area: '', thickness: '5' })).toMatchObject({ thicknessCm: 5, volumeM3: 0.24, line: '3,20 m × 1,50 m = 4,80 m² · 0,240 m³' });
  });

  it('a big area keeps its thousands apart and asks «¿seguro?» above 1 000 m²', () => {
    expect(areaFigures({ mode: 'sides', length: '120', width: '12,5', area: '', thickness: '' })).toMatchObject({ areaM2: 1500, line: '120,00 m × 12,50 m = 1 500,00 m²', large: true });
  });

  it('two sides that give more than 5 000 m² are refused', () => {
    expect(areaFigures({ mode: 'sides', length: '500', width: '20', area: '', thickness: '' })).toBeNull();
  });

  it('says nothing until what it needs reads', () => {
    expect(areaFigures({ mode: 'sides', length: '3', width: '', area: '', thickness: '' })).toBeNull();
    expect(areaFigures({ mode: 'direct', length: '', width: '', area: 'x', thickness: '' })).toBeNull();
  });

  it('a thickness out of range is left out, not a reason to refuse the area', () => {
    expect(areaFigures({ mode: 'direct', length: '', width: '', area: '10', thickness: '99' })).toEqual({ areaM2: 10, line: '10,00 m²', large: false });
  });
});

describe('the method and the place', () => {
  it('an iPhone measures with Medición; anything else types it by hand', () => {
    expect(measureMethodFor(true)).toBe('medidas-iphone');
    expect(measureMethodFor(false)).toBe('a-mano');
    expect(AREA_METHOD_LABELS['medidas-iphone']).toBe('Medidas (iPhone)');
    expect(AREA_METHOD_LABELS['a-mano']).toBe('A mano');
  });

  it('a place is approximate past 15 m, as Portal marks it', () => {
    expect(APPROXIMATE_FROM_M).toBe(15);
    expect(isApproximatePlace(15)).toBe(false);
    expect(isApproximatePlace(15.4)).toBe(true);
    expect(isApproximatePlace(undefined)).toBe(false);
    expect(fieldPlaceLine(6.4)).toBe('GPS ±6 m');
    expect(fieldPlaceLine(22.4)).toBe('Ubicación aproximada (±22 m)');
  });
});

describe('IPHONE_MEASURE_STEPS', () => {
  const all = IPHONE_MEASURE_STEPS.map((step) => `${step.title} ${step.detail}`).join(' ');

  it('opens Medición, measures length and width, takes its photo, and comes back to Lilachat', () => {
    const titles = IPHONE_MEASURE_STEPS.map((step) => step.title);
    expect(titles[0]).toContain('Medición');
    expect(titles.some((title) => /largo/i.test(title))).toBe(true);
    expect(titles.some((title) => /ancho/i.test(title))).toBe(true);
    expect(titles.some((title) => /foto/i.test(title))).toBe(true);
    expect(titles.some((title) => /Vuelve a Lilachat/.test(title))).toBe(true);
  });

  it('says where Medición lives and the distance Apple recommends', () => {
    expect(all).toContain('Utilidades');
    expect(all).toContain('0,5 y 3 metros');
  });

  it('is written in neutral Spanish, without voseo', () => {
    expect(all).not.toMatch(/\b(tocá|abrí|medí|volvé|escribí|elegí|acá|tenés)\b/);
  });
});

describe('the draft that survives going to Medición and back', () => {
  const now = Date.parse('2026-11-12T15:00:00.000Z');
  const saved: AreaDraft = { entryId: '7f6c1d2e-1111-4a2b-9c3d-123456789abc', mode: 'sides', length: '3,2', width: '1,5', area: '', thickness: '', place: 'Jr. Moquegua', note: 'Bache', point: { lat: -12.05, lng: -77.03, precision: 6 }, savedAt: now - 60_000 };

  it('one key per service', () => {
    expect(areaDraftKey('sv1')).not.toBe(areaDraftKey('sv2'));
  });

  it('comes back as it was left', () => {
    expect(restoredAreaDraft(JSON.parse(JSON.stringify(saved)), now)).toEqual(saved);
  });

  it('an old draft is not brought back', () => {
    expect(restoredAreaDraft({ ...saved, savedAt: now - AREA_DRAFT_MAX_AGE_MS - 1 }, now)).toBeNull();
  });

  it('anything malformed is ignored, and a missing field starts empty', () => {
    expect(restoredAreaDraft(null, now)).toBeNull();
    expect(restoredAreaDraft({ ...saved, entryId: 42 }, now)).toBeNull();
    expect(restoredAreaDraft({ ...saved, point: { lat: 'x' } }, now)).toEqual({ ...saved, point: null });
    const { thickness: _dropped, ...older } = saved;
    expect(restoredAreaDraft({ ...older, mode: 'other' }, now)).toEqual({ ...saved, thickness: '', mode: 'sides' });
  });
});
