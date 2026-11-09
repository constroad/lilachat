import { describe, expect, it } from 'vitest';
import { mapDayOptions, mediaOfDay, unitNumbers, withDayColors } from './workMapDays.js';
import type { MapPhoto } from './workMapPhotos.js';
import type { UnitDischarge } from './workMapDischarges.js';
import type { DischargePin } from './workMapProgress.js';

const photo = (id: string, at: string): MapPhoto => ({ id, at, lat: -12, lng: -77, kind: 'photo', url: `https://lila.constroad.com/${id}.jpg`, thumbnailUrl: `https://lila.constroad.com/${id}-t.jpg` });
const unit = (dispatchId: string, arrivalAt: string): UnitDischarge => ({ dispatchId, plate: dispatchId.toUpperCase(), m3: 8, arrivalAt, points: [] });
// 07/11 at 22:00 in Lima is 08/11 in UTC: the day is Lima's.
const late7 = '2026-11-08T03:00:00.000Z';
const morning8 = '2026-11-08T14:00:00.000Z';

/** A work done over several days (José 09/11, Globofast): «Todos» or one day of placement. */
describe('the days of the map', () => {
  it('offers no picker with a single day', () => {
    expect(mapDayOptions([photo('a', morning8)], [unit('u1', morning8)])).toEqual([]);
  });

  it('offers «Todos» and each day of Lima, newest first', () => {
    const options = mapDayOptions([photo('a', late7)], [unit('u1', morning8)]);
    expect(options.map((one) => one.key)).toEqual(['all', '2026-11-08', '2026-11-07']);
    expect(options[0]!.label).toBe('Todos');
  });

  it('a day keeps only its photos and units; «Todos» keeps everything', () => {
    const photos = [photo('a', late7), photo('b', morning8)];
    const units = [unit('u1', late7), unit('u2', morning8)];
    expect(mediaOfDay(photos, units, '2026-11-07')).toEqual({ photos: [photos[0]], units: [units[0]] });
    expect(mediaOfDay(photos, units, 'all')).toEqual({ photos, units });
  });

  it('numbers each unit inside its own day', () => {
    const numbers = unitNumbers([unit('u1', late7), unit('u2', morning8), unit('u3', '2026-11-08T15:00:00.000Z')]);
    expect([numbers.get('u1'), numbers.get('u2'), numbers.get('u3')]).toEqual([1, 1, 2]);
  });

  it('paints each pin with its day only when there are several days', () => {
    const pins: DischargePin[] = [{ id: 'u1', label: '1', lat: -12, lng: -77, outside: false }, { id: 'u2', label: '1', lat: -12, lng: -77, outside: false }];
    const days = new Map([['u1', '2026-11-07'], ['u2', '2026-11-08']]);
    const painted = withDayColors(pins, days, ['2026-11-08', '2026-11-07']);
    expect(painted[0]!.dayColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(painted[0]!.dayColor).not.toBe(painted[1]!.dayColor);
    expect(withDayColors(pins, days, ['2026-11-07'])).toEqual(pins);
  });
});

describe('the pins of a day', () => {
  it('a photo marker takes the day of its newest photo', async () => {
    const { photoSpotDays } = await import('./workMapDays.js');
    const spot = { id: 's1', lat: -12, lng: -77, streetId: null, streetName: null, atM: null, photos: [photo('new', morning8), photo('old', late7)] };
    expect(photoSpotDays([spot]).get('fotos-s1')).toBe('2026-11-08');
  });

  it('a unit pin says its number inside its day', async () => {
    const { dischargePinsOf } = await import('./workMapProgress.js');
    const placed = (id: string) => ({ state: 'outside' as const, unit: unit(id, morning8), point: { lat: -12, lng: -77 } });
    const pins = dischargePinsOf({ units: [placed('u1'), placed('u2')] }, new Map([['u1', 3], ['u2', 1]]));
    expect(pins.map((pin) => pin.label)).toEqual(['3', '1']);
  });
});

describe('unitPinsOfDay', () => {
  it('keeps the chosen day, numbered inside it, with its ring', async () => {
    const { unitPinsOfDay } = await import('./workMapDays.js');
    const units = [unit('u1', late7), unit('u2', morning8), unit('u3', '2026-11-08T15:00:00.000Z')];
    const suggestion = { hasWork: false, units: units.map((one) => ({ state: 'outside' as const, unit: one, point: { lat: -12, lng: -77 } })) };
    const days = ['2026-11-08', '2026-11-07'];
    const pins = unitPinsOfDay(suggestion, units, '2026-11-08', days);
    expect(pins.map((pin) => [pin.id, pin.label])).toEqual([['u2', '1'], ['u3', '2']]);
    expect(pins.every((pin) => pin.dayColor && !pin.outside)).toBe(true);
    expect(unitPinsOfDay(suggestion, units, 'all', days).map((pin) => pin.label)).toEqual(['1', '1', '2']);
  });
});

/** Portal via José 09/11: the map shows where the photos were taken even with no street drawn. */
describe('a map with photos and no streets', () => {
  it('frames the photos and the units when there is no street to frame', async () => {
    const { withMediaBounds, EMPTY_WORK_MAP } = await import('./workMapDays.js');
    const { workMapView } = await import('./workMap.js');
    const view = withMediaBounds(workMapView(EMPTY_WORK_MAP), [{ ...photo('a', morning8), lat: -12.1, lng: -76.9 }], [{ ...unit('u1', morning8), points: [{ kind: 'vacia', lat: -12.2, lng: -77, at: morning8 }] }]);
    expect(view.bounds).toEqual([[-77, -12.2], [-76.9, -12.1]]);
  });

  it('keeps the streets\' frame when there are streets, and none with nothing at all', async () => {
    const { withMediaBounds, EMPTY_WORK_MAP } = await import('./workMapDays.js');
    const { workMapView } = await import('./workMap.js');
    const framed = { ...workMapView(EMPTY_WORK_MAP), bounds: [[1, 1], [2, 2]] as [[number, number], [number, number]] };
    expect(withMediaBounds(framed, [photo('a', morning8)], []).bounds).toEqual([[1, 1], [2, 2]]);
    expect(withMediaBounds(workMapView(EMPTY_WORK_MAP), [], []).bounds).toBeNull();
  });
});

describe('the list of units with no street drawn', () => {
  it('says there are no streets, not that each unit fell off the work, and numbers them inside their day', async () => {
    const { dischargeRowsOf } = await import('./workMapProgress.js');
    const { dischargeHeadline } = await import('./workMapDischarges.js');
    const units = [unit('u1', late7), unit('u2', morning8)];
    const suggestion = { hasWork: false, stretches: [], units: units.map((one) => ({ state: 'outside' as const, unit: one, point: { lat: -12, lng: -77 } })) };
    const rows = dischargeRowsOf(suggestion, unitNumbers(units));
    expect(rows.map((row) => [row.title, row.state])).toEqual([['Unidad 1 · U1', 'loose'], ['Unidad 1 · U2', 'loose']]);
    expect(rows[0]!.line).toContain('Sin calles dibujadas');
    expect(dischargeHeadline(suggestion)).toBe('2 unidades · sin calles dibujadas');
  });
});
