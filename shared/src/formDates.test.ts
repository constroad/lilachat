import { describe, expect, it } from 'vitest';
import { formatFormDate, normalizeFormDate, parseFormDate, startingMoment } from './formDates.js';

/** Dates and times of an app's form (José, 24/10: «fecha actual siempre y un selector, no un input»). */
describe('formatFormDate', () => {
  it('writes the phone clock: a date, a time of day or both', () => {
    const moment = new Date(2026, 9, 24, 8, 5);
    expect(formatFormDate(moment, 'date')).toBe('2026-10-24');
    expect(formatFormDate(moment, 'time')).toBe('08:05');
    expect(formatFormDate(moment, 'date-time')).toBe('2026-10-24T08:05');
  });

  it('pads single digits: January 3rd at 9:07', () => {
    const moment = new Date(2026, 0, 3, 9, 7);
    expect(formatFormDate(moment, 'date')).toBe('2026-01-03');
    expect(formatFormDate(moment, 'time')).toBe('09:07');
  });
});

describe('parseFormDate', () => {
  const base = new Date(2026, 9, 24, 12, 0);

  it('reads a stored value back as the same local moment, for the picker', () => {
    expect(parseFormDate('2026-11-02', 'date', base)).toEqual(new Date(2026, 10, 2));
    expect(parseFormDate('2026-10-24T08:05', 'date-time', base)).toEqual(new Date(2026, 9, 24, 8, 5));
  });

  it('a time of day lands on the base day', () => {
    expect(parseFormDate('07:30', 'time', base)).toEqual(new Date(2026, 9, 24, 7, 30));
  });

  it('is null for what is not a real date or time, so the picker opens on the base instead', () => {
    for (const bad of ['mañana', '2026-02-30', '24:00', '8:5', '', undefined, 5, null]) {
      expect(parseFormDate(bad, 'date', base)).toBeNull();
    }
    expect(parseFormDate('25:00', 'time', base)).toBeNull();
  });
});

describe('normalizeFormDate', () => {
  it('a date must exist: February 30th is not one', () => {
    expect(normalizeFormDate('2026-10-24', 'date')).toBe('2026-10-24');
    expect(normalizeFormDate('  2026-10-24 ', 'date')).toBe('2026-10-24');
    expect(normalizeFormDate('2026-02-30', 'date')).toBeNull();
    expect(normalizeFormDate('24/10/2026', 'date')).toBeNull();
    expect(normalizeFormDate('mañana', 'date')).toBeNull();
  });

  it('a time is HH:MM in 24 h; one digit of hour is padded', () => {
    expect(normalizeFormDate('07:30', 'time')).toBe('07:30');
    expect(normalizeFormDate('7:30', 'time')).toBe('07:30');
    expect(normalizeFormDate('23:59', 'time')).toBe('23:59');
    for (const bad of ['24:00', '07:60', '0730', '7.30', '']) expect(normalizeFormDate(bad, 'time')).toBeNull();
  });

  it('a moment keeps its T; the older app typed a space and still goes through', () => {
    expect(normalizeFormDate('2026-10-24T08:05', 'date-time')).toBe('2026-10-24T08:05');
    expect(normalizeFormDate('2026-10-24 08:05', 'date-time')).toBe('2026-10-24T08:05');
    expect(normalizeFormDate('2026-10-24T08:05:30-05:00', 'date-time')).toBe('2026-10-24T08:05:30-05:00');
    expect(normalizeFormDate('2026-10-24T25:00', 'date-time')).toBeNull();
    expect(normalizeFormDate('2026-10-24', 'date-time')).toBeNull();
  });

  it('what is not text is refused', () => {
    expect(normalizeFormDate(20261024, 'date')).toBeNull();
    expect(normalizeFormDate(undefined, 'time')).toBeNull();
  });
});

describe('startingMoment', () => {
  const now = new Date(2026, 9, 24, 8, 5, 41);

  it('a date starts on today and a moment on now, to the minute', () => {
    expect(startingMoment('date', now)).toBe('2026-10-24');
    expect(startingMoment('date-time', now)).toBe('2026-10-24T08:05');
  });

  it('a time of day starts empty: it is a decision, not a clock reading', () => {
    expect(startingMoment('time', now)).toBeUndefined();
  });
});
