import { describe, expect, it } from 'vitest';
import { CHECKLIST_LIMITS, activeDueChoice, checklistMembers, checklistSummaryLine, taskDoneNotices, checklistOverdue, checklistPermissions, checklistProgress, checklistTextInChat, myTasks, shortPersonName, taskDueLabel, taskDueOptions, taskDueState, toggleChecklistItem, validateChecklist, validateChecklistItem } from './checklists.js';

/** José, 21/10: «agrega el checklist al estilo de Telegram» (backlog 8). */
describe('validateChecklist', () => {
  it('trims the title and the tasks, drops the empty ones and keeps the order', () => {
    expect(validateChecklist({ title: '  Vaciado de losa ', items: [' Pedido de concreto ', '', '  ', 'Bomba reservada'] })).toEqual({ ok: true, title: 'Vaciado de losa', items: ['Pedido de concreto', 'Bomba reservada'] });
  });
  it('needs a title and at least one task', () => {
    expect(validateChecklist({ title: ' ', items: ['Algo'] })).toEqual({ ok: false, message: 'Escribe el título del checklist.' });
    expect(validateChecklist({ title: 'Obra', items: ['', ' '] })).toEqual({ ok: false, message: 'Agrega al menos una tarea.' });
  });
  it('refuses repeated tasks, too many and too long ones', () => {
    expect(validateChecklist({ title: 'Obra', items: ['Acero', 'acero '] })).toEqual({ ok: false, message: 'Hay tareas repetidas.' });
    expect(validateChecklist({ title: 'Obra', items: Array.from({ length: CHECKLIST_LIMITS.items + 1 }, (_, index) => `Tarea ${index}`) })).toEqual({ ok: false, message: `Un checklist lleva hasta ${CHECKLIST_LIMITS.items} tareas.` });
    expect(validateChecklist({ title: 'x'.repeat(CHECKLIST_LIMITS.title + 1), items: ['a'] }).ok).toBe(false);
    expect(validateChecklist({ title: 'Obra', items: ['x'.repeat(CHECKLIST_LIMITS.item + 1)] }).ok).toBe(false);
  });
});

describe('validateChecklistItem', () => {
  const existing = [{ text: 'Acero' }];
  it('a new task: trimmed, not empty, not repeated, and room left', () => {
    expect(validateChecklistItem(' Encofrado ', existing)).toEqual({ ok: true, text: 'Encofrado' });
    expect(validateChecklistItem('  ', existing)).toEqual({ ok: false, message: 'Escribe la tarea.' });
    expect(validateChecklistItem('ACERO', existing)).toEqual({ ok: false, message: 'Esa tarea ya está.' });
    expect(validateChecklistItem('Otra', Array.from({ length: CHECKLIST_LIMITS.items }, (_, index) => ({ text: `T${index}` })))).toEqual({ ok: false, message: `Un checklist lleva hasta ${CHECKLIST_LIMITS.items} tareas.` });
  });
});

describe('checklistPermissions', () => {
  it('who made it marks and adds always; the others only if it allows them', () => {
    expect(checklistPermissions({ me: 'ana', createdBy: 'ana', othersCanMark: false, othersCanAdd: false })).toEqual({ canMark: true, canAdd: true });
    expect(checklistPermissions({ me: 'beto', createdBy: 'ana', othersCanMark: true, othersCanAdd: false })).toEqual({ canMark: true, canAdd: false });
    expect(checklistPermissions({ me: 'beto', createdBy: 'ana', othersCanMark: false, othersCanAdd: true })).toEqual({ canMark: false, canAdd: true });
  });
});

describe('toggleChecklistItem', () => {
  const items = [{ id: 'a', text: 'Acero', doneBy: null, doneAt: null }, { id: 'b', text: 'Bomba', doneBy: 'luis', doneAt: '2026-10-21T09:40:00.000Z' }];
  it('marks a pending task with who and when; unmarks a done one', () => {
    const marked = toggleChecklistItem(items, 'a', 'beto', new Date('2026-10-21T10:00:00.000Z'));
    expect(marked).toEqual({ ok: true, done: true, items: [{ id: 'a', text: 'Acero', doneBy: 'beto', doneAt: '2026-10-21T10:00:00.000Z' }, items[1]] });
    const unmarked = toggleChecklistItem(items, 'b', 'beto', new Date());
    expect(unmarked).toMatchObject({ ok: true, done: false });
    expect(unmarked.ok && unmarked.items[1]).toEqual({ id: 'b', text: 'Bomba', doneBy: null, doneAt: null });
  });
  it('a task that is not there is refused', () => {
    expect(toggleChecklistItem(items, 'z', 'beto', new Date())).toEqual({ ok: false, message: 'Esa tarea ya no está.' });
  });
});

describe('checklistProgress and its text in the chat', () => {
  it('counts the done ones', () => {
    expect(checklistProgress([{ doneBy: 'a' }, { doneBy: null }, { doneBy: 'b' }])).toEqual({ done: 2, total: 3 });
    expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
  });
  it('what the notification and the chat list read', () => {
    expect(checklistTextInChat('  Vaciado de losa ')).toBe('Checklist: Vaciado de losa');
  });
});

/** Backlog 30 (José, 21/10): assignees and an ETA per task, to see whether it is on time. */
describe('task due dates', () => {
  const now = new Date(2026, 9, 21, 10, 0);
  it('the state: done, overdue, due today, upcoming, or none', () => {
    expect(taskDueState({ dueAt: null, doneBy: null }, now)).toBe('none');
    expect(taskDueState({ dueAt: new Date(2026, 9, 21, 9, 0).toISOString(), doneBy: null }, now)).toBe('overdue');
    expect(taskDueState({ dueAt: new Date(2026, 9, 21, 15, 0).toISOString(), doneBy: null }, now)).toBe('today');
    expect(taskDueState({ dueAt: new Date(2026, 9, 23, 7, 0).toISOString(), doneBy: null }, now)).toBe('upcoming');
    expect(taskDueState({ dueAt: new Date(2026, 9, 20, 9, 0).toISOString(), doneBy: 'luis' }, now)).toBe('done');
  });
  it('the label says when, and how late in days', () => {
    expect(taskDueLabel(new Date(2026, 9, 21, 15, 0).toISOString(), now)).toMatch(/^Hoy 3:00/);
    expect(taskDueLabel(new Date(2026, 9, 22, 9, 0).toISOString(), now)).toMatch(/^Mañana 9:00/);
    expect(taskDueLabel(new Date(2026, 9, 21, 9, 0).toISOString(), now)).toBe('Atrasada · hoy');
    expect(taskDueLabel(new Date(2026, 9, 20, 9, 0).toISOString(), now)).toBe('Atrasada · ayer');
    expect(taskDueLabel(new Date(2026, 9, 18, 9, 0).toISOString(), now)).toBe('Atrasada · 3 días');
    expect(taskDueLabel(new Date(2026, 9, 23, 7, 0).toISOString(), now)).toMatch(/^vie\.? 7:00/i);
  });
  it('quick choices: today (only with time left), tomorrow, and the coming days', () => {
    const options = taskDueOptions(now);
    expect(options.map((option) => option.id)).toEqual(['today', 'tomorrow', 'in2', 'in3']);
    expect(options[0]!.date).toEqual(new Date(2026, 9, 21, 18, 0));
    expect(options[1]!.date).toEqual(new Date(2026, 9, 22, 9, 0));
    expect(taskDueOptions(new Date(2026, 9, 21, 17, 30)).map((option) => option.id)).toEqual(['tomorrow', 'in2', 'in3']);
  });
  it('a checklist counts its overdue tasks', () => {
    expect(checklistOverdue([{ dueAt: new Date(2026, 9, 20).toISOString(), doneBy: null }, { dueAt: new Date(2026, 9, 20).toISOString(), doneBy: 'a' }, { dueAt: null, doneBy: null }], now)).toBe(1);
  });
});

describe('myTasks', () => {
  const now = new Date(2026, 9, 21, 10, 0);
  const task = (id: string, assignee: string | null, dueAt: Date | null, doneBy: string | null = null) => ({ id, text: id, assignee, dueAt: dueAt ? dueAt.toISOString() : null, doneBy, doneAt: null });
  const checklists = [
    { _id: 'k1', title: 'Losa', chatId: 'c1', items: [task('a', 'me', new Date(2026, 9, 20)), task('b', 'me', new Date(2026, 9, 21, 15)), task('c', 'ana', null), task('d', 'me', null, 'me')] },
    { _id: 'k2', title: 'Flota', chatId: 'c2', items: [task('e', 'me', new Date(2026, 9, 25)), task('f', 'me', null)] },
  ];
  it('only what is mine and pending, grouped overdue · today · upcoming · no date, the soonest first', () => {
    const groups = myTasks(checklists, 'me', now);
    expect(groups.map((group) => [group.state, group.tasks.map((one) => one.item.id)])).toEqual([
      ['overdue', ['a']],
      ['today', ['b']],
      ['upcoming', ['e']],
      ['none', ['f']],
    ]);
    expect(groups[0]!.tasks[0]).toMatchObject({ checklistId: 'k1', checklistTitle: 'Losa', chatId: 'c1' });
  });
});

/** The task sheet (design `k-03-checklist-responsables`): which «para cuándo» chip is lit, and the names under the avatars. */
describe('task sheet', () => {
  const now = new Date(2026, 9, 21, 10, 0);
  const options = taskDueOptions(now);
  it('lights the quick chip whose date it is, «Elegir fecha» for another date, and «Sin fecha» for none', () => {
    expect(activeDueChoice(new Date(2026, 9, 22, 9, 0).toISOString(), options)).toBe('tomorrow');
    expect(activeDueChoice(new Date(2026, 9, 21, 18, 0).toISOString(), options)).toBe('today');
    expect(activeDueChoice(new Date(2026, 9, 30, 18, 0).toISOString(), options)).toBe('custom');
    expect(activeDueChoice(null, options)).toBe('none');
    expect(activeDueChoice(undefined, options)).toBe('none');
  });
  it('first name and the initial of the last one; a lone name or a phone stays whole', () => {
    expect(shortPersonName('Ana Torres')).toBe('Ana T.');
    expect(shortPersonName('  Luis   Huamán Paz ')).toBe('Luis H.');
    expect(shortPersonName('Wilson')).toBe('Wilson');
    expect(shortPersonName('+51 960 397 018')).toBe('+51 960 397 018');
    expect(shortPersonName('')).toBe('');
  });
});

describe('checklistMembers', () => {
  it('me first as «Tú», then the others by name; no map, no one', () => {
    const names = new Map([['u2', 'Luis Huamán'], ['me', 'José Zamora'], ['u3', 'Ana Torres']]);
    expect(checklistMembers(names, 'me')).toEqual([{ id: 'me', name: 'Tú' }, { id: 'u3', name: 'Ana Torres' }, { id: 'u2', name: 'Luis Huamán' }]);
    expect(checklistMembers(undefined, 'me')).toEqual([]);
  });
});

/** The chat info's «Checklists» (design `k-05-checklists-del-chat`): progress and what is late. */
describe('checklistSummaryLine', () => {
  it('«3 de 6 listas · 1 atrasada», plural, and complete', () => {
    expect(checklistSummaryLine({ done: 3, total: 6, overdue: 1 })).toEqual({ progress: '3 de 6 listas', late: '1 atrasada', complete: false });
    expect(checklistSummaryLine({ done: 0, total: 8, overdue: 2 })).toEqual({ progress: '0 de 8 listas', late: '2 atrasadas', complete: false });
    expect(checklistSummaryLine({ done: 5, total: 5, overdue: 0 })).toEqual({ progress: '5 de 5 listas', late: null, complete: true });
  });
});

/**
 * Backlog 35 (José, 21/10: should completing a task send a notice?): not to
 * the whole chat; to whoever made the checklist
 * and to the assignee of each task, never to who ticked it; several ticks in
 * a row go as one notice, and a completed checklist says so.
 */
describe('taskDoneNotices', () => {
  const checklist = { title: 'Vaciado de losa', createdBy: 'ana', total: 4, done: 3 };
  const ticked = [{ text: 'Acero', assignee: 'luis' }, { text: 'Bomba', assignee: null }];
  it('the author hears about every tick; an assignee about their own; who ticked, nothing', () => {
    expect(taskDoneNotices({ checklist, who: 'beto', whoName: 'Beto', ticked })).toEqual([
      { to: 'ana', body: 'Beto marcó 2 tareas de «Vaciado de losa»' },
      { to: 'luis', body: 'Beto marcó «Acero» de «Vaciado de losa»' },
    ]);
  });
  it('the author ticking their own checklist only tells the assignees', () => {
    expect(taskDoneNotices({ checklist, who: 'ana', whoName: 'Ana', ticked: [{ text: 'Acero', assignee: 'luis' }] })).toEqual([{ to: 'luis', body: 'Ana marcó «Acero» de «Vaciado de losa»' }]);
  });
  it('a completed checklist: one notice to the author and every assignee', () => {
    const complete = { ...checklist, done: 4, assignees: ['luis', 'carla', 'beto'] };
    expect(taskDoneNotices({ checklist: complete, who: 'beto', whoName: 'Beto', ticked })).toEqual([
      { to: 'ana', body: 'Beto completó «Vaciado de losa» (4 de 4 listas)' },
      { to: 'luis', body: 'Beto completó «Vaciado de losa» (4 de 4 listas)' },
      { to: 'carla', body: 'Beto completó «Vaciado de losa» (4 de 4 listas)' },
    ]);
  });
  it('nothing ticked, nothing to say', () => {
    expect(taskDoneNotices({ checklist, who: 'beto', whoName: 'Beto', ticked: [] })).toEqual([]);
  });
});

