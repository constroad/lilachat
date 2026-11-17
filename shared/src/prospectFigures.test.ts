import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { panelOf } from './prospectPanel.js';
import { weekReviewOf } from './prospectReview.js';
import {
  figurePercentOf,
  panelAmountOf,
  panelBarsOf,
  panelCountsOf,
  panelRangeOf,
  panelTablesOf,
  responseTimesOf,
  reviewFiguresOf,
  reviewLossesOf,
  wonAmountsText,
} from './prospectFigures.js';

/** What the Dali panel (dl-04) and the weekly review (dl-10) say with their numbers, on the web and the APK. */
const NOW = new Date('2026-11-17T20:00:00.000Z'); // Tuesday 17, 15:00 in Lima
const MINUTE_MS = 60_000;
const minutesAgo = (minutes: number): string => new Date(NOW.getTime() - minutes * MINUTE_MS).toISOString();
const ROSA = { id: 'u-rosa', name: 'Rosa Quispe' };

let next = 0;
function prospect(overrides: Partial<ProspectView> = {}): ProspectView {
  next += 1;
  return { id: `p${next}`, chatId: `c${next}`, phone: '51949123824', lastActivityAt: minutesAgo(5), attendedBy: 'dali', version: 1, createdAt: minutesAgo(60), ...overrides };
}

const BOARD = [
  prospect({ name: 'Luis Mendoza', source: { kind: 'ctwa', adTitle: 'Patios de maniobra' }, score: 78, stage: 'quoted', assignee: ROSA, quote: { code: 'COT-1', amount: 96000, currency: 'PEN', sentAt: minutesAgo(30) }, result: { outcome: 'won', at: minutesAgo(10) } }),
  prospect({ name: 'Elena Rojas', score: 64, stage: 'missing_info', intent: 'information' }),
];
const PANEL = panelOf(BOARD, { from: '2026-11-11T05:00:00.000Z' });
const EMPTY_PANEL = panelOf([], { from: '2026-11-11T05:00:00.000Z' });

describe('panelTablesOf', () => {
  it('keeps the columns that fit on a phone (dl-04 v5: prospects and conversion)', () => {
    // Act
    const tables = panelTablesOf(PANEL, true);
    // Assert
    expect(tables.origin.head).toEqual(['Origen', 'Prosp.', 'Ganados', 'Conv.']);
    expect(tables.ad.head).toEqual(['Anuncio', 'Prosp.', 'Ganados']);
    expect(tables.sellers.head).toEqual(['Vendedor', 'Asignados', 'A tiempo', 'Ganó']);
    expect(tables.origin.rows).toEqual([
      { key: 'meta', cells: ['Meta', '1', '1', '100 %'] },
      { key: 'direct', cells: ['Directo', '1', '0', '0 %'] },
    ]);
    expect(tables.sellers.rows).toEqual([{ key: 'u-rosa', cells: ['Rosa Quispe', '1', '0', '1'] }]);
  });

  it('shows every column where there is room', () => {
    // Act
    const tables = panelTablesOf(PANEL, false);
    // Assert
    expect(tables.origin.head).toEqual(['Origen', 'Prosp.', 'Calif.', 'Cotiz.', 'Ganados', 'Conv.']);
    expect(tables.ad.rows).toEqual([{ key: 'Patios de maniobra', cells: ['Patios de maniobra', '1', '1', '1', '0'] }]);
    expect(tables.sellers.head).toEqual(['Vendedor', 'Asignados', 'Respondió', 'A tiempo', 'Cotizó', 'Ganó']);
  });

  it('gives empty tables when nobody arrived', () => {
    // Act
    const tables = panelTablesOf(EMPTY_PANEL, true);
    // Assert
    expect(tables.origin.rows).toEqual([]);
    expect(tables.ad.rows).toEqual([]);
    expect(tables.sellers.rows).toEqual([]);
  });
});

describe('the panel figures', () => {
  it('says a share as a whole percent, and a dash when there is nothing to divide', () => {
    expect(figurePercentOf(1, 3)).toBe('33 %');
    expect(figurePercentOf(2, 2)).toBe('100 %');
    expect(figurePercentOf(0, 0)).toBe('—');
  });

  it('counts the cohort with the share of each step, the won ones in green only when there are any', () => {
    // Act
    const counts = panelCountsOf(PANEL.totals);
    const none = panelCountsOf(EMPTY_PANEL.totals);
    // Assert
    expect(counts).toEqual([
      { key: 'prospectos', label: 'Prospectos', value: 2, tone: 'neutral' },
      { key: 'calificados', label: 'Calificados', value: 1, percent: '50 %', tone: 'neutral' },
      { key: 'cotizados', label: 'Cotizados', value: 1, percent: '50 %', tone: 'neutral' },
      { key: 'ganados', label: 'Ganados', value: 1, percent: '50 %', tone: 'ok' },
    ]);
    expect(none[3]).toEqual({ key: 'ganados', label: 'Ganados', value: 0, percent: '—', tone: 'neutral' });
  });

  it('shows the amount won only to the space admins, and zero soles when nothing was won', () => {
    expect(panelAmountOf(PANEL.totals, true)).toBe('S/ 96,000.00');
    expect(panelAmountOf(PANEL.totals, false)).toBeNull();
    expect(panelAmountOf(EMPTY_PANEL.totals, true)).toBe('S/ 0.00');
  });

  it('says each currency on its own', () => {
    expect(wonAmountsText([])).toBe('');
    expect(wonAmountsText([{ currency: 'PEN', amount: 1000 }, { currency: 'USD', amount: 250 }])).toBe('S/ 1,000.00 + USD 250.00');
  });

  it('says a response time the way a person says it, a dash when nobody answered', () => {
    expect(responseTimesOf({ daliSeconds: 8, sellerMinutes: 14 })).toEqual({ dali: '8 s', team: '14 min' });
    expect(responseTimesOf({ daliSeconds: 90, sellerMinutes: 119 })).toEqual({ dali: '2 min', team: '119 min' });
    expect(responseTimesOf({ daliSeconds: 59, sellerMinutes: 150 })).toEqual({ dali: '59 s', team: '3 h' });
    expect(responseTimesOf({ daliSeconds: null, sellerMinutes: null })).toEqual({ dali: '—', team: '—' });
  });

  it('draws the funnel against the prospects, and the intents against the biggest one', () => {
    // Act
    const bars = panelBarsOf(PANEL);
    // Assert
    expect(bars.funnel.map((bar) => [bar.label, bar.value, bar.share])).toEqual([['Prospectos', 2, 100], ['Calificados', 1, 50], ['Cotizados', 1, 50], ['Ganados', 1, 50]]);
    expect(bars.intents.find((bar) => bar.key === 'information')).toEqual({ key: 'information', label: 'Solo consulta', value: 1, share: 100 });
    expect(bars.lossReasons).toEqual([]);
  });

  it('draws empty bars when nobody arrived, never a division by zero', () => {
    // Act
    const bars = panelBarsOf(EMPTY_PANEL);
    // Assert
    expect(bars.funnel.every((bar) => bar.share === 0)).toBe(true);
    expect(bars.intents.every((bar) => bar.share === 0)).toBe(true);
  });
});

describe('panelRangeOf', () => {
  it('says which days each period covers, in Lima', () => {
    expect(panelRangeOf('today', NOW)).toBe('17 de noviembre');
    expect(panelRangeOf('week', NOW)).toBe('11 al 17 de noviembre');
    expect(panelRangeOf('month', NOW)).toBe('1 al 17 de noviembre');
  });

  it('names both months when the last 7 days cross one', () => {
    expect(panelRangeOf('week', new Date('2026-11-03T15:00:00.000Z'))).toBe('28 de octubre al 3 de noviembre');
  });

  it('says one day on the first of the month, and follows Lima at night', () => {
    expect(panelRangeOf('month', new Date('2026-11-01T15:00:00.000Z'))).toBe('1 de noviembre');
    // 22:00 of October 31 in Lima is already November in UTC.
    expect(panelRangeOf('month', new Date('2026-11-01T03:00:00.000Z'))).toBe('1 al 31 de octubre');
  });
});

describe('the weekly review figures', () => {
  // The review week of NOW: Monday 9 to Sunday 15 of November, in Lima.
  const inWeek = (day: number): string => new Date(Date.UTC(2026, 10, day, 15)).toISOString();
  const WEEK = [
    prospect({ name: 'Gabriela Núñez', quote: { code: 'COT-9', amount: 8900, currency: 'PEN' }, result: { outcome: 'won', at: inWeek(12), by: ROSA }, unanswered: [{ question: '¿Trabajan en Huaral?', at: inWeek(10) }] }),
    prospect({ name: 'Víctor Paz', result: { outcome: 'lost', reason: 'price', at: inWeek(13) }, unanswered: [{ question: '¿trabajan en huaral', at: inWeek(11) }, { question: '¿Dan crédito a 30 días?', at: inWeek(11) }] }),
    prospect({ name: 'Ana Ruiz', result: { outcome: 'lost', reason: 'no_answer', at: inWeek(14) } }),
    prospect({ name: 'Carlos Vega', result: { outcome: 'lost', reason: 'no_answer', at: inWeek(14) } }),
  ];
  const REVIEW = weekReviewOf(WEEK, NOW);

  it('puts the amount won beside the count only for an admin, with who closed it', () => {
    // Act
    const [won] = reviewFiguresOf(REVIEW, true);
    const [hidden] = reviewFiguresOf(REVIEW, false);
    // Assert
    expect(won).toEqual({ key: 'ganados', label: 'Ganados', value: 1, pill: 'S/ 8,900.00', note: 'Cerró Rosa Quispe', tone: 'neutral' });
    expect(hidden?.pill).toBeUndefined();
  });

  it('counts the lost, the late answers, the quotes without follow-up and every unanswered question', () => {
    // Act
    const figures = reviewFiguresOf(REVIEW, true);
    // Assert
    expect(figures.map((figure) => [figure.key, figure.value])).toEqual([['ganados', 1], ['perdidos', 3], ['tarde', 0], ['sin-seguimiento', 0], ['no-supo', 3]]);
    expect(figures[2]).toEqual({ key: 'tarde', label: 'Respondimos tarde', value: 0, note: 'A un caliente, después de 15 min', tone: 'neutral' });
    expect(figures[4]?.tone).toBe('primary');
  });

  it('stays quiet for an empty week', () => {
    // Act
    const figures = reviewFiguresOf(weekReviewOf([], NOW), true);
    // Assert
    expect(figures.every((figure) => figure.value === 0 && figure.tone === 'neutral' && figure.pill === undefined)).toBe(true);
    expect(figures[0]?.note).toBeUndefined();
  });

  it('gives each loss reason its share of the lost and its action', () => {
    expect(reviewLossesOf(REVIEW)).toEqual([
      { key: 'no_answer', label: 'No respondió', count: 2, action: 'Llamar el día 4 de la secuencia', share: 67 },
      { key: 'price', label: 'Precio', count: 1, action: 'Cotizar el mismo día', share: 33 },
    ]);
    expect(reviewLossesOf(weekReviewOf([], NOW))).toEqual([]);
  });
});
