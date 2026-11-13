import { describe, expect, it } from 'vitest';
import { timemarkLayoutOf, timemarkOf } from './timemarkStamp.js';

/**
 * José 12/11: the camera of every report shows and burns a stamp like Timemark's: the hour big,
 * the date and the weekday beside it, then the address and the GPS. Never the person's name.
 */
describe('timemarkOf', () => {
  it('writes the hour, the date and the weekday in Lima, the address and the coordinates with their precision', () => {
    // Arrange: 12:42 UTC is 07:42 in Lima.
    const at = new Date('2026-11-12T12:42:10Z');
    // Act
    const stamp = timemarkOf({ at, point: { lat: -12.02174, lng: -76.88173, precision: 6.4 }, place: 'Av. Los Incas 1240, Ate, Lima' });
    // Assert
    expect(stamp).toEqual({ hour: '07:42', date: '12/11/2026', weekday: 'jueves', address: 'Av. Los Incas 1240, Ate, Lima', coords: '-12.0217, -76.8817 · ±6 m' });
  });

  it('just after midnight in Lima is still the day before in UTC, and with no reading there is no place line', () => {
    // Act
    const stamp = timemarkOf({ at: new Date('2026-11-13T04:30:00Z'), point: null, place: null });
    // Assert
    expect(stamp).toEqual({ hour: '23:30', date: '12/11/2026', weekday: 'jueves', address: null, coords: null });
  });

  it('a reading with no address keeps the coordinates, and a long address is cut at a word', () => {
    // Act
    const bare = timemarkOf({ at: new Date('2026-11-12T12:42:00Z'), point: { lat: -12.5, lng: -76.25, precision: 21 }, place: null });
    const long = timemarkOf({ at: new Date('2026-11-12T12:42:00Z'), point: null, place: 'Avenida Nicolás Ayllón con Calle Los Ingenieros Agrónomos de la Universidad, Ate Vitarte, Lima' });
    // Assert
    expect(bare.coords).toBe('-12.5000, -76.2500 · ±21 m');
    expect(long.address!.length).toBeLessThanOrEqual(60);
    expect(long.address!.endsWith('…')).toBe(true);
  });
});

describe('timemarkLayoutOf', () => {
  it('sizes the stamp by the short side, so a photo held sideways keeps it the same size, at the bottom left', () => {
    // Act
    const upright = timemarkLayoutOf(3000, 4000);
    const sideways = timemarkLayoutOf(4000, 3000);
    // Assert
    expect(upright.hourSize).toBe(sideways.hourSize);
    expect(upright.landscape).toBe(false);
    expect(sideways.landscape).toBe(true);
    expect(upright.margin).toBeGreaterThan(0);
    expect(upright.hourSize).toBeGreaterThan(upright.lineSize * 2);
    expect(upright.logoSize).toBeGreaterThan(upright.lineSize);
  });
});
