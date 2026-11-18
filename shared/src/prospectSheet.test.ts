import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { validateSellerChange } from './prospectSeller.js';
import {
  NEXT_ACTION_NOTE_LIMIT,
  PAST_TIME_MESSAGE,
  RESULT_NOTE_LIMIT,
  arrivalLabelOf,
  nextActionDraftOf,
  nextActionLineOf,
  nextActionPatchOf,
  originLineOf,
  prospectDialUrl,
  prospectResultLabelOf,
  prospectStripOf,
  quoteAmountOf,
  quoteSentLabelOf,
  documentSentLabelOf,
  reassignChoicesOf,
  resultDraftOf,
  resultHeaderLineOf,
  resultMissingOf,
  resultPatchOf,
  stageWalkOf,
  suggestionLineOf,
} from './prospectSheet.js';

/** A prospect's conversation, ficha and forms on a phone (dl-02, dl-03, dl-06, dl-07, dl-09), in Lima time. */
const NOW = new Date('2026-11-17T15:12:00.000Z'); // Tue 17/11, 10:12 in Lima
const ME = '6739f0c2a1b2c3d4e5f60701';
const ROSA = { id: '6739f0c2a1b2c3d4e5f60702', name: 'Rosa Quispe' };
const MARCO = '6739f0c2a1b2c3d4e5f60703';
const carmen = (overrides: Partial<ProspectView> = {}): ProspectView => ({
  id: 'dali:51949123824',
  chatId: '6739f0c2a1b2c3d4e5f60718',
  name: 'Carmen Villanueva',
  phone: '51949123824',
  lastActivityAt: '2026-11-17T15:00:00.000Z',
  attendedBy: 'dali',
  version: 3,
  createdAt: '2026-11-16T15:42:00.000Z',
  ...overrides,
});

describe('prospectStripOf (dl-02 strip)', () => {
  it('says who attends it and that Dali is paused, offering to hand it back', () => {
    // Arrange
    const prospect = carmen({ assignee: ROSA, attendedBy: 'human' });
    // Act
    const strip = prospectStripOf(prospect);
    // Assert
    expect(strip).toEqual({ result: null, who: { label: 'Atiende Rosa Quispe', taken: true }, state: 'Dali en pausa', canTake: false, canHandBack: true });
  });

  it('offers «Tomar» while nobody attends it and Dali converses', () => {
    const strip = prospectStripOf(carmen());
    expect(strip.who).toEqual({ label: 'Sin asignar', taken: false });
    expect(strip.state).toBe('Dali conversa');
    expect([strip.canTake, strip.canHandBack]).toEqual([true, false]);
  });

  it('a person answered without taking it: both «Tomar» and «Devolver a Dali»', () => {
    const strip = prospectStripOf(carmen({ attendedBy: 'human' }));
    expect([strip.canTake, strip.canHandBack]).toEqual([true, true]);
  });

  it('closed, shows the result and nothing to take or hand back', () => {
    const lost = prospectStripOf(carmen({ attendedBy: 'human', result: { outcome: 'lost', reason: 'price', at: '2026-11-17T15:00:00.000Z' } }));
    expect(lost.result).toEqual({ won: false, label: 'Perdido · Precio' });
    expect([lost.canTake, lost.canHandBack]).toEqual([false, false]);
    expect(prospectStripOf(carmen({ assignee: ROSA, result: { outcome: 'won', at: '2026-11-17T15:00:00.000Z' } })).result).toEqual({ won: true, label: 'Ganado' });
  });
});

describe('prospectResultLabelOf', () => {
  it.each([
    [{ outcome: 'won' as const }, 'Ganado'],
    [{ outcome: 'lost' as const }, 'Perdido'],
    [{ outcome: 'lost' as const, reason: 'other' as const }, 'Perdido · Otro'],
    [{ outcome: 'lost' as const, reason: 'no_answer' as const }, 'Perdido · No respondió'],
  ])('%j reads «%s»', (result, label) => {
    expect(prospectResultLabelOf(result)).toBe(label);
  });
});

describe('stageWalkOf (dl-03 stage)', () => {
  it('marks the stages walked, the current one and the ones to come', () => {
    const walk = stageWalkOf(carmen({ stage: 'quoted' }));
    expect(walk.lost).toBeNull();
    expect(walk.steps.map((step) => [step.label, step.state])).toEqual([
      ['Falta información', 'done'],
      ['Por cotizar', 'done'],
      ['Visita', 'done'],
      ['Cotización enviada', 'current'],
      ['Negociación', 'next'],
      ['Ganado', 'next'],
    ]);
  });

  it('without a stage, Dali is still asking', () => {
    expect(stageWalkOf(carmen()).steps[0]).toEqual({ stage: 'missing_info', label: 'Falta información', state: 'current' });
  });

  it('a won result wins over agentes\' stage', () => {
    const walk = stageWalkOf(carmen({ stage: 'negotiation', result: { outcome: 'won', at: '2026-11-17T15:00:00.000Z' } }));
    expect(walk.steps.at(-1)?.state).toBe('current');
    expect(walk.steps.filter((step) => step.state === 'done')).toHaveLength(5);
  });

  it('lost is said apart, with its reason when there is one', () => {
    expect(stageWalkOf(carmen({ result: { outcome: 'lost', reason: 'zone', at: '2026-11-17T15:00:00.000Z' } }))).toEqual({ lost: 'Perdido · Fuera de zona', steps: [] });
    expect(stageWalkOf(carmen({ stage: 'lost' }))).toEqual({ lost: 'Perdido', steps: [] });
  });
});

describe('quoteAmountOf (only an admin receives it)', () => {
  it('soles as the rest of the app shows money', () => {
    expect(quoteAmountOf({ code: 'COT-2026-0241', amount: 30798, currency: 'PEN' })).toBe('S/ 30,798.00');
    expect(quoteAmountOf({ code: 'COT-2026-0241', amount: 30798 })).toBe('S/ 30,798.00');
  });

  it('another currency with its code', () => {
    expect(quoteAmountOf({ code: 'COT-2026-0242', amount: 1250.5, currency: 'USD' })).toBe('USD 1250.50');
  });

  it('nothing when the server stripped it (a member who is not admin)', () => {
    expect(quoteAmountOf({ code: 'COT-2026-0241', currency: 'PEN' })).toBeNull();
  });
});

describe('dates in Lima', () => {
  it('says when it arrived, from the first contact', () => {
    expect(arrivalLabelOf(carmen({ firstContactAt: '2026-11-16T15:42:00.000Z' }))).toBe('Llegó el lunes 16 de noviembre, 10:42');
  });

  it('without a first contact, from when its channel was born; late at night it is still that day in Lima', () => {
    expect(arrivalLabelOf(carmen({ createdAt: '2026-11-17T04:30:00.000Z' }))).toBe('Llegó el lunes 16 de noviembre, 23:30');
  });

  it('says the day a quote went out', () => {
    expect(quoteSentLabelOf('2026-11-17T03:00:00.000Z')).toBe('Enviada el 16 de noviembre');
  });

  it('says when the client sent a document, in Lima time (late at night it is still the day before)', () => {
    expect(documentSentLabelOf('2026-11-17T14:02:00.000Z')).toBe('Lo envió el 17 de noviembre, 09:02');
    expect(documentSentLabelOf('2026-11-17T04:30:00.000Z')).toBe('Lo envió el 16 de noviembre, 23:30');
  });
});

describe('lines of the ficha and the forms', () => {
  it('the origin: the ad that brought it, or a direct message', () => {
    expect(originLineOf(carmen({ source: { kind: 'ctwa', adTitle: 'Asfalto para condominios' } }))).toBe('Anuncio · Asfalto para condominios');
    expect(originLineOf(carmen())).toBe('Escribió directo por WhatsApp');
  });

  it('the result\'s header: the service and the phone, or only the phone', () => {
    expect(resultHeaderLineOf(carmen({ service: { key: 'pavimentacion', name: 'Pavimentación de estacionamiento' } }))).toBe('Pavimentación de estacionamiento · +51 949 123 824');
    expect(resultHeaderLineOf(carmen())).toBe('+51 949 123 824');
  });

  it('calls with the phone\'s dialer, never a Lilachat call', () => {
    expect(prospectDialUrl('51949123824')).toBe('tel:+51949123824');
  });

  it('the next action and Dali\'s suggestion, said as the ficha says them', () => {
    expect(nextActionLineOf({ kind: 'visit', at: '2026-11-19T15:00:00.000Z' }, NOW)).toBe('Visita técnica · jue 19, 10:00');
    expect(suggestionLineOf({ kind: 'call', at: '2026-11-18T14:00:00.000Z' }, NOW)).toBe('Llamar mañana 09:00.');
  });
});

describe('reassignChoicesOf (Reasignar)', () => {
  const members = [
    { id: 'm1', userId: ME, name: 'Yo' },
    { id: 'm2', userId: ROSA.id, name: 'Rosa Quispe' },
    { id: 'm3', userId: MARCO, name: 'Marco Salas' },
    { id: 'm4', email: 'invitada@constroad.pe' },
  ];

  it('offers the other members, never whoever has it, me, or an invitation without an account', () => {
    const choices = reassignChoicesOf(members, carmen({ assignee: ROSA }), ME);
    expect(choices.takeIt).toBe(true);
    expect(choices.members.map((member) => member.userId)).toEqual([MARCO]);
  });

  it('mine: no «Tomarlo yo»', () => {
    const choices = reassignChoicesOf(members, carmen({ assignee: { id: ME, name: 'Yo' } }), ME);
    expect(choices.takeIt).toBe(false);
    expect(choices.members.map((member) => member.userId)).toEqual([ROSA.id, MARCO]);
  });

  it('an empty directory leaves only taking it or letting it go', () => {
    expect(reassignChoicesOf([], carmen({ assignee: ROSA }), ME)).toEqual({ takeIt: true, members: [] });
  });
});

describe('the result form (dl-06, dl-07)', () => {
  it('starts from the result already marked, or empty', () => {
    expect(resultDraftOf(carmen())).toEqual({ outcome: null, reason: null, note: '' });
    expect(resultDraftOf(carmen({ result: { outcome: 'lost', reason: 'other', note: 'Lo hizo su cuñado', at: '2026-11-17T15:00:00.000Z' } }))).toEqual({ outcome: 'lost', reason: 'other', note: 'Lo hizo su cuñado' });
  });

  it.each([
    [{ outcome: null, reason: null, note: '' }, 'Elige si se ganó o se perdió.'],
    [{ outcome: 'lost' as const, reason: null, note: '' }, 'Elige por qué se perdió.'],
    [{ outcome: 'lost' as const, reason: 'other' as const, note: '   ' }, 'Cuenta en una línea qué pasó.'],
    [{ outcome: 'lost' as const, reason: 'price' as const, note: '' }, ''],
    [{ outcome: 'won' as const, reason: null, note: '' }, ''],
  ])('%j asks «%s»', (draft, missing) => {
    expect(resultMissingOf(draft)).toBe(missing);
  });

  it('a win drops a reason picked before switching, and trims the note', () => {
    // Act
    const planned = resultPatchOf({ outcome: 'won', reason: 'price', note: '  Cerró por WhatsApp  ' });
    // Assert
    expect(planned).toEqual({ ok: true, patch: { result: { outcome: 'won', note: 'Cerró por WhatsApp' } } });
  });

  it('what it sends is what the server takes', () => {
    const planned = resultPatchOf({ outcome: 'lost', reason: 'other', note: 'Lo hizo su cuñado' });
    expect(planned.ok && validateSellerChange({ version: 3, ...planned.patch }).ok).toBe(true);
  });

  it('refuses with the reason when something is missing', () => {
    expect(resultPatchOf({ outcome: 'lost', reason: null, note: '' })).toEqual({ ok: false, message: 'Elige por qué se perdió.' });
  });

  it('the note fits the server\'s limit', () => {
    const longest = 'a'.repeat(RESULT_NOTE_LIMIT);
    expect(validateSellerChange({ version: 3, result: { outcome: 'won', note: longest } }).ok).toBe(true);
    expect(validateSellerChange({ version: 3, result: { outcome: 'won', note: `${longest}a` } }).ok).toBe(false);
  });
});

describe('the next-action form (dl-09)', () => {
  it('starts from the planned action', () => {
    const planned = { kind: 'visit' as const, at: '2026-11-19T15:00:00.000Z', assigneeId: ME, note: 'Condominio Los Álamos, Ate' };
    expect(nextActionDraftOf(carmen({ nextAction: planned }), NOW)).toEqual({ kind: 'visit', at: planned.at, remind: true, note: planned.note });
  });

  it('without one, from Dali\'s suggestion', () => {
    expect(nextActionDraftOf(carmen({ stage: 'to_quote', readyAt: '2026-11-17T14:00:00.000Z' }), NOW)).toEqual({ kind: 'quote', at: '2026-11-17T17:00:00.000Z', remind: true, note: '' });
  });

  it('without a suggestion, a call at the first time offered', () => {
    expect(nextActionDraftOf(carmen({ stage: 'missing_info', score: 20 }), NOW)).toEqual({ kind: 'call', at: '2026-11-17T17:00:00.000Z', remind: true, note: '' });
  });

  it('refuses a time already gone, but not the minute that is passing', () => {
    expect(nextActionPatchOf({ kind: 'call', at: '2026-11-17T15:10:00.000Z', remind: true, note: '' }, NOW)).toEqual({ ok: false, message: PAST_TIME_MESSAGE });
    expect(nextActionPatchOf({ kind: 'call', at: '2026-11-17T15:11:30.000Z', remind: true, note: '' }, NOW).ok).toBe(true);
  });

  it('sends the reminder as chosen and the note only when written', () => {
    const planned = nextActionPatchOf({ kind: 'whatsapp', at: '2026-11-18T14:00:00.000Z', remind: false, note: '   ' }, NOW);
    expect(planned).toEqual({ ok: true, patch: { next_action: { kind: 'whatsapp', at: '2026-11-18T14:00:00.000Z', remind: false } } });
    expect(planned.ok && validateSellerChange({ version: 3, ...planned.patch }).ok).toBe(true);
  });

  it('the note fits the server\'s limit', () => {
    const longest = 'a'.repeat(NEXT_ACTION_NOTE_LIMIT);
    const at = '2026-11-18T14:00:00.000Z';
    expect(validateSellerChange({ version: 3, next_action: { kind: 'call', at, note: longest } }).ok).toBe(true);
    expect(validateSellerChange({ version: 3, next_action: { kind: 'call', at, note: `${longest}a` } }).ok).toBe(false);
  });
});
