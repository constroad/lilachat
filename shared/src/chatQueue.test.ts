import { describe, expect, it } from 'vitest';
import { pendingCount, postponeOneDay, queueDetail, queueKicker, visibleQueue, type QueueItem } from './chatQueue.js';

const now = new Date(2026, 9, 22, 10, 0);
const task: QueueItem = { kind: 'task', key: 'task:c1:i1:2026-10-21T23:00:00.000Z', title: 'Acero inspeccionado en losa', context: 'Vaciado de losa', at: new Date(2026, 9, 21, 18, 0).toISOString(), checklistId: 'c1', itemId: 'i1', canPostpone: true };
const event: QueueItem = { kind: 'event', key: 'event:e1', title: 'Vaciado del cuarto piso', at: new Date(2026, 9, 22, 15, 0).toISOString(), eventId: 'e1' };
const poll: QueueItem = { kind: 'poll', key: 'poll:p1', title: '¿Turno de noche el sábado?', pollId: 'p1', seq: 40 };
const reminder: QueueItem = { kind: 'reminder', key: 'reminder:r1', title: 'Pedir el mixer', at: new Date(2026, 9, 22, 8, 0).toISOString(), reminderId: 'r1', seq: 41 };

/** Backlog 36 (José, 21/10): what is pending for me in a chat, as cards over the bar, one at a time. */
describe('chat queue', () => {
  it('late tasks first, then events, polls and reminders; what I dismissed does not come back', () => {
    expect(visibleQueue([reminder, poll, event, task], new Set()).map((item) => item.kind)).toEqual(['task', 'event', 'poll', 'reminder']);
    expect(visibleQueue([reminder, poll, event, task], new Set([task.key, poll.key])).map((item) => item.kind)).toEqual(['event', 'reminder']);
  });

  it('each card says what it is and why', () => {
    expect(queueKicker('task')).toBe('Tarea atrasada');
    expect(queueKicker('poll')).toBe('Encuesta sin votar');
    expect(queueKicker('event')).toBe('Evento sin responder');
    expect(queueKicker('reminder')).toBe('Recordatorio');
    expect(queueDetail(task, now)).toMatch(/^Vaciado de losa · venció ayer 6:00/);
    expect(queueDetail(event, now)).toMatch(/^Hoy 3:00/);
    expect(queueDetail(poll, now)).toBe('Todavía no votaste.');
    expect(queueDetail(reminder, now)).toMatch(/^Sonó hoy 8:00/);
  });

  it('a task late two days says the date', () => {
    expect(queueDetail({ ...task, at: new Date(2026, 9, 19, 9, 0).toISOString() }, now)).toBe('Vaciado de losa · venció el 19 oct');
  });

  it('postponing a late task gives it one day from now, at the hour it had', () => {
    expect(postponeOneDay(new Date(2026, 9, 21, 18, 0).toISOString(), now)).toBe(new Date(2026, 9, 23, 18, 0).toISOString());
    // Due later today (not late yet): tomorrow at that hour.
    expect(postponeOneDay(new Date(2026, 9, 22, 18, 0).toISOString(), now)).toBe(new Date(2026, 9, 23, 18, 0).toISOString());
  });
});

describe('dismissed cards', () => {
  it('a key once, the newest kept', async () => {
    const { withDismissed, QUEUE_DISMISSED_LIMIT } = await import('./chatQueue.js');
    expect(withDismissed(['a', 'b'], 'a')).toEqual(['b', 'a']);
    const full = Array.from({ length: QUEUE_DISMISSED_LIMIT }, (_, index) => `k${index}`);
    expect(withDismissed(full, 'new')).toHaveLength(QUEUE_DISMISSED_LIMIT);
    expect(withDismissed(full, 'new').at(-1)).toBe('new');
  });
});

/** José, 22/10: the chat list marks a chat with something waiting for me. */
describe('pendingCount', () => {
  it('what is pending in the chat minus what I dismissed on this device', () => {
    expect(pendingCount(['task:a', 'poll:b', 'event:c'], new Set(['poll:b']))).toBe(2);
  });
  it('nothing known or everything dismissed is zero', () => {
    expect(pendingCount(undefined, new Set())).toBe(0);
    expect(pendingCount(['poll:b'], new Set(['poll:b']))).toBe(0);
  });
});
