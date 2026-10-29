import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK_STAGES, workPlanSummary, type WorkStage } from './workStages.js';

/** Pending 21: a channel as a job's file, its checklist by stages. */
const now = new Date('2026-10-28T15:00:00Z');
const task = (id: string, done: boolean, dueAt?: string) => ({ id, text: id, doneBy: done ? 'u1' : null, doneAt: done ? '2026-10-20T00:00:00Z' : null, dueAt: dueAt ?? null });
const stage = (n: number, title: string, items: WorkStage['items']): WorkStage => ({ _id: `s${n}`, title, stage: n, items });

describe('workPlanSummary', () => {
  it('the current stage is the first not finished; progress and pending count every task', () => {
    const plan = workPlanSummary([stage(3, 'Ejecución', [task('a', true), task('b', false), task('c', false, '2026-10-23T00:00:00Z')]), stage(1, 'Cotización', [task('d', true)]), stage(2, 'Orden', [task('e', true), task('f', true)])], now);

    expect(plan.current).toMatchObject({ title: 'Ejecución', stage: 3, status: 'in_progress', done: 1, total: 3 });
    expect(plan.stages.map((one) => one.status)).toEqual(['done', 'done', 'in_progress']);
    expect(plan).toMatchObject({ done: 4, total: 6, percent: 67, pending: 2, overdue: 1 });
  });

  it('an empty stage is pending, not done; a plan with no tasks is at 0 %', () => {
    const plan = workPlanSummary([stage(1, 'Cotización', []), stage(2, 'Orden', [])], now);

    expect(plan.current).toMatchObject({ stage: 1, status: 'pending' });
    expect(plan.percent).toBe(0);
  });

  it('everything done has no current stage', () => {
    expect(workPlanSummary([stage(1, 'Cotización', [task('a', true)])], now).current).toBeNull();
  });

  it('starts with the seven stages of a job', () => {
    expect(DEFAULT_WORK_STAGES).toHaveLength(7);
    expect(DEFAULT_WORK_STAGES[0]).toBe('Cotización');
  });
});
