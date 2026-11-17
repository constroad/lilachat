import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { boardSinceOf, LOSS_ACTION, reviewWeekOf, weekReviewOf } from './prospectReview.js';

/** The weekly review (dl-10): the last whole week, Monday to Sunday in Lima. */
const now = new Date('2026-11-17T15:00:00.000Z'); // Tue 17/11 in Lima
const at = (day: number, hour = 15, minute = 0) => new Date(Date.UTC(2026, 10, day, hour, minute)).toISOString();
const ROSA = { id: '6aecc7a354a328c01722f257', name: 'Rosa Quispe' };
let next = 0;
const prospect = (overrides: Partial<ProspectView>): ProspectView => {
  next += 1;
  return { id: `p${next}`, chatId: `c${next}`, phone: '51949123824', name: `Prospecto ${next}`, lastActivityAt: at(16), attendedBy: 'dali', version: 0, createdAt: at(10), ...overrides };
};

describe('reviewWeekOf', () => {
  it('is the last whole week, Monday to Sunday, in Lima', () => {
    expect(reviewWeekOf(now)).toEqual({ from: '2026-11-09T05:00:00.000Z', to: '2026-11-16T05:00:00.000Z', label: '9 al 15 de noviembre' });
    expect(reviewWeekOf(new Date('2026-12-02T15:00:00.000Z')).label).toBe('23 al 29 de noviembre');
    expect(reviewWeekOf(new Date('2026-12-08T15:00:00.000Z')).label).toBe('30 de noviembre al 6 de diciembre');
  });
});

describe('boardSinceOf', () => {
  it('asks from whatever starts first: the month, the last 7 days or the review week', () => {
    expect(boardSinceOf(now)).toBe('2026-11-01T05:00:00.000Z');
    expect(boardSinceOf(new Date('2026-11-02T15:00:00.000Z'))).toBe('2026-10-26T05:00:00.000Z');
  });
});

describe('weekReviewOf', () => {
  const board = [
    prospect({ result: { outcome: 'won', at: at(13), by: ROSA }, quote: { code: 'COT-1', amount: 8900, currency: 'PEN' } }),
    prospect({ result: { outcome: 'won', at: at(16) } }),
    prospect({ result: { outcome: 'lost', reason: 'no_answer', at: at(12) } }),
    prospect({ result: { outcome: 'lost', reason: 'no_answer', at: at(14) } }),
    prospect({ result: { outcome: 'lost', reason: 'price', at: at(11) } }),
    prospect({ score: 86, readyAt: at(12, 15), firstTeamReply: { at: at(12, 15, 40), userId: ROSA.id }, stage: 'visit', unanswered: [{ question: '¿Trabajan en Huaral?', at: at(12) }] }),
    prospect({ score: 90, readyAt: at(13, 15), firstTeamReply: { at: at(13, 15, 5), userId: ROSA.id }, stage: 'visit', unanswered: [{ question: '¿trabajan en huaral', at: at(13) }, { question: '¿Dan crédito?', at: at(16) }] }),
    prospect({ name: 'Luis Mendoza', stage: 'quoted', quote: { code: 'COT-2', sentAt: at(12) }, lastContactAt: at(11) }),
    prospect({ name: 'Víctor Soto', stage: 'to_quote', readyAt: at(16, 10), nextAction: { kind: 'quote', at: at(18), assigneeId: ROSA.id } }),
    prospect({ name: '+51 912', stage: 'missing_info', lastContactAt: at(12) }),
  ];
  const review = weekReviewOf(board, now);

  it('counts what was won (with its amount and who closed it) and lost in the week, with an action per reason', () => {
    expect(review.won).toEqual({ count: 1, amounts: [{ currency: 'PEN', amount: 8900 }], by: ['Rosa Quispe'] });
    expect(review.lost).toEqual({
      count: 3,
      reasons: [
        { key: 'no_answer', label: 'No respondió', action: LOSS_ACTION.no_answer, count: 2 },
        { key: 'price', label: 'Precio', action: LOSS_ACTION.price, count: 1 },
      ],
    });
  });

  it('counts hot prospects answered after 15 min, and quotes nobody follows', () => {
    expect(review.late).toEqual({ count: 1 });
    expect(review.quotesWithoutFollowUp).toEqual({ count: 1, late: 1 });
  });

  it('groups the questions Dali could not answer in the week, the same question once', () => {
    expect(review.questions).toEqual([{ question: '¿Trabajan en Huaral?', count: 2 }]);
  });

  it('picks the conversations worth reading: late, quotes to follow and the ones that stopped writing', () => {
    expect(review.toReview.map((item) => [item.name, item.tag])).toEqual([
      ['Luis Mendoza', 'following'],
      ['Víctor Soto', 'late'],
      ['+51 912', 'dropped'],
    ]);
  });
});
