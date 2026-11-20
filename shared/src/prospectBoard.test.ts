import { describe, expect, it } from 'vitest';
import { funnelOf, followUpsOf, inboxOf, inboxSectionOf, isSalesProspect, lacksNextAction, levelOf, missingLabelsOf, originOf, overdueOf, shownStageOf, type ProspectView } from './prospectBoard.js';

/** Dali's inbox and funnel (dl-01, dl-08, BOTS-API «Fase 2: contrato»): every rule is code, never data. */
const now = new Date('2026-11-17T15:00:00.000Z'); // 10:00 in Lima
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const ME = '6aecc7a354a328c01722f256';
const ROSA = '6aecc7a354a328c01722f257';

let next = 0;
function prospect(overrides: Partial<ProspectView> = {}): ProspectView {
  next += 1;
  return { id: `dali:constroad:${next}`, chatId: `chat${next}`, phone: '51949123824', lastActivityAt: minutesAgo(5), attendedBy: 'dali', version: 0, createdAt: minutesAgo(60), ...overrides };
}

describe('shownStageOf', () => {
  it('shows the result a seller marked over the stage agentes sent', () => {
    expect(shownStageOf(prospect({ stage: 'negotiation', result: { outcome: 'lost', reason: 'price', at: minutesAgo(1) } }))).toBe('lost');
  });

  it('starts at «missing information» while agentes has not said', () => {
    expect(shownStageOf(prospect())).toBe('missing_info');
  });
});

describe('levelOf', () => {
  it.each([
    [70, 'hot'],
    [69, 'warm'],
    [40, 'warm'],
    [39, 'cold'],
    [undefined, null],
  ])('%s → %s', (score, level) => {
    expect(levelOf(score)).toBe(level);
  });
});

describe('originOf', () => {
  it('names a click-to-WhatsApp ad «Meta» when agentes has not said which platform', () => {
    expect(originOf(prospect({ source: { kind: 'ctwa', adTitle: 'Asfalto' } }))).toEqual({ key: 'meta', label: 'Meta' });
    expect(originOf(prospect())).toEqual({ key: 'direct', label: 'Directo' });
  });

  it('José 20/11: names the platform once agentes sends it, keeping «meta» as the key', () => {
    expect(originOf(prospect({ source: { kind: 'ctwa', platform: 'instagram' } }))).toEqual({ key: 'meta', label: 'Instagram' });
    expect(originOf(prospect({ source: { kind: 'ctwa', platform: 'facebook' } }))).toEqual({ key: 'meta', label: 'Facebook' });
  });
});

describe('overdueOf', () => {
  it('flags a prospect ready to quote for more than 24 h', () => {
    expect(overdueOf(prospect({ stage: 'to_quote', readyAt: minutesAgo(27 * 60) }), now)).toEqual({ kind: 'to_quote_late', since: minutesAgo(27 * 60) });
    expect(overdueOf(prospect({ stage: 'to_quote', readyAt: minutesAgo(23 * 60) }), now)).toBeNull();
  });

  it('flags a quote with no answer for more than 3 days, not one the client answered', () => {
    const sentAt = minutesAgo(4 * 24 * 60);
    expect(overdueOf(prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt }, lastContactAt: minutesAgo(5 * 24 * 60) }), now)).toEqual({ kind: 'quote_unanswered', since: sentAt });
    expect(overdueOf(prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt }, lastContactAt: minutesAgo(60) }), now)).toBeNull();
  });

  it('flags a hot prospect that wrote 15 min ago and no person answered', () => {
    expect(overdueOf(prospect({ score: 86, lastContactAt: minutesAgo(20) }), now)).toEqual({ kind: 'hot_unanswered', since: minutesAgo(20) });
    expect(overdueOf(prospect({ score: 86, lastContactAt: minutesAgo(20), lastTeamReplyAt: minutesAgo(10) }), now)).toBeNull();
    expect(overdueOf(prospect({ score: 86, lastContactAt: minutesAgo(10) }), now)).toBeNull();
  });

  it('counts a quote sent after the last message as the team\'s answer: then it waits on the client, not on us', () => {
    const quoted = prospect({ score: 78, stage: 'quoted', lastContactAt: minutesAgo(5 * 24 * 60), quote: { code: 'COT-1', sentAt: minutesAgo(4 * 24 * 60) } });
    expect(overdueOf(quoted, now)).toEqual({ kind: 'quote_unanswered', since: minutesAgo(4 * 24 * 60) });
  });

  it('never flags a closed prospect', () => {
    expect(overdueOf(prospect({ stage: 'to_quote', readyAt: minutesAgo(50 * 60), result: { outcome: 'won', at: minutesAgo(1) } }), now)).toBeNull();
  });
});

describe('lacksNextAction', () => {
  it('asks for a next action on an open prospect with none and no follow-up drafted', () => {
    expect(lacksNextAction(prospect())).toBe(true);
    expect(lacksNextAction(prospect({ followUpDraft: { text: 'Hola', forAt: minutesAgo(-60) } }))).toBe(false);
    expect(lacksNextAction(prospect({ nextAction: { kind: 'call', at: minutesAgo(-60), assigneeId: ME } }))).toBe(false);
    expect(lacksNextAction(prospect({ result: { outcome: 'lost', reason: 'price', at: minutesAgo(1) } }))).toBe(false);
  });
});

describe('inboxSectionOf', () => {
  it('puts what a person must answer now first', () => {
    expect(inboxSectionOf(prospect({ score: 81 }), now)).toBe('now');
    expect(inboxSectionOf(prospect({ stage: 'to_quote' }), now)).toBe('now');
    expect(inboxSectionOf(prospect({ attendedBy: 'human', assignee: { id: ROSA, name: 'Rosa' }, lastContactAt: minutesAgo(3), lastTeamReplyAt: minutesAgo(30) }), now)).toBe('now');
  });

  it('keeps what someone already follows apart from what Dali is still talking', () => {
    expect(inboxSectionOf(prospect({ stage: 'quoted', score: 78, assignee: { id: ROSA, name: 'Rosa' } }), now)).toBe('following');
    expect(inboxSectionOf(prospect({ score: 22 }), now)).toBe('dali');
  });
});

describe('inboxOf', () => {
  const services = { mezcla: { key: 'venta_mezcla', name: 'Venta de mezcla' }, base: { key: 'base', name: 'Base' } };
  const board = [
    prospect({ score: 81, service: services.mezcla }),
    prospect({ score: 78, stage: 'quoted', assignee: { id: ME, name: 'José' }, service: services.mezcla }),
    prospect({ score: 22, service: services.base }),
    prospect({ score: 90, result: { outcome: 'won', at: minutesAgo(30) }, assignee: { id: ME, name: 'José' } }),
  ];

  it('counts open prospects for each view and leaves the closed ones out', () => {
    const inbox = inboxOf(board, { me: ME, view: 'all' }, now);
    expect(inbox.counts).toEqual({ mine: 1, unassigned: 2, all: 3 });
    expect(inbox.sections.map((section) => [section.label, section.items.length])).toEqual([
      ['Atender ahora', 1],
      ['En seguimiento', 1],
      ['Dali conversando', 1],
    ]);
  });

  it('filters by view and by service, and lists the services with their open prospects', () => {
    expect(inboxOf(board, { me: ME, view: 'mine' }, now).sections.flatMap((section) => section.items).map((item) => item.score)).toEqual([78]);
    expect(inboxOf(board, { me: ME, view: 'all', service: 'base' }, now).sections.flatMap((section) => section.items).map((item) => item.score)).toEqual([22]);
    expect(inboxOf(board, { me: ME, view: 'all' }, now).services).toEqual([
      { key: 'venta_mezcla', name: 'Venta de mezcla', count: 2 },
      { key: 'base', name: 'Base', count: 1 },
    ]);
  });

  it('folds the plain questions Dali answers alone into «Solo consultas», out of the team\'s way', () => {
    const asked = prospect({ score: 12, intent: 'information' });
    const taken = prospect({ score: 30, intent: 'information', assignee: { id: ME, name: 'José' } });
    const inbox = inboxOf([...board, asked, taken], { me: ME, view: 'all' }, now);
    expect(inbox.consults.map((item) => item.id)).toEqual([asked.id]);
    expect(inbox.sections.flatMap((section) => section.items).map((item) => item.id)).not.toContain(asked.id);
    expect(inbox.sections.flatMap((section) => section.items).map((item) => item.id)).toContain(taken.id);
    expect(inbox.counts.all).toBe(5);
  });

  it('José 20/11: a direct chat agentes marked `listing: \'chat\'` never counts as a prospect', () => {
    const chat = prospect({ score: 95, listing: 'chat' });
    const inbox = inboxOf([...board, chat], { me: ME, view: 'all' }, now);
    expect(inbox.counts.all).toBe(3);
    expect(inbox.sections.flatMap((section) => section.items).map((item) => item.id)).not.toContain(chat.id);
  });
});

describe('isSalesProspect', () => {
  it('is true without a listing (today\'s prospects) and false only for a direct chat', () => {
    expect(isSalesProspect({})).toBe(true);
    expect(isSalesProspect({ listing: 'prospect' })).toBe(true);
    expect(isSalesProspect({ listing: 'chat' })).toBe(false);
  });
});

describe('followUpsOf', () => {
  it('lists my actions due by the end of the day in Lima and the follow-ups Dali drafted for today', () => {
    const late = prospect({ nextAction: { kind: 'call', at: minutesAgo(90), assigneeId: ME } });
    const later = prospect({ nextAction: { kind: 'whatsapp', at: minutesAgo(-120), assigneeId: ME } });
    const tomorrow = prospect({ nextAction: { kind: 'visit', at: '2026-11-18T15:00:00.000Z', assigneeId: ME } });
    const rosas = prospect({ nextAction: { kind: 'call', at: minutesAgo(-30), assigneeId: ROSA } });
    const drafted = prospect({ followUpDraft: { text: 'Hola Carmen', forAt: minutesAgo(-60) } });
    const followUps = followUpsOf([late, later, tomorrow, rosas, drafted], ME, now);
    expect(followUps.items.map((item) => item.prospect.id)).toEqual([late.id, drafted.id, later.id]);
    expect(followUps.overdue).toBe(1);
  });

  it('a direct chat never shows up as a follow-up', () => {
    const chat = prospect({ listing: 'chat', nextAction: { kind: 'call', at: minutesAgo(90), assigneeId: ME } });
    expect(followUpsOf([chat], ME, now).items).toEqual([]);
  });
});

describe('funnelOf', () => {
  it('splits the open prospects and the ones closed since the period start by stage, with the four figures', () => {
    const since = minutesAgo(7 * 24 * 60);
    const board = [
      prospect({ stage: 'missing_info', name: 'Patricia' }),
      prospect({ stage: 'to_quote', readyAt: minutesAgo(27 * 60), name: 'Víctor' }),
      prospect({ stage: 'quoted', quote: { code: 'COT-1', sentAt: minutesAgo(4 * 24 * 60) }, nextAction: { kind: 'call', at: minutesAgo(-60), assigneeId: ME }, name: 'Luis' }),
      prospect({ result: { outcome: 'won', at: minutesAgo(60) }, name: 'Gabriela' }),
      prospect({ result: { outcome: 'lost', reason: 'price', at: minutesAgo(30 * 24 * 60) }, name: 'Viejo' }),
    ];
    const funnel = funnelOf(board, { since }, now);
    expect(funnel.columns.map((column) => [column.stage, column.items.map((item) => item.name)])).toEqual([
      ['missing_info', ['Patricia']],
      ['to_quote', ['Víctor']],
      ['visit', []],
      ['quoted', ['Luis']],
      ['negotiation', []],
      ['won', ['Gabriela']],
      ['lost', []],
    ]);
    expect(funnel.figures).toEqual({
      missingInfo: 1,
      toQuote: { count: 1, late: [{ name: 'Víctor', since: minutesAgo(27 * 60) }] },
      quoteUnanswered: { count: 1, late: [{ name: 'Luis', since: minutesAgo(4 * 24 * 60) }] },
      withoutNextAction: ['Patricia', 'Víctor'],
    });
  });

  it('a direct chat never joins a column or a figure', () => {
    const since = minutesAgo(7 * 24 * 60);
    const chat = prospect({ stage: 'missing_info', listing: 'chat', name: 'Chateando' });
    const funnel = funnelOf([chat], { since }, now);
    expect(funnel.columns.flatMap((column) => column.items)).toEqual([]);
    expect(funnel.figures.missingInfo).toBe(0);
    expect(funnel.open).toBe(0);
  });
});

describe('missingLabelsOf', () => {
  it('names what is missing with the label agentes sent, or the key made readable', () => {
    expect(missingLabelsOf(prospect({ missing: ['fecha', 'lugar_de_obra'], fields: [{ key: 'fecha', label: 'Fecha', value: '' }] }))).toEqual(['Fecha', 'lugar de obra']);
  });
});
