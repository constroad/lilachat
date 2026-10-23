import { describe, expect, it } from 'vitest';
import { anchorRepeatRule, describeRepeat, nextRepeat, parseRepeatRule, repeatLabel } from './repeatRule.js';
import { whenItRings } from './recordatorios.js';
import { formatEventWhen } from './events.js';

/** Lima is UTC−5 all year: 9:00 in Lima is 14:00 UTC. */
const lima = (y: number, m: number, d: number, h = 9, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 5, min));

describe('nextRepeat (pending 65)', () => {
  it('only on Tuesdays and Thursdays, at the same hour in Lima', () => {
    // Arrange: starts Tue 20 Oct 2026 at 9:00
    const startsAt = lima(2026, 10, 20);
    const rule = { weekdays: [2, 4] };
    // Act / Assert
    expect(nextRepeat({ startsAt, recurrence: 'weekly', rule, from: lima(2026, 10, 20, 9, 30) })).toEqual(lima(2026, 10, 22));
    expect(nextRepeat({ startsAt, recurrence: 'weekly', rule, from: lima(2026, 10, 22, 10) })).toEqual(lima(2026, 10, 27));
    expect(nextRepeat({ startsAt, recurrence: 'weekly', rule, from: lima(2026, 10, 19) })).toEqual(lima(2026, 10, 20));
  });

  it('only Mondays every two weeks counts weeks from the first one', () => {
    // Arrange: Mon 19 Oct 2026
    const startsAt = lima(2026, 10, 19);
    // Act / Assert
    expect(nextRepeat({ startsAt, recurrence: 'weekly', rule: { weekdays: [1], every: 2 }, from: lima(2026, 10, 19, 10) })).toEqual(lima(2026, 11, 2));
  });

  it('the last day of the month: 31, 30, and 28 or 29 in February', () => {
    // Arrange
    const startsAt = lima(2027, 1, 31);
    const rule = { monthDay: 'last' as const };
    // Act / Assert
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule, from: lima(2027, 1, 31, 10) })).toEqual(lima(2027, 2, 28));
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule, from: lima(2027, 2, 28, 10) })).toEqual(lima(2027, 3, 31));
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule, from: lima(2027, 3, 31, 10) })).toEqual(lima(2027, 4, 30));
    expect(nextRepeat({ startsAt: lima(2028, 1, 31), recurrence: 'monthly', rule, from: lima(2028, 1, 31, 10) })).toEqual(lima(2028, 2, 29));
  });

  it('the same day of the month falls back to the last day when the month is shorter, and comes back', () => {
    // Arrange: the 31st
    const startsAt = lima(2026, 12, 31);
    // Act / Assert
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule: { monthDay: 'same' }, from: lima(2026, 12, 31, 10) })).toEqual(lima(2027, 1, 31));
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule: { monthDay: 'same' }, from: lima(2027, 1, 31, 10) })).toEqual(lima(2027, 2, 28));
    expect(nextRepeat({ startsAt, recurrence: 'monthly', rule: { monthDay: 'same' }, from: lima(2027, 2, 28, 10) })).toEqual(lima(2027, 3, 31));
  });

  it('the stored day survives the cron moving the start to the 28th of February', () => {
    // Arrange: asked for the 31st; it rang on Feb 28 and the cron moved the start there
    const rule = anchorRepeatRule('monthly', { monthDay: 'same' }, lima(2027, 1, 31));
    // Act / Assert
    expect(rule).toEqual({ monthDay: 'same', day: 31 });
    expect(nextRepeat({ startsAt: lima(2027, 2, 28), recurrence: 'monthly', rule, from: lima(2027, 2, 28, 10) })).toEqual(lima(2027, 3, 31));
    expect(anchorRepeatRule('weekly', { weekdays: [1] }, lima(2027, 1, 31))).toEqual({ weekdays: [1] });
  });

  it('every 3 months and every 2 days', () => {
    // Act / Assert
    expect(nextRepeat({ startsAt: lima(2026, 1, 15), recurrence: 'monthly', rule: { every: 3 }, from: lima(2026, 1, 15, 10) })).toEqual(lima(2026, 4, 15));
    expect(nextRepeat({ startsAt: lima(2026, 10, 1), recurrence: 'daily', rule: { every: 2 }, from: lima(2026, 10, 2) })).toEqual(lima(2026, 10, 3));
  });

  it('keeps the old behavior without a rule, and once never comes back', () => {
    // Act / Assert
    expect(nextRepeat({ startsAt: lima(2026, 10, 21), recurrence: 'weekly', from: lima(2026, 10, 21, 10) })).toEqual(lima(2026, 10, 28));
    expect(nextRepeat({ startsAt: lima(2026, 10, 21), recurrence: 'daily', from: lima(2026, 10, 21, 10) })).toEqual(lima(2026, 10, 22));
    expect(nextRepeat({ startsAt: lima(2026, 10, 21), recurrence: 'once', from: lima(2026, 10, 21, 10) })).toBeNull();
    expect(nextRepeat({ startsAt: lima(2026, 10, 21), recurrence: 'once', from: lima(2026, 10, 20) })).toEqual(lima(2026, 10, 21));
  });

  it('a far-away «from» jumps straight to the next one', () => {
    // Act / Assert
    expect(nextRepeat({ startsAt: lima(2020, 1, 31), recurrence: 'monthly', rule: { monthDay: 'last' }, from: lima(2026, 10, 31, 10) })).toEqual(lima(2026, 11, 30));
  });
});

describe('parseRepeatRule', () => {
  it('keeps only valid days, a whole «every» between 1 and 99 and a known month day', () => {
    // Act / Assert
    expect(parseRepeatRule({ weekdays: [4, 2, 2, 9, -1, 'x'], every: 2.7, monthDay: 'last' })).toEqual({ weekdays: [2, 4], every: 2, monthDay: 'last' });
    expect(parseRepeatRule({ every: 500 })).toEqual({ every: 99 });
    expect(parseRepeatRule({ monthDay: 'other', weekdays: [] })).toBeUndefined();
    expect(parseRepeatRule(null)).toBeUndefined();
  });
});

describe('describeRepeat', () => {
  it('says it the way the design does', () => {
    // Act / Assert
    expect(describeRepeat('weekly', { weekdays: [2, 4] }, '9:00 a. m.')).toBe('Se repite los martes y jueves a las 9:00 a. m.');
    expect(describeRepeat('weekly', { weekdays: [1], every: 2 }, '9:00 a. m.')).toBe('Se repite cada 2 semanas los lunes a las 9:00 a. m.');
    expect(describeRepeat('monthly', { monthDay: 'last' }, '9:00 a. m.')).toBe('Se repite el último día de cada mes a las 9:00 a. m.');
    expect(describeRepeat('monthly', { every: 3 }, '9:00 a. m.', 15)).toBe('Se repite el día 15 cada 3 meses a las 9:00 a. m.');
    expect(describeRepeat('daily', undefined, '9:00 a. m.')).toBe('Se repite todos los días a las 9:00 a. m.');
    expect(describeRepeat('once', undefined, '9:00 a. m.')).toBe('');
  });
});

describe('repeatLabel and whenItRings', () => {
  it('the short label says the days, the month end or the cadence', () => {
    // Act / Assert
    expect(repeatLabel('weekly', { weekdays: [4, 2] }, 'Semanal')).toBe('Mar y jue');
    expect(repeatLabel('monthly', { monthDay: 'last' }, 'Mensual')).toBe('Fin de mes');
    expect(repeatLabel('daily', { every: 2 }, 'Diario')).toBe('Cada 2 días');
    expect(repeatLabel('weekly', undefined, 'Semanal')).toBe('Semanal');
  });

  it('the card line uses the rule for the label and the next time', () => {
    // Arrange: Tue 20 Oct 2026 9:00 Lima, asked on Tue at 10:00
    const now = lima(2026, 10, 20, 10);
    // Act
    const line = whenItRings({ startsAt: lima(2026, 10, 20).toISOString(), recurrence: 'weekly', repeat: { weekdays: [2, 4] }, active: true }, now);
    // Assert: the next one is Thursday 22 at 9:00 in Lima, written in the device's own time (CI runs in UTC)
    expect(line).toBe(`Mar y jue · ${formatEventWhen(lima(2026, 10, 22), now)}`);
  });
});
