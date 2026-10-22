import { describe, expect, it } from 'vitest';
import { ACTIVITY_TABS, activityDaySections, activityType, mentionsMe, reactionsFromOthers } from './activity.js';

/** «Menciones y actividad» (design e-19): mentions, threads and reactions of a space, by day. PURE. */
describe('activity', () => {
  it('three tabs in the design order', () => {
    expect(ACTIVITY_TABS.map((tab) => [tab.type, tab.label])).toEqual([['mentions', 'Menciones'], ['threads', 'Hilos'], ['reactions', 'Reacciones']]);
    expect(activityType('threads')).toBe('threads');
    expect(activityType('x')).toBe('mentions');
  });

  it('a message mentions me by name, or with @todos or @aquí in a group', () => {
    expect(mentionsMe([{ userId: 'jose', desde: 0, largo: 5 }], 'jose')).toBe(true);
    expect(mentionsMe([{ userId: 'todos', desde: 0, largo: 6 }], 'jose')).toBe(true);
    expect(mentionsMe([{ userId: 'aqui', desde: 0, largo: 5 }], 'jose')).toBe(true);
    expect(mentionsMe([{ userId: 'ana', desde: 0, largo: 4 }], 'jose')).toBe(false);
    expect(mentionsMe(undefined, 'jose')).toBe(false);
  });

  it('the reactions of others to my message, grouped by emoji, the most recent first', () => {
    const reactions = [
      { userId: 'ana', emoji: '👍', en: '2026-10-21T10:00:00Z' },
      { userId: 'jose', emoji: '👍', en: '2026-10-21T10:01:00Z' },
      { userId: 'beto', emoji: '✅', en: '2026-10-21T11:00:00Z' },
      { userId: 'carla', emoji: '👍', en: '2026-10-21T09:00:00Z' },
    ];
    expect(reactionsFromOthers(reactions, 'jose')).toEqual({ groups: [{ emoji: '👍', count: 2, userIds: ['ana', 'carla'] }, { emoji: '✅', count: 1, userIds: ['beto'] }], latestAt: '2026-10-21T11:00:00Z', latestBy: 'beto' });
    expect(reactionsFromOthers([{ userId: 'jose', emoji: '👍' }], 'jose')).toBeNull();
  });

  it('by day in Lima: Hoy, Ayer, Esta semana, Anteriores', () => {
    const now = new Date('2026-10-21T15:00:00-05:00');
    const items = [
      { id: 'a', at: '2026-10-21T10:42:00-05:00' },
      { id: 'b', at: '2026-10-20T16:20:00-05:00' },
      { id: 'c', at: '2026-10-17T14:15:00-05:00' },
      { id: 'd', at: '2026-09-30T09:00:00-05:00' },
    ];
    expect(activityDaySections(items, now).map((section) => [section.title, section.items.map((item) => item.id)])).toEqual([['Hoy', ['a']], ['Ayer', ['b']], ['Esta semana', ['c']], ['Anteriores', ['d']]]);
  });
});
