import { describe, expect, it } from 'vitest';
import { assignedNotice, taskAdvanceOf, taskReminderPlan } from './taskReminders.js';

const NOW = new Date('2026-11-06T20:00:00.000Z');
const task = { assignee: 'ana', dueAt: '2026-11-07T15:00:00.000Z', doneBy: null, advance: [60, 15] };

describe('the reminder of a task (José 06/11)', () => {
  it('rings for its person, at the times the task chose', () => {
    expect(taskReminderPlan(task, false, NOW)).toEqual({ userId: 'ana', startsAt: '2026-11-07T15:00:00.000Z', advance: [60, 15] });
  });

  it('a task\'s own reminders work with the space\'s notices off', () => {
    expect(taskReminderPlan(task, false, NOW)).not.toBeNull();
  });

  it('a space with notices on gives two hours to a task that chose nothing', () => {
    expect(taskReminderPlan({ ...task, advance: undefined }, true, NOW)?.advance).toEqual([120]);
    expect(taskReminderPlan({ ...task, advance: undefined }, false, NOW)).toBeNull();
  });

  it('a task that removed its reminders stays silent, whatever the space says', () => {
    expect(taskAdvanceOf([], true)).toEqual([]);
    expect(taskReminderPlan({ ...task, advance: [] }, true, NOW)).toBeNull();
  });

  it('nobody rings without a person, a date, or once it is done or past', () => {
    expect(taskReminderPlan({ ...task, assignee: null }, true, NOW)).toBeNull();
    expect(taskReminderPlan({ ...task, dueAt: null }, true, NOW)).toBeNull();
    expect(taskReminderPlan({ ...task, doneBy: 'ana' }, true, NOW)).toBeNull();
    expect(taskReminderPlan({ ...task, dueAt: '2026-11-06T19:00:00.000Z' }, true, NOW)).toBeNull();
  });
});

describe('the notice of an assigned task', () => {
  const base = { before: null, after: 'ana', actor: 'jose', spaceNotices: true, text: '07/11 · OBRA GRAU · Cuadrilla' };

  it('tells the new person what they got', () => {
    expect(assignedNotice(base)).toEqual({ to: 'ana', body: 'Te asignaron: 07/11 · OBRA GRAU · Cuadrilla' });
  });

  it('is born off, and says nothing to who assigned themselves or when nothing changed', () => {
    expect(assignedNotice({ ...base, spaceNotices: false })).toBeNull();
    expect(assignedNotice({ ...base, actor: 'ana' })).toBeNull();
    expect(assignedNotice({ ...base, before: 'ana' })).toBeNull();
    expect(assignedNotice({ ...base, after: null })).toBeNull();
  });
});
