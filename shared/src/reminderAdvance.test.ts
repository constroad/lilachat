import { describe, expect, it } from 'vitest';
import { advanceChips, advanceDue, advanceLabel, advanceNote, advanceShort, advanceSummary, advanceToMinutes, DEFAULT_ADVANCE, MAX_ADVANCES, parseAdvance, toggleAdvance } from './reminderAdvance.js';

const MIN = 60_000;
const START = new Date('2026-10-25T20:00:00.000Z');
const at = (minutesBefore: number) => new Date(START.getTime() - minutesBefore * MIN);

/** José 25/10: «avisar 15 min antes, o configurar cuánto tiempo antes, y poder agregar varios». */
describe('parseAdvance', () => {
  it('keeps whole minutes, the longest first, each once', () => {
    expect(parseAdvance([5, 60, 15, 15])).toEqual([60, 15, 5]);
  });

  it('accepts numbers written as text (a form sends them so)', () => {
    expect(parseAdvance(['15', '5'])).toEqual([15, 5]);
  });

  it.each([[undefined], [null], ['15'], [{}], [15]])('anything that is not a list (%j) is no advance', (raw) => {
    expect(parseAdvance(raw)).toEqual([]);
  });

  it.each([[0], [-5], [1.5], [Number.NaN], ['abc'], [null], [{}], [7 * 1440 + 1]])('drops the invalid value %j without losing the rest', (invalid) => {
    expect(parseAdvance([invalid, 10])).toEqual([10]);
  });

  it('keeps up to a week', () => {
    expect(parseAdvance([7 * 1440])).toEqual([7 * 1440]);
  });

  it(`keeps at most ${MAX_ADVANCES}: the longest ones`, () => {
    expect(parseAdvance([1, 2, 3, 4, 5, 6, 7])).toEqual([7, 6, 5, 4, 3]);
  });

  it('a new reminder starts with 15 minutes before', () => {
    expect(DEFAULT_ADVANCE).toEqual([15]);
  });
});

describe('advanceLabel', () => {
  it.each([
    [5, '5 min antes'],
    [15, '15 min antes'],
    [60, '1 h antes'],
    [90, '1 h 30 min antes'],
    [1440, '1 día antes'],
    [2880, '2 días antes'],
    [1500, '1 día 1 h antes'],
  ])('%i min → %s', (minutes, label) => {
    expect(advanceLabel(minutes)).toBe(label);
  });
});

describe('advanceNote', () => {
  it('says how long is left, as configured (not the cron jitter)', () => {
    expect(advanceNote(15)).toBe('Empieza en 15 min');
    expect(advanceNote(90)).toBe('Empieza en 1 h 30 min');
    expect(advanceNote(1440)).toBe('Empieza en 1 día');
  });
});

describe('advanceToMinutes', () => {
  it.each([
    [20, 'min', 20],
    [2, 'h', 120],
    [1, 'dia', 1440],
  ] as const)('%i %s → %i', (value, unit, minutes) => {
    expect(advanceToMinutes(value, unit)).toBe(minutes);
  });

  it.each([[0], [-1], [1.5], [Number.NaN]])('%j is not an advance', (value) => {
    expect(advanceToMinutes(value, 'min')).toBeNull();
  });

  it('more than a week is refused', () => {
    expect(advanceToMinutes(8, 'dia')).toBeNull();
  });
});

describe('advanceDue', () => {
  it('rings when its time arrives, and once', () => {
    const due = advanceDue({ startsAt: START, advance: [15], sent: [], now: at(15) });
    expect(due).toEqual({ ring: 15, stamp: [15] });
    expect(advanceDue({ startsAt: START, advance: [15], sent: [15], now: at(14) })).toEqual({ ring: null, stamp: [] });
  });

  it('does nothing before its time', () => {
    expect(advanceDue({ startsAt: START, advance: [15], sent: [], now: at(16) })).toEqual({ ring: null, stamp: [] });
  });

  it('several advances ring one after the other', () => {
    const base = { startsAt: START, advance: [60, 15, 5] };
    expect(advanceDue({ ...base, sent: [], now: at(60) })).toEqual({ ring: 60, stamp: [60] });
    expect(advanceDue({ ...base, sent: [60], now: at(15) })).toEqual({ ring: 15, stamp: [15] });
    expect(advanceDue({ ...base, sent: [60, 15], now: at(5) })).toEqual({ ring: 5, stamp: [5] });
  });

  it('two due at the same time ring only the closest one, and both are stamped', () => {
    expect(advanceDue({ startsAt: START, advance: [15, 5], sent: [], now: at(5) })).toEqual({ ring: 5, stamp: [15, 5] });
  });

  it('a late one (cron down) is stamped without ringing: an old notice helps nobody', () => {
    expect(advanceDue({ startsAt: START, advance: [60], sent: [], now: at(40) })).toEqual({ ring: null, stamp: [60] });
  });

  it('tolerates a few minutes of delay', () => {
    expect(advanceDue({ startsAt: START, advance: [15], sent: [], now: at(13) })).toEqual({ ring: 15, stamp: [15] });
  });

  it('a reminder created with less time than its advance does not ring the advance it already passed', () => {
    expect(advanceDue({ startsAt: START, advance: [60, 5], sent: [], now: at(10) })).toEqual({ ring: null, stamp: [60] });
  });

  it('once it started, the advances left are only stamped (the reminder itself rings)', () => {
    expect(advanceDue({ startsAt: START, advance: [15, 5], sent: [], now: at(-1) })).toEqual({ ring: null, stamp: [15, 5] });
  });

  it('no advances, nothing to do', () => {
    expect(advanceDue({ startsAt: START, advance: [], sent: [], now: at(15) })).toEqual({ ring: null, stamp: [] });
  });
});

describe('toggleAdvance', () => {
  it('adds one that was not there, keeping the list sorted', () => {
    expect(toggleAdvance([15], 60)).toEqual([60, 15]);
  });

  it('removes one that was there', () => {
    expect(toggleAdvance([60, 15], 15)).toEqual([60]);
  });

  it('can end with none', () => {
    expect(toggleAdvance([15], 15)).toEqual([]);
  });

  it(`does not grow past ${MAX_ADVANCES}: the new one is refused`, () => {
    expect(toggleAdvance([60, 30, 15, 10, 5], 1)).toEqual([60, 30, 15, 10, 5]);
  });

  it('an invalid one changes nothing', () => {
    expect(toggleAdvance([15], 0)).toEqual([15]);
  });
});

describe('advanceChips', () => {
  it('offers the usual ones, shortest first', () => {
    expect(advanceChips([])).toEqual([5, 15, 30, 60, 1440]);
  });

  it('a custom one the person added stays among the chips, in its place', () => {
    expect(advanceChips([20, 15])).toEqual([5, 15, 20, 30, 60, 1440]);
  });
});

describe('advanceShort', () => {
  it.each([
    [15, '15 min'],
    [60, '1 h'],
    [1440, '1 día'],
    [90, '1 h 30 min'],
  ])('%i → %s', (minutes, label) => {
    expect(advanceShort(minutes)).toBe(label);
  });
});

describe('advanceSummary', () => {
  it('says nothing when there are none', () => {
    expect(advanceSummary([])).toBe('');
    expect(advanceSummary(undefined)).toBe('');
  });

  it('one, two or several in a sentence', () => {
    expect(advanceSummary([15])).toBe('Avisa 15 min antes');
    expect(advanceSummary([60, 15])).toBe('Avisa 1 h y 15 min antes');
    expect(advanceSummary([60, 30, 15])).toBe('Avisa 1 h, 30 min y 15 min antes');
  });
});
