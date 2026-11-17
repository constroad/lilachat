import { describe, expect, it } from 'vitest';
import { followUpsOf, inboxOf, type ProspectView } from './prospectBoard.js';
import { followUpsLineOf, inboxAttendantOf, inboxRowsOf, shownInboxOf, type InboxFold } from './prospectInboxRows.js';

/** The Dali inbox of the APK as one flat list (dl-01 v3): the same blocks and texts as the web's. */
const now = new Date('2026-11-17T20:00:00.000Z'); // 15:00 in Lima
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const ME = '6aecc7a354a328c01722f256';
const ROSA = { id: '6aecc7a354a328c01722f257', name: 'Rosa Quispe' };
const DAY_MINUTES = 24 * 60;
const CLOSED: Record<InboxFold, boolean> = { consults: false, team: false };
const OPEN: Record<InboxFold, boolean> = { consults: true, team: true };

let next = 0;
function prospect(overrides: Partial<ProspectView> = {}): ProspectView {
  next += 1;
  const serial = String(next).padStart(4, '0');
  return { id: `dali:5194912${serial}`, chatId: `6739f0c2a1b2c3d4e5f6${serial}`, phone: `5194912${serial}`, lastActivityAt: minutesAgo(5), attendedBy: 'dali', version: 1, createdAt: minutesAgo(60), ...overrides };
}
const chat = (id: string, unread = 0) => ({ id, unread });

const hot = prospect({ name: 'Ricardo Huamán', score: 81, stage: 'to_quote', readyAt: minutesAgo(20) });
const mine = prospect({ name: 'Elena Rojas', score: 64, assignee: { id: ME, name: 'José Zamora' }, lastActivityAt: minutesAgo(3 * DAY_MINUTES) });
const asked = prospect({ score: 22, intent: 'information' });
const BOARD = [hot, mine, asked];

const rowsOf = (prospects: ProspectView[], extra: Partial<Parameters<typeof inboxRowsOf>[0]> = {}) =>
  inboxRowsOf({ list: { prospects }, failed: false, inbox: inboxOf(prospects, { me: ME, view: 'all' }, now), teamChats: [], open: CLOSED, ...extra });

describe('shownInboxOf', () => {
  it('opens on «Míos» when something is mine', () => {
    // Arrange
    const params = { me: ME, chosen: null };
    // Act
    const shown = shownInboxOf(BOARD, params, now);
    // Assert
    expect(shown.view).toBe('mine');
    expect(shown.inbox.sections.flatMap((section) => section.items)).toEqual([mine]);
  });

  it('opens on «Todos» when nothing is mine', () => {
    const shown = shownInboxOf([hot, asked], { me: ME, chosen: null }, now);
    expect(shown.view).toBe('all');
    expect(shown.inbox.counts).toEqual({ mine: 0, unassigned: 2, all: 2 });
  });

  it('keeps the view the seller chose, even an empty one', () => {
    const shown = shownInboxOf([hot], { me: ME, chosen: 'mine' }, now);
    expect(shown.view).toBe('mine');
    expect(shown.inbox.sections).toEqual([]);
  });

  it('counts «Míos» inside the chosen service: mine in another one opens on «Todos»', () => {
    const paving = { key: 'asfaltado', name: 'Asfaltado' };
    const mix = { key: 'venta_mezcla', name: 'Venta de mezcla' };
    const shown = shownInboxOf([{ ...mine, service: paving }, { ...hot, service: mix }], { me: ME, chosen: null, service: 'venta_mezcla' }, now);
    expect(shown.view).toBe('all');
    expect(shown.inbox.counts.all).toBe(1);
  });
});

describe('inboxRowsOf', () => {
  it('shows the skeleton while the first reading is on its way', () => {
    const rows = inboxRowsOf({ list: null, failed: false, inbox: inboxOf([], { me: ME, view: 'all' }, now), teamChats: [], open: CLOSED });
    expect(rows).toEqual([{ kind: 'loading', key: 'loading' }]);
  });

  it('offers to retry when the first reading failed', () => {
    const rows = inboxRowsOf({ list: null, failed: true, inbox: inboxOf([], { me: ME, view: 'all' }, now), teamChats: [], open: CLOSED });
    expect(rows).toEqual([{ kind: 'failed', key: 'failed' }]);
  });

  it('keeps what it has when a later reading fails', () => {
    const rows = rowsOf(BOARD, { failed: true });
    expect(rows.some((row) => row.kind === 'failed')).toBe(false);
    expect(rows.some((row) => row.kind === 'prospect')).toBe(true);
  });

  it('says what fills an inbox that never had a prospect', () => {
    expect(rowsOf([])).toEqual([{ kind: 'empty', key: 'empty', title: 'Todavía no hay prospectos.', hint: 'Cuando alguien escriba por WhatsApp, Dali le contesta primero y aparece aquí.' }]);
  });

  it('points to «Todos» when only this view is empty', () => {
    const rows = inboxRowsOf({ list: { prospects: [hot] }, failed: false, inbox: inboxOf([hot], { me: ME, view: 'mine' }, now), teamChats: [], open: CLOSED });
    expect(rows).toEqual([{ kind: 'empty', key: 'empty', title: 'Nada en esta vista.', hint: 'Prueba con «Todos» o con otro servicio.' }]);
  });

  it('puts each section under its kicker with how many it holds', () => {
    // Act
    const rows = rowsOf(BOARD);
    // Assert
    expect(rows.slice(0, 2)).toEqual([
      { kind: 'kicker', key: 'kicker:now', section: 'now', label: 'Atender ahora · 1' },
      { kind: 'prospect', key: `prospect:${hot.id}`, prospect: hot, place: 'none' },
    ]);
    expect(rows[2]).toEqual({ kind: 'kicker', key: 'kicker:following', section: 'following', label: 'En seguimiento · 1' });
  });

  it('folds «Solo consultas» until it is opened, and the last one closes the card', () => {
    const other = prospect({ intent: 'information', score: 10 });
    const fold = { kind: 'fold', key: 'fold:consults', fold: 'consults', title: 'Solo consultas · 2', hint: 'Dali las atiende solo y no ocupan al equipo' };
    expect(rowsOf([asked, other])).toEqual([{ ...fold, open: false }]);
    const opened = rowsOf([asked, other], { open: { consults: true, team: false } });
    expect(opened.map((row) => (row.kind === 'prospect' ? row.place : row.kind))).toEqual(['fold', 'inside', 'last']);
  });

  it('folds the team chats at the foot, saying how many have something unread', () => {
    // Arrange
    const team = [chat('6739f0c2a1b2c3d4e5f6aa01', 2), chat('6739f0c2a1b2c3d4e5f6aa02')];
    // Act
    const closed = rowsOf(BOARD, { teamChats: team });
    const opened = rowsOf(BOARD, { teamChats: team, open: OPEN });
    // Assert
    expect(closed.at(-1)).toEqual({ kind: 'fold', key: 'fold:team', fold: 'team', title: 'Chats del equipo · 2', hint: '1 con mensajes sin leer', open: false });
    expect(opened.slice(-2)).toEqual([
      { kind: 'chat', key: 'chat:6739f0c2a1b2c3d4e5f6aa01', chat: team[0], place: 'inside' },
      { kind: 'chat', key: 'chat:6739f0c2a1b2c3d4e5f6aa02', chat: team[1], place: 'last' },
    ]);
  });

  it('names the team chats plainly when nothing is unread, and has no fold without them', () => {
    expect(rowsOf(BOARD, { teamChats: [chat('6739f0c2a1b2c3d4e5f6aa03')] }).at(-1)).toMatchObject({ hint: 'Canales y mensajes directos del espacio' });
    expect(rowsOf(BOARD).some((row) => row.kind === 'fold' && row.fold === 'team')).toBe(false);
  });

  it('keeps the team chats under an empty inbox (a Dali space is still a space)', () => {
    const rows = rowsOf([], { teamChats: [chat('6739f0c2a1b2c3d4e5f6aa04')], open: OPEN });
    expect(rows.map((row) => row.kind)).toEqual(['empty', 'fold', 'chat']);
  });

  it('gives every row its own key', () => {
    const rows = rowsOf(BOARD, { teamChats: [chat('6739f0c2a1b2c3d4e5f6aa05')], open: OPEN });
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe('followUpsLineOf', () => {
  it('says how many are for today and, apart, how many are late', () => {
    const due = (minutes: number) => prospect({ nextAction: { kind: 'call', at: minutesAgo(minutes), assigneeId: ME } });
    expect(followUpsLineOf(followUpsOf([due(30), due(-60), due(-120)], ME, now))).toEqual({ today: '3 para hoy', late: ' · 1 atrasado' });
    expect(followUpsLineOf(followUpsOf([due(30), due(10)], ME, now))).toEqual({ today: '2 para hoy', late: ' · 2 atrasados' });
  });

  it('has no late part when nothing is late', () => {
    expect(followUpsLineOf({ items: [], overdue: 0 })).toEqual({ today: '0 para hoy', late: null });
  });
});

describe('inboxAttendantOf', () => {
  it('names the seller who took it', () => {
    expect(inboxAttendantOf(prospect({ assignee: ROSA }), now)).toEqual({ kind: 'seller', name: 'Rosa Quispe' });
  });

  it('says «Sin asignar» when nobody took one that needs a person now', () => {
    expect(inboxAttendantOf(hot, now)).toEqual({ kind: 'unassigned' });
  });

  it('says «Dali» while Dali converses alone, and nothing for a person without a name on it', () => {
    expect(inboxAttendantOf(prospect({ score: 30 }), now)).toEqual({ kind: 'dali' });
    expect(inboxAttendantOf(prospect({ score: 30, attendedBy: 'human' }), now)).toBeNull();
  });
});
