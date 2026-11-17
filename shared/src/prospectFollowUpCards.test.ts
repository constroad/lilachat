import { describe, expect, it } from 'vitest';
import type { FollowUpItem, ProspectView } from './prospectBoard.js';
import { attendantLineOf, followUpGroupsOf, followUpReasonOf, hasUnsentEdits, isDraftFollowUp } from './prospectFollowUpCards.js';

/** «Seguimientos de hoy» on the APK (dl-05): the same groups, reasons and texts as the web's sheet. */
const now = new Date('2026-11-17T20:00:00.000Z'); // 15:00 in Lima
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const ME = '6aecc7a354a328c01722f256';
const DRAFT = 'Hola Elena, ¿pudo revisar la referencia para la losa deportiva de 800 m²?';

function prospect(overrides: Partial<ProspectView> = {}): ProspectView {
  return { id: 'dali:51949123824', chatId: '6739f0c2a1b2c3d4e5f60718', phone: '51949123824', lastActivityAt: minutesAgo(5), attendedBy: 'dali', version: 3, createdAt: minutesAgo(60), ...overrides };
}
const draftOf = (overrides: Partial<ProspectView> = {}, at = minutesAgo(30)): FollowUpItem => ({ prospect: prospect({ followUpDraft: { text: DRAFT, forAt: at }, ...overrides }), kind: 'draft', at });
const actionOf = (at: string, overrides: Partial<ProspectView> = {}): FollowUpItem => ({ prospect: prospect({ id: 'dali:51912554018', nextAction: { kind: 'call', at, assigneeId: ME }, ...overrides }), kind: 'action', at });

describe('followUpGroupsOf', () => {
  it('puts the late ones first and the rest of today after, each with its count', () => {
    // Arrange
    const late = draftOf();
    const later = actionOf(minutesAgo(-60));
    // Act
    const groups = followUpGroupsOf([late, later], now);
    // Assert
    expect(groups).toEqual([
      { key: 'late', title: 'Atrasados · 1', followUps: [late] },
      { key: 'today', title: 'Para hoy · 1', followUps: [later] },
    ]);
  });

  it('draws no group that would be empty', () => {
    expect(followUpGroupsOf([actionOf(minutesAgo(-30))], now).map((group) => group.key)).toEqual(['today']);
    expect(followUpGroupsOf([], now)).toEqual([]);
  });

  it('counts one due this very minute as for today, not late', () => {
    expect(followUpGroupsOf([actionOf(now.toISOString())], now).map((group) => group.key)).toEqual(['today']);
  });
});

describe('followUpReasonOf', () => {
  it('names the next action that is due', () => {
    expect(followUpReasonOf(actionOf(minutesAgo(-60)), now)).toEqual({ text: 'Llamar · Hoy 16:00', late: false, icon: 'action' });
  });

  it('says what is late on a draft whose prospect waits too long', () => {
    const hot = draftOf({ score: 86, lastContactAt: minutesAgo(3 * 24 * 60) });
    expect(followUpReasonOf(hot, now)).toEqual({ text: 'Escribió hace 3 días y nadie le respondió', late: true, icon: 'overdue' });
  });

  it('keeps the action in words and in red when the prospect is also late', () => {
    const reason = followUpReasonOf(actionOf(minutesAgo(-60), { score: 90, lastContactAt: minutesAgo(40) }), now);
    expect(reason).toEqual({ text: 'Llamar · Hoy 16:00', late: true, icon: 'action' });
  });

  it('says Dali proposes to write today on a plain draft', () => {
    expect(followUpReasonOf(draftOf(), now)).toEqual({ text: 'Dali propone escribirle hoy', late: false, icon: 'draft' });
  });
});

describe('isDraftFollowUp', () => {
  it('is a draft only while Dali still has its text', () => {
    expect(isDraftFollowUp(draftOf())).toBe(true);
    expect(isDraftFollowUp({ ...draftOf(), prospect: prospect() })).toBe(false);
    expect(isDraftFollowUp(actionOf(minutesAgo(-30)))).toBe(false);
  });
});

describe('attendantLineOf', () => {
  it('says who attends it by first name', () => {
    expect(attendantLineOf({ assignee: { id: '6aecc7a354a328c01722f257', name: 'Rosa Quispe' } })).toBe('Atiende Rosa');
  });

  it('says nothing for a prospect nobody took', () => {
    expect(attendantLineOf({})).toBeNull();
  });
});

describe('hasUnsentEdits', () => {
  it('is false with nothing being edited', () => {
    expect(hasUnsentEdits([draftOf()], {})).toBe(false);
  });

  it('is false while the text is still Dali\'s, spaces aside', () => {
    expect(hasUnsentEdits([draftOf()], { 'dali:51949123824': `  ${DRAFT} ` })).toBe(false);
  });

  it('is true once the seller changed the text, or emptied it', () => {
    expect(hasUnsentEdits([draftOf()], { 'dali:51949123824': `${DRAFT} Saludos.` })).toBe(true);
    expect(hasUnsentEdits([draftOf()], { 'dali:51949123824': '' })).toBe(true);
  });

  it('ignores an edit of a follow-up that is no longer on screen', () => {
    expect(hasUnsentEdits([actionOf(minutesAgo(-30))], { 'dali:51949123824': 'Otro texto' })).toBe(false);
  });
});
