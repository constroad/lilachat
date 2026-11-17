import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { panelOf } from './prospectPanel.js';

/** Dali's sales panel (dl-04): the prospects born in the period, followed to their result. */
const from = '2026-11-01T05:00:00.000Z';
const at = (day: number, hour = 15, minute = 0, second = 0) => new Date(Date.UTC(2026, 10, day, hour, minute, second)).toISOString();
const ROSA = { id: '6aecc7a354a328c01722f257', name: 'Rosa Quispe' };
const MARCO = { id: '6aecc7a354a328c01722f258', name: 'Marco Salas' };
const ad = (title: string) => ({ kind: 'ctwa' as const, adTitle: title });

let next = 0;
function prospect(overrides: Partial<ProspectView>): ProspectView {
  next += 1;
  return { id: `p${next}`, chatId: `c${next}`, phone: '51949123824', lastActivityAt: at(16), attendedBy: 'dali', version: 0, createdAt: at(10), ...overrides };
}

const board: ProspectView[] = [
  // Won: ready, quoted, Rosa answered 10 min after it was ready.
  prospect({ source: ad('Asfalto para condominios'), intent: 'quote', stage: 'quoted', readyAt: at(10, 15), quote: { code: 'COT-1', amount: 20000, currency: 'PEN' }, assignee: ROSA, result: { outcome: 'won', at: at(14) }, firstContactAt: at(10, 14, 50), firstDaliReplyAt: at(10, 14, 50, 8), firstTeamReply: { at: at(10, 15, 10), userId: ROSA.id } }),
  // Lost for price after a quote; Marco answered 40 min after it was ready.
  prospect({ source: ad('Asfalto para condominios'), intent: 'purchase', stage: 'quoted', readyAt: at(11, 15), quote: { code: 'COT-2', amount: 9000, currency: 'PEN' }, assignee: MARCO, result: { outcome: 'lost', reason: 'price', at: at(15) }, firstContactAt: at(11, 14), firstDaliReplyAt: at(11, 14, 0, 12), firstTeamReply: { at: at(11, 15, 40), userId: MARCO.id } }),
  // Qualified, not quoted yet.
  prospect({ source: ad('Mezcla en planta'), intent: 'quote', stage: 'to_quote', readyAt: at(12), assignee: ROSA, firstContactAt: at(12, 13), firstDaliReplyAt: at(12, 13, 0, 4) }),
  // Only asked, then lost as «just asking».
  prospect({ source: ad('Mezcla en planta'), intent: 'information', stage: 'missing_info', result: { outcome: 'lost', reason: 'not_a_buyer', at: at(13) } }),
  // Wrote without an ad.
  prospect({ intent: 'other', stage: 'missing_info' }),
  // Born before the period: left out.
  prospect({ createdAt: '2026-10-20T15:00:00.000Z', source: ad('Viejo'), result: { outcome: 'won', at: at(2) } }),
];

describe('panelOf', () => {
  const panel = panelOf(board, { from });

  it('counts the prospects born in the period and how far they went', () => {
    expect(panel.totals).toEqual({ prospects: 5, qualified: 3, quoted: 2, won: 1, lost: 2, amountWon: [{ currency: 'PEN', amount: 20000 }] });
  });

  it('measures the first answer of Dali (median, seconds) and of a person since the prospect was ready (median, minutes)', () => {
    expect(panel.firstResponse).toEqual({ daliSeconds: 8, sellerMinutes: 25 });
  });

  it('splits by origin and by ad, with the ones that only asked', () => {
    expect(panel.byOrigin).toEqual([
      { key: 'meta', label: 'Meta', prospects: 4, qualified: 3, quoted: 2, won: 1, amountWon: 20000 },
      { key: 'direct', label: 'Directo', prospects: 1, qualified: 0, quoted: 0, won: 0, amountWon: 0 },
    ]);
    expect(panel.byAd).toEqual([
      { title: 'Asfalto para condominios', prospects: 2, qualified: 2, won: 1, onlyAsked: 0 },
      { title: 'Mezcla en planta', prospects: 2, qualified: 1, won: 0, onlyAsked: 1 },
    ]);
  });

  it('counts intents, sellers with their on-time answers, and the reasons of the losses', () => {
    expect(panel.intents).toEqual([
      { key: 'purchase', label: 'Quiere comprar', count: 1 },
      { key: 'quote', label: 'Pide cotización', count: 2 },
      { key: 'information', label: 'Solo consulta', count: 1 },
      { key: 'other', label: 'Otro', count: 1 },
    ]);
    expect(panel.sellers).toEqual([
      { id: ROSA.id, name: 'Rosa Quispe', assigned: 2, answered: 1, onTime: 1, quoted: 1, won: 1 },
      { id: MARCO.id, name: 'Marco Salas', assigned: 1, answered: 1, onTime: 0, quoted: 1, won: 0 },
    ]);
    expect(panel.lossReasons).toEqual([
      { key: 'price', label: 'Precio', count: 1 },
      { key: 'not_a_buyer', label: 'Solo consultaba', count: 1 },
    ]);
  });

  it('is all zeros on a period with no prospects', () => {
    const empty = panelOf([], { from });
    expect(empty.totals).toEqual({ prospects: 0, qualified: 0, quoted: 0, won: 0, lost: 0, amountWon: [] });
    expect(empty.firstResponse).toEqual({ daliSeconds: null, sellerMinutes: null });
  });
});
