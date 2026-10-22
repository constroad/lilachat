import { formatClock, formatDayLabel } from './chatDisplay.js';
import { taskDueLabel } from './checklists.js';

/**
 * The cards queued over the writing bar (backlog 36, José 21/10: «como los
 * chips de Claude»): what is pending for me in this chat, one at a time, each
 * with its action. Derived from what is pending (`GET /api/agenda/queue`),
 * never a new inbox: doing the thing makes the card go. Dismissing is per
 * device, and the key carries the date, so a task moved to another day comes
 * back.
 */
export type QueueItem =
  | { kind: 'task'; key: string; title: string; context: string; at: string; checklistId: string; itemId: string; canPostpone: boolean; seq?: number }
  | { kind: 'event'; key: string; title: string; at: string; eventId: string; seq?: number }
  | { kind: 'poll'; key: string; title: string; pollId: string; seq?: number }
  | { kind: 'reminder'; key: string; title: string; at: string; reminderId: string; seq?: number };
export type QueueKind = QueueItem['kind'];

const ORDER: readonly QueueKind[] = ['task', 'event', 'poll', 'reminder'];
const KICKER: Record<QueueKind, string> = { task: 'Tarea atrasada', event: 'Evento sin responder', poll: 'Encuesta sin votar', reminder: 'Recordatorio' };
/** Where dismissed cards are remembered, and how many (the oldest go first). */
export const QUEUE_DISMISSED_KEY = 'lilachat.queue-dismissed';
export const QUEUE_DISMISSED_LIMIT = 200;

export const queueKicker = (kind: QueueKind): string => KICKER[kind];

/** The most urgent first: late tasks, then events, polls and reminders; each kind keeps the server's order. */
export function visibleQueue(items: readonly QueueItem[], dismissed: ReadonlySet<string>): QueueItem[] {
  return items.filter((item) => !dismissed.has(item.key)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

const lateLabel = (at: string, now: Date): string => {
  const day = formatDayLabel(at, now);
  if (day === 'Hoy' || day === 'Ayer') return `venció ${day.toLowerCase()} ${formatClock(at)}`;
  return `venció el ${day.replace(/\./g, '')}`;
};

/** The line under the title: why it is there. */
export function queueDetail(item: QueueItem, now: Date): string {
  if (item.kind === 'task') return `${item.context} · ${lateLabel(item.at, now)}`;
  if (item.kind === 'event') return taskDueLabel(item.at, now);
  if (item.kind === 'poll') return 'Todavía no votaste.';
  const day = formatDayLabel(item.at, now);
  return `Sonó ${day === 'Hoy' || day === 'Ayer' ? day.toLowerCase() : day.replace(/\./g, '')} ${formatClock(item.at)}`;
}

/** «Posponer 1 día»: tomorrow, at the hour the task had. */
export function postponeOneDay(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, due.getHours(), due.getMinutes(), 0, 0).toISOString();
}

/** Adds a dismissed key, keeping the newest `QUEUE_DISMISSED_LIMIT`. */
export function withDismissed(keys: readonly string[], key: string): string[] {
  return [...keys.filter((one) => one !== key), key].slice(-QUEUE_DISMISSED_LIMIT);
}

/** The chat list's marker (José, 22/10): what is pending in a chat minus what was dismissed on this device. */
export function pendingCount(keys: readonly string[] | undefined, dismissed: ReadonlySet<string>): number {
  return (keys ?? []).filter((key) => !dismissed.has(key)).length;
}
