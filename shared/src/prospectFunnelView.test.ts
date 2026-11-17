import { describe, expect, it } from 'vitest';
import { funnelOf, type ProspectView } from './prospectBoard.js';
import { firstBusyStageOf, funnelAgoOf, funnelCardOf, funnelFiguresOf, funnelIsEmpty, funnelSubtitleOf } from './prospectFunnelView.js';

/** The funnel on the APK (dl-08 v5): the same figures, lines and cards as the web's. */
const now = new Date('2026-11-17T20:00:00.000Z'); // 15:00 in Lima
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;
const ROSA = { id: '6aecc7a354a328c01722f257', name: 'Rosa Quispe' };

function prospect(overrides: Partial<ProspectView> = {}): ProspectView {
  return { id: 'dali:51949123824', chatId: '6739f0c2a1b2c3d4e5f60718', phone: '51949123824', lastActivityAt: minutesAgo(5), attendedBy: 'dali', version: 2, createdAt: minutesAgo(60), ...overrides };
}
const figuresOf = (overrides: Partial<ReturnType<typeof funnelOf>['figures']> = {}) => ({
  missingInfo: 3,
  toQuote: { count: 2, late: [] },
  quoteUnanswered: { count: 2, late: [] },
  withoutNextAction: [],
  ...overrides,
});

describe('funnelAgoOf', () => {
  it.each([
    [30, '1 h'],
    [27 * HOUR_MINUTES, '27 h'],
    [47 * HOUR_MINUTES, '47 h'],
    [48 * HOUR_MINUTES, '2 días'],
    [4 * DAY_MINUTES + 5 * HOUR_MINUTES, '4 días'],
  ])('%s minutes ago → %s', (minutes, said) => {
    expect(funnelAgoOf(minutesAgo(minutes), now)).toBe(said);
  });
});

describe('funnelFiguresOf', () => {
  it('draws the four figures that need someone, in the design\'s order', () => {
    // Act
    const figures = funnelFiguresOf(figuresOf(), now);
    // Assert
    expect(figures.map((figure) => [figure.key, figure.value, figure.title])).toEqual([
      ['missing_info', 3, 'Falta información'],
      ['to_quote', 2, 'Por cotizar'],
      ['quote_unanswered', 2, 'Cotización sin respuesta'],
      ['without_next_action', 0, 'Sin próxima acción'],
    ]);
    expect(figures[0]).toMatchObject({ hint: 'Dali las está preguntando', alert: '', danger: false });
  });

  it('says how many are late, since when and who, in the gender of each figure', () => {
    // Arrange
    const toQuote = { count: 2, late: [{ name: 'Víctor Soto', since: minutesAgo(27 * HOUR_MINUTES) }] };
    const quoteUnanswered = { count: 2, late: [{ name: 'Luis Mendoza', since: minutesAgo(4 * DAY_MINUTES) }, { name: 'Elena Rojas', since: minutesAgo(5 * DAY_MINUTES) }] };
    // Act
    const figures = funnelFiguresOf(figuresOf({ toQuote, quoteUnanswered }), now);
    // Assert
    expect(figures[1]?.alert).toBe('1 vencido hace 27 h (Víctor Soto)');
    expect(figures[2]?.alert).toBe('2 vencidas hace 4 días (Luis Mendoza, Elena Rojas)');
  });

  it('marks in red the prospects without a next action, naming the first three', () => {
    const figure = funnelFiguresOf(figuresOf({ withoutNextAction: ['Carmen Villanueva', 'Jorge Paredes', '+51 912 554 018', 'Paola Ríos'] }), now)[3];
    expect(figure).toEqual({ key: 'without_next_action', value: 4, title: 'Sin próxima acción', alert: '', hint: 'Carmen Villanueva, Jorge Paredes, +51 912 554 018', danger: true });
  });
});

describe('funnelSubtitleOf', () => {
  it('counts the new ones of the period and the open ones', () => {
    expect(funnelSubtitleOf({ newSince: 10, open: 7 }, 'week')).toBe('10 nuevos en los últimos 7 días · 7 abiertos');
    expect(funnelSubtitleOf({ newSince: 1, open: 1 }, 'month')).toBe('1 nuevo este mes · 1 abierto');
    expect(funnelSubtitleOf({ newSince: 0, open: 0 }, 'month')).toBe('0 nuevos este mes · 0 abiertos');
  });
});

describe('funnelIsEmpty and firstBusyStageOf', () => {
  it('is empty with nothing open and no column holding anyone', () => {
    const empty = funnelOf([], { since: minutesAgo(7 * DAY_MINUTES) }, now);
    expect(funnelIsEmpty(empty)).toBe(true);
    expect(funnelIsEmpty(funnelOf([prospect()], { since: minutesAgo(7 * DAY_MINUTES) }, now))).toBe(false);
  });

  it('opens the phone board on the first stage that holds someone', () => {
    const funnel = funnelOf([prospect({ stage: 'quoted' })], { since: minutesAgo(7 * DAY_MINUTES) }, now);
    expect(firstBusyStageOf(funnel.columns)).toBe('quoted');
  });

  it('falls back to «Falta información» on an empty board', () => {
    expect(firstBusyStageOf(funnelOf([], { since: minutesAgo(7 * DAY_MINUTES) }, now).columns)).toBe('missing_info');
  });
});

describe('funnelCardOf', () => {
  it('says what Dali still has to ask, with the labels agentes sent', () => {
    const asking = prospect({ missing: ['ubicacion', 'fecha_entrega'], fields: [{ key: 'ubicacion', label: 'Ubicación', value: '' }] });
    expect(funnelCardOf(asking, now, true).missing).toBe('Falta: Ubicación · fecha entrega');
    expect(funnelCardOf({ ...asking, result: { outcome: 'lost', reason: 'price', at: minutesAgo(10) } }, now, true).missing).toBeNull();
  });

  it('says what is late on it', () => {
    const late = prospect({ stage: 'to_quote', readyAt: minutesAgo(27 * HOUR_MINUTES) });
    expect(funnelCardOf(late, now, false).overdue).toBe('Listo hace 27 horas · sin cotización');
  });

  it('shows the quote\'s amount only to a space admin', () => {
    const quoted = prospect({ stage: 'quoted', quote: { code: 'COT-2026-0233', amount: 96000, sentAt: minutesAgo(DAY_MINUTES) } });
    expect(funnelCardOf(quoted, now, true).quote).toEqual({ code: 'COT-2026-0233', amount: 'S/ 96,000.00' });
    expect(funnelCardOf(quoted, now, false).quote).toEqual({ code: 'COT-2026-0233', amount: null });
    expect(funnelCardOf(prospect({ quote: { code: 'COT-2026-0241' } }), now, true).quote).toEqual({ code: 'COT-2026-0241', amount: null });
  });

  it('asks for a next action, and marks the ones Dali converses alone', () => {
    const card = funnelCardOf(prospect(), now, true);
    expect(card).toMatchObject({ needsNextAction: true, daliAlone: true, quote: null, foot: null });
    expect(funnelCardOf(prospect({ assignee: ROSA }), now, true).daliAlone).toBe(false);
  });

  it('puts the next action and who attends it at the foot', () => {
    const planned = prospect({ assignee: ROSA, nextAction: { kind: 'call', at: minutesAgo(-HOUR_MINUTES), assigneeId: ROSA.id } });
    expect(funnelCardOf(planned, now, true).foot).toEqual({ assignee: 'Rosa Quispe', text: 'Próx: Hoy 16:00 · Llamar' });
    expect(funnelCardOf(prospect({ assignee: ROSA }), now, true).foot).toEqual({ assignee: 'Rosa Quispe', text: 'Rosa Quispe' });
  });
});
