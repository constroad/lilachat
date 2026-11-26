import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { arrivedThisMonth, followUpSequenceOf, nextActionWhenOf, overdueLabelOf, overdueShortLabelOf, periodStartOf, prospectTimeOf, suggestNextAction, whenOptions } from './prospectPlan.js';

/** Planning a prospect's next step (dl-09), in Lima time. */
const now = new Date('2026-11-17T15:12:00.000Z'); // Tue 17/11, 10:12 in Lima
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const prospect = (overrides: Partial<ProspectView>): ProspectView => ({ id: 'p', chatId: 'c', phone: '51949123824', lastActivityAt: hoursAgo(1), attendedBy: 'dali', version: 0, createdAt: hoursAgo(5), ...overrides });

describe('whenOptions', () => {
  it('offers today at a round hour with margin, tomorrow 9:00 and in 3 days 9:00', () => {
    expect(whenOptions(now)).toEqual([
      { key: 'today', label: 'Hoy 12:00', at: '2026-11-17T17:00:00.000Z' },
      { key: 'tomorrow', label: 'Mañana 9:00', at: '2026-11-18T14:00:00.000Z' },
      { key: 'later', label: 'En 3 días', at: '2026-11-20T14:00:00.000Z' },
    ]);
  });

  it('drops «today» late in the evening', () => {
    expect(whenOptions(new Date('2026-11-18T00:30:00.000Z')).map((option) => option.key)).toEqual(['tomorrow', 'later']);
  });
});

describe('followUpSequenceOf', () => {
  it('marks where a sent quote goes: day 4 is the call', () => {
    const steps = followUpSequenceOf(prospect({ quote: { code: 'COT-1', sentAt: '2026-11-13T15:00:00.000Z' } }), now);
    expect(steps?.map((step) => step.state)).toEqual(['done', 'done', 'current', 'next', 'next']);
  });

  it('has nothing without a quote or once there is a result', () => {
    expect(followUpSequenceOf(prospect({}), now)).toBeNull();
    expect(followUpSequenceOf(prospect({ quote: { code: 'COT-1', sentAt: hoursAgo(30) }, result: { outcome: 'won', at: hoursAgo(1) } }), now)).toBeNull();
  });
});

describe('suggestNextAction', () => {
  it('quotes a prospect ready to quote, saying since when', () => {
    expect(suggestNextAction(prospect({ stage: 'to_quote', readyAt: hoursAgo(27) }), now)).toEqual({ kind: 'quote', at: '2026-11-17T17:00:00.000Z', reason: 'Está listo para cotizar hace 27 horas.' });
  });

  it('follows the sequence after a quote: today\'s step when due, else the next, never in the past', () => {
    const quiet = suggestNextAction(prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt: '2026-11-13T15:00:00.000Z' } }), now);
    expect(quiet).toEqual({ kind: 'call', at: '2026-11-17T17:00:00.000Z', reason: 'La cotización lleva 4 días sin respuesta.' });
    const between = suggestNextAction(prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt: '2026-11-14T15:00:00.000Z' } }), now);
    expect(between).toEqual({ kind: 'call', at: '2026-11-18T14:00:00.000Z', reason: 'La cotización lleva 3 días sin respuesta.' });
    const old = suggestNextAction(prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt: '2026-11-07T15:00:00.000Z' } }), now);
    expect(old).toMatchObject({ kind: 'call', at: '2026-11-18T14:00:00.000Z' });
    expect(old?.reason).toContain('No respondió');
  });

  it('suggests nothing while Dali still asks a cold one, or once closed', () => {
    expect(suggestNextAction(prospect({ stage: 'missing_info', score: 30 }), now)).toBeNull();
    expect(suggestNextAction(prospect({ stage: 'to_quote', result: { outcome: 'lost', reason: 'price', at: hoursAgo(1) } }), now)).toBeNull();
  });
});

describe('labels', () => {
  it.each([
    [new Date(now.getTime() - 6 * 60_000).toISOString(), 'hace 6 min'],
    ['2026-11-17T14:00:00.000Z', '09:00'],
    ['2026-11-16T20:00:00.000Z', 'Ayer'],
    ['2026-11-14T20:00:00.000Z', 'hace 3 días'],
    ['2026-11-01T20:00:00.000Z', '01/11'],
  ])('a row shows %s as %s', (iso, label) => {
    expect(prospectTimeOf(iso, now)).toBe(label);
  });

  it('says what is late and when a next action is due', () => {
    expect(overdueLabelOf({ kind: 'to_quote_late', since: hoursAgo(27) }, now)).toBe('Listo hace 27 horas · sin cotización');
    expect(overdueLabelOf({ kind: 'quote_unanswered', since: hoursAgo(96) }, now)).toBe('Cotización sin respuesta hace 4 días');
    // A row's pill (dl-01 v4): short enough not to be cut.
    expect(overdueShortLabelOf({ kind: 'hot_unanswered', since: hoursAgo(0.77) }, now)).toBe('Sin responder 46 min');
    expect(overdueShortLabelOf({ kind: 'to_quote_late', since: hoursAgo(27) }, now)).toBe('Sin cotizar 27 horas');
    expect(overdueShortLabelOf({ kind: 'quote_unanswered', since: hoursAgo(96) }, now)).toBe('Cotización sin respuesta 4 días');
    expect(overdueLabelOf({ kind: 'hot_unanswered', since: hoursAgo(0.5) }, now)).toBe('Escribió hace 30 min y nadie le respondió');
    expect(overdueLabelOf({ kind: 'hot_unanswered', since: hoursAgo(5) }, now)).toBe('Escribió hace 5 horas y nadie le respondió');
    expect(overdueLabelOf({ kind: 'hot_unanswered', since: hoursAgo(120) }, now)).toBe('Escribió hace 5 días y nadie le respondió');
    expect(overdueLabelOf({ kind: 'to_quote_late', since: hoursAgo(72) }, now)).toBe('Listo hace 3 días · sin cotización');
    expect(nextActionWhenOf('2026-11-17T21:00:00.000Z', now)).toBe('Hoy 16:00');
    expect(nextActionWhenOf('2026-11-18T14:00:00.000Z', now)).toBe('Mañana 09:00');
    expect(nextActionWhenOf('2026-11-19T15:00:00.000Z', now)).toBe('jue 19, 10:00');
  });
});

describe('periodStartOf', () => {
  it('starts today, the last 7 days and this month at midnight in Lima', () => {
    expect(periodStartOf('today', now)).toBe('2026-11-17T05:00:00.000Z');
    expect(periodStartOf('week', now)).toBe('2026-11-11T05:00:00.000Z');
    expect(periodStartOf('month', now)).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('arrivedThisMonth', () => {
  it('counts the prospects born since the 1st at 00:00 in Lima, closed ones too', () => {
    const board = [
      prospect({ createdAt: '2026-11-01T05:00:00.000Z' }),
      prospect({ createdAt: '2026-11-01T04:59:59.000Z' }),
      prospect({ createdAt: hoursAgo(2), result: { outcome: 'lost', reason: 'price', at: hoursAgo(1) } }),
      prospect({ createdAt: '2026-10-20T15:00:00.000Z' }),
    ];
    expect(arrivedThisMonth(board, now)).toBe(2);
  });

  it('is zero for an empty board', () => {
    expect(arrivedThisMonth([], now)).toBe(0);
  });
});
