import { describe, expect, it } from 'vitest';
import { CHECKLIST_LIMITS, checklistPermissions, checklistProgress, checklistTextInChat, toggleChecklistItem, validateChecklist, validateChecklistItem } from './checklists.js';

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
