import { parseAdvance } from './reminderAdvance.js';

/**
 * Reminders of a task (José 06/11: «que se puedan agregar recordatorios x tiempo antes»). With the
 * WhatsApp message gone, this is what pushes the person in charge. A task's own reminders always ring;
 * a space with task notices on also gives two hours to a task that chose nothing. PURE.
 */
export const DEFAULT_TASK_ADVANCE: readonly number[] = [120];

export type TaskForReminder = { assignee?: string | null; dueAt?: string | null; doneBy: string | null; advance?: number[] };
export type TaskReminderPlan = { userId: string; startsAt: string; advance: number[] };

/** What rings before a task: its own choice, even none, or the space's default. */
export function taskAdvanceOf(advance: readonly number[] | undefined, spaceNotices: boolean): number[] {
  if (advance) return parseAdvance(advance);
  return spaceNotices ? [...DEFAULT_TASK_ADVANCE] : [];
}

/** The reminder a task needs now; null when nobody should ring: no person, no date, done, past, or nothing chosen. */
export function taskReminderPlan(task: TaskForReminder, spaceNotices: boolean, now: Date): TaskReminderPlan | null {
  if (!task.assignee || !task.dueAt || task.doneBy) return null;
  if (new Date(task.dueAt).getTime() <= now.getTime()) return null;
  const advance = taskAdvanceOf(task.advance, spaceNotices);
  return advance.length ? { userId: task.assignee, startsAt: task.dueAt, advance } : null;
}

/** The push when a task gets its person, only with the space's notices on and never for oneself. */
export function assignedNotice(params: { before?: string | null; after?: string | null; actor: string; spaceNotices: boolean; text: string }): { to: string; body: string } | null {
  const { before, after, actor, spaceNotices, text } = params;
  if (!spaceNotices || !after || after === before || after === actor) return null;
  return { to: after, body: `Te asignaron: ${text}` };
}
