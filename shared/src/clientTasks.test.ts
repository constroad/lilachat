import { describe, expect, it } from 'vitest';
import { ORDER_TASKS_STAGE, orderTaskText, validateClientTasks } from './clientTasks.js';

describe('the tasks an app adds to a client\'s checklist (José 06/11)', () => {
  it('each task carries the order\'s code, its own key, person and date', () => {
    // Act
    const valid = validateClientTasks({ key: 'order:abc', label: 'PED-12', items: [{ text: ' Cuadrilla ', key: 'cuadrilla', assignee_phone: '902049935', due_at: '2026-11-07T15:00:00.000Z' }] });
    // Assert
    expect(valid).toEqual({ ok: true, tasks: { key: 'order:abc', label: 'PED-12', items: [{ text: 'PED-12 · Cuadrilla', key: 'cuadrilla', assigneePhone: '902049935', dueAt: '2026-11-07T15:00:00.000Z' }] } });
  });

  it('«Ejecución» is the third stage of the plan', () => {
    expect(ORDER_TASKS_STAGE).toBe(3);
    expect(orderTaskText('PED-1', 'Agua')).toBe('PED-1 · Agua');
  });

  it('refuses what it cannot keep: no key, no label, no tasks, a task too long with its code', () => {
    expect(validateClientTasks({ label: 'PED-1', items: [{ text: 'A' }] })).toMatchObject({ ok: false, message: expect.stringContaining('key') });
    expect(validateClientTasks({ key: 'k', items: [{ text: 'A' }] })).toMatchObject({ ok: false, message: expect.stringContaining('label') });
    expect(validateClientTasks({ key: 'k', label: 'PED-1', items: [] })).toMatchObject({ ok: false });
    expect(validateClientTasks({ key: 'k', label: 'PED-1', items: [{ text: 'x'.repeat(198) }] })).toMatchObject({ ok: false, message: expect.stringContaining('con su código') });
    expect(validateClientTasks(null)).toMatchObject({ ok: false });
  });
});
